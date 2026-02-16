const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const app = express();
const PORT = 3000;
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.resolve(__dirname, '../')));
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    try {
        const row = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, password);
        if (row) {
            res.json(row);
        } else {
            res.status(401).json({ error: "Invalid credentials" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;
    const role = 'user'; 
    try {
        const info = db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run(username, password, role);
        res.json({ username, password, role });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint')) {
            return res.status(400).json({ error: "Username already exists" });
        }
        return res.status(500).json({ error: err.message });
    }
});
app.get('/api/users', (req, res) => {
    try {
        const rows = db.prepare("SELECT username, password, role FROM users").all();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.get('/api/companies', (req, res) => {
    try {
        const query = `SELECT 
                id,
                name,
                created_at as createdAt,
                created_by as createdBy,
                last_modified as lastModified,
                last_modified_by as lastModifiedBy
            FROM companies`;
        const companies = db.prepare(query).all();
        companies.forEach(comp => {
            const shareholders = db.prepare("SELECT * FROM shareholders WHERE company_id = ?").all(comp.id);
            const sources = db.prepare("SELECT shareholder_id, source FROM sources WHERE company_id = ?").all(comp.id);
            const jobs = db.prepare("SELECT shareholder_id, title FROM jobs WHERE company_id = ?").all(comp.id);
            const sourceMap = {};
            sources.forEach(s => {
                sourceMap[s.shareholder_id] = s.source;
            });
            const jobMap = {};
            jobs.forEach(j => {
                jobMap[j.shareholder_id] = j.title;
            });
            shareholders.forEach(sh => {
                sh.source = sourceMap[sh.id] || '';
                sh.job = jobMap[sh.id] || '';
            });
            comp.shareholders = shareholders;
        });
        res.json(companies);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.get('/api/companies/:id', (req, res) => {
    const { id } = req.params;
    try {
        const company = db.prepare(
            `SELECT 
                id,
                name,
                created_at as createdAt,
                created_by as createdBy,
                last_modified as lastModified,
                last_modified_by as lastModifiedBy
             FROM companies WHERE id = ?`
        ).get(id);
        if (!company) return res.status(404).json({ error: "Company not found" });
        const shareholders = db.prepare("SELECT * FROM shareholders WHERE company_id = ?").all(id);
        const sources = db.prepare("SELECT shareholder_id, source FROM sources WHERE company_id = ?").all(id);
        const jobs = db.prepare("SELECT shareholder_id, title FROM jobs WHERE company_id = ?").all(id);
        const sourceMap = {};
        sources.forEach(s => {
            sourceMap[s.shareholder_id] = s.source;
        });
        const jobMap = {};
        jobs.forEach(j => {
            jobMap[j.shareholder_id] = j.title;
        });
        shareholders.forEach(sh => {
            sh.source = sourceMap[sh.id] || '';
            sh.job = jobMap[sh.id] || '';
        });
        company.shareholders = shareholders;
        company.followHistory = db.prepare(
            `SELECT 
                fh.shareholder_id as shareholderId,
                fh.stage as stage,
                fh.changed_at as changedAt,
                sh.name as shareholderName
             FROM follow_history fh
             LEFT JOIN shareholders sh ON sh.id = fh.shareholder_id
             WHERE fh.company_id = ?
             ORDER BY fh.changed_at DESC`
        ).all(id);
        res.json(company);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.post('/api/companies', (req, res) => {
    const { id, name, createdAt, createdBy, shareholders } = req.body;
    const insertTransaction = db.transaction((companies) => {
        db.prepare("INSERT INTO companies (id, name, created_at, created_by) VALUES (?, ?, ?, ?)").run(id, name, createdAt, createdBy);
        const shStmt = db.prepare("INSERT INTO shareholders (id, company_id, name, phone, share, stage, notes) VALUES (?, ?, ?, ?, ?, ?, ?)");
        const sourceStmt = db.prepare("INSERT INTO sources (company_id, shareholder_id, source) VALUES (?, ?, ?)");
        const jobStmt = db.prepare("INSERT INTO jobs (company_id, shareholder_id, title) VALUES (?, ?, ?)");
        const historyStmt = db.prepare("INSERT INTO follow_history (company_id, shareholder_id, stage, changed_at) VALUES (?, ?, ?, ?)");
        if (shareholders && shareholders.length > 0) {
            shareholders.forEach(sh => {
                shStmt.run(sh.id, id, sh.name, sh.phone, sh.share, sh.stage, sh.notes);
                sourceStmt.run(id, sh.id, sh.source);
                jobStmt.run(id, sh.id, sh.job || '');
                historyStmt.run(id, sh.id, sh.stage, createdAt || new Date().toISOString());
            });
        }
    });
    try {
        insertTransaction();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.put('/api/companies/:id', (req, res) => {
    const { id } = req.params;
    const { name, lastModified, lastModifiedBy, shareholders } = req.body;
    const updateTransaction = db.transaction(() => {
        const existingStages = db.prepare("SELECT id, stage FROM shareholders WHERE company_id = ?").all(id);
        const stageMap = {};
        existingStages.forEach(row => {
            stageMap[row.id] = row.stage;
        });

        db.prepare("UPDATE companies SET name = ?, last_modified = ?, last_modified_by = ? WHERE id = ?")
          .run(name, lastModified, lastModifiedBy, id);
        db.prepare("DELETE FROM shareholders WHERE company_id = ?").run(id);
        db.prepare("DELETE FROM sources WHERE company_id = ?").run(id);
        db.prepare("DELETE FROM jobs WHERE company_id = ?").run(id);
        const shStmt = db.prepare("INSERT INTO shareholders (id, company_id, name, phone, share, stage, notes) VALUES (?, ?, ?, ?, ?, ?, ?)");
        const sourceStmt = db.prepare("INSERT INTO sources (company_id, shareholder_id, source) VALUES (?, ?, ?)");
        const jobStmt = db.prepare("INSERT INTO jobs (company_id, shareholder_id, title) VALUES (?, ?, ?)");
        const historyStmt = db.prepare("INSERT INTO follow_history (company_id, shareholder_id, stage, changed_at) VALUES (?, ?, ?, ?)");
        if (shareholders && shareholders.length > 0) {
            shareholders.forEach(sh => {
                shStmt.run(sh.id, id, sh.name, sh.phone, sh.share, sh.stage, sh.notes);
                sourceStmt.run(id, sh.id, sh.source);
                jobStmt.run(id, sh.id, sh.job || '');
                const prevStage = stageMap[sh.id];
                if (!prevStage || prevStage !== sh.stage) {
                    historyStmt.run(id, sh.id, sh.stage, lastModified || new Date().toISOString());
                }
            });
        }
    });
    try {
        updateTransaction();
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});
app.delete('/api/companies/:id', (req, res) => {
    const { id } = req.params;
    const deleteTransaction = db.transaction(() => {
        db.prepare("DELETE FROM follow_history WHERE company_id = ?").run(id);
        db.prepare("DELETE FROM sources WHERE company_id = ?").run(id);
        db.prepare("DELETE FROM jobs WHERE company_id = ?").run(id);
        db.prepare("DELETE FROM shareholders WHERE company_id = ?").run(id);
        db.prepare("DELETE FROM companies WHERE id = ?").run(id);
    });
    try {
        deleteTransaction();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Open your browser at http://localhost:${PORT}/login.html`);
});
