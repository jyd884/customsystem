/**
 * Utils.js
 * Frontend Data Layer talking to Node.js Backend
 */

const KEYS = {
    CURRENT_USER: 'sys_session'
};

const FOLLOW_STAGES = [
    "已申请待通过",
    "已通过",
    "有交流无意向",
    "有意向无面谈",
    "已面谈无机会",
    "有机会"
];

const API_BASE = 'http://47.107.182.205:3000/api';

const Utils = {
    // --- API Helpers ---
    async request(endpoint, method = 'GET', body = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        if (body) {
            options.body = JSON.stringify(body);
        }

        const res = await fetch(`${API_BASE}${endpoint}`, options);
        // If 401, maybe logout?
        if (res.status === 401 && !endpoint.includes('login')) {
             this.logout();
             return null;
        }

        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(data.error || 'Server Error');
        }
        return data;
    },

    // --- Data Layer (Async) ---
    async getUsers() {
        return await this.request('/users');
    },

    async getCompanies() {
        return await this.request('/companies');
    },

    async getCompanyById(id) {
        return await this.request(`/companies/${id}`);
    },

    async saveCompany(companyData) {
        // Decide if Create (POST) or Update (PUT) based on lastModified/createdAt checks or just try/catch?
        // In input.js we set createdBy only for new ones.
        // We can just check companyData.lastModified. If present, it's an edit.
        // Or better: pass a flag or separate methods. 
        // But input.js calls saveCompany.
        // Let's assume if it has `lastModified` it is an update.
        
        if (companyData.lastModified) {
            return await this.request(`/companies/${companyData.id}`, 'PUT', companyData);
        } else {
            return await this.request('/companies', 'POST', companyData);
        }
    },

    async deleteCompany(id) {
        return await this.request(`/companies/${id}`, 'DELETE');
    },

    // --- Auth Layer (Async) ---
    async login(username, password) {
        try {
            const user = await this.request('/auth/login', 'POST', { username, password });
            localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
            return user;
        } catch (e) {
            console.error(e);
            return null;
        }
    },

    async register(username, password, role = 'user') {
        return await this.request('/auth/register', 'POST', { username, password, role });
    },

    logout() {
        localStorage.removeItem(KEYS.CURRENT_USER);
        window.location.href = 'login.html';
    },

    getCurrentUser() { // Synchronous, just checks local session
        const data = localStorage.getItem(KEYS.CURRENT_USER);
        return data ? JSON.parse(data) : null;
    },

    requireAuth(requiredRole = null) {
        const user = this.getCurrentUser();
        if (!user) {
            window.location.href = 'login.html';
            return null;
        }
        if (requiredRole && user.role !== requiredRole) {
            alert('权限不足');
            window.location.href = user.role === 'admin' ? 'dashboard.html' : 'input.html';
            return null;
        }
        return user;
    },

    // --- UI Helpers ---
    renderHeader(user) {
        const header = document.createElement('header');
        header.className = 'app-header';
        
        const brandLink = 'dashboard.html';
        
        header.innerHTML = `
            <a href="${brandLink}" class="brand">公司管理系统</a>
            <div class="user-actions">
                <span class="welcome-text">
                    ${user.username} (${user.role === 'admin' ? '管理员' : '普通用户'})
                </span>
                ${user.role === 'admin' ? '<a href="users.html" class="btn btn-ghost">用户管理</a>' : ''}
                <a href="input.html?mode=new" class="btn btn-ghost">新增录入</a>
                ${location.pathname.includes('input.html') ? '<a href="dashboard.html" class="btn btn-ghost">生成总表</a>' : ''}
                <button id="logoutBtn" class="btn btn-ghost">退出</button>
            </div>
        `;
        document.body.prepend(header);
        
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });
    },

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    formatDate(isoString) {
        if (!isoString) return '-';
        const d = new Date(isoString);
        return d.toLocaleString('zh-CN', { hour12: false }); 
    }
};
