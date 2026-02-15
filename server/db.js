const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');

// better-sqlite3 is synchronous
let db;
try {
    db = new Database(dbPath, { verbose: console.log });
    console.log('Connected to the SQLite database (better-sqlite3).');
    initDb();
} catch (err) {
    console.error('Error opening database', err.message);
}

function initDb() {
    // Users Table
    db.exec(`CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        role TEXT NOT NULL
    )`);

    // Seed Admin
    const row = db.prepare("SELECT username FROM users WHERE username = ?").get('admin');
    if (!row) {
        db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run('admin', 'admin', 'admin');
        console.log("Admin user seeded.");
    }

    // Companies Table
    db.exec(`CREATE TABLE IF NOT EXISTS companies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT,
        created_by TEXT,
        last_modified TEXT,
        last_modified_by TEXT
    )`);

    // Shareholders Table
    db.exec(`CREATE TABLE IF NOT EXISTS shareholders (
        id TEXT PRIMARY KEY,
        company_id TEXT,
        name TEXT,
        phone TEXT,
        share TEXT,
        stage TEXT,
        notes TEXT,
        FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE
    )`);

    // Sources Table (per shareholder)
    db.exec(`CREATE TABLE IF NOT EXISTS sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id TEXT,
        shareholder_id TEXT UNIQUE,
        source TEXT,
        FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE,
        FOREIGN KEY (shareholder_id) REFERENCES shareholders (id) ON DELETE CASCADE
    )`);


    

    // Follow History Table (stage changes)
    db.exec(`CREATE TABLE IF NOT EXISTS follow_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id TEXT,
        shareholder_id TEXT,
        stage TEXT,
        notes TEXT,
        changed_at TEXT,
        FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE,
        FOREIGN KEY (shareholder_id) REFERENCES shareholders (id) ON DELETE CASCADE
    )`);
    
    // Migration: Add notes column if not exists (for existing tables)
    try {
        db.exec("ALTER TABLE follow_history ADD COLUMN notes TEXT");
    } catch (e) {
        // Ignore error if column exists
    }
}

module.exports = db;
