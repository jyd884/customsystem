document.addEventListener('DOMContentLoaded', () => {
    // 只有管理员可以访问
    const user = Utils.requireAuth('admin');
    if (!user) return;

    Utils.renderHeader(user);

    const tableBody = document.getElementById('tableBody');
    const userModal = document.getElementById('userModal');
    const modalContent = document.getElementById('modalContent');
    const modalTitle = document.getElementById('modalTitle');

    async function render() {
        try {
            const users = await Utils.getUsers();
            const companies = await Utils.getCompanies();
    
            // 统计每个用户的公司数
            const companyCounts = {};
            // const companyLists = {}; // We can fetch detailed list on click instead? Or just filter client side since we have all
    
            companies.forEach(comp => {
                const creator = comp.createdBy;
                if (creator) {
                    companyCounts[creator] = (companyCounts[creator] || 0) + 1;
                }
            });
    
            tableBody.innerHTML = '';
            
            users.forEach((u, idx) => {
                const count = companyCounts[u.username] || 0;
                const tr = document.createElement('tr');
                
                // 构建操作按钮
                // 如果有录入数据，显示“查看列表”按钮
                const actionBtn = count > 0 
                    ? `<button class="btn btn-ghost" onclick="showCompanyList('${u.username}')">查看录入列表</button>` 
                    : '<span class="text-muted" style="font-size:12px;color:#ccc">无录入数据</span>';
    
                tr.innerHTML = `
                    <td>${idx + 1}</td>
                    <td>${u.username}</td>
                    <td>${u.password}</td> <!-- In real app, don't show password -->
                    <td>
                        <span class="status-tag" style="${u.role === 'admin' ? 'background:#fff7e6;color:#fa8c16;' : ''}">
                            ${u.role === 'admin' ? '管理员' : '普通用户'}
                        </span>
                    </td>
                    <td>${count}</td>
                    <td>${actionBtn}</td>
                `;
                tableBody.appendChild(tr);
            });
        } catch (e) {
            console.error(e);
            alert('获取用户列表失败');
        }
    }

    // 全局方法供 HTML onclick 调用
    window.showCompanyList = async function(username) {
        // Here we can re-fetch or use state. Since render fetched all, maybe we can't easily access 'companies' local variable.
        // Let's refetch or just fetch all companies again? Or store in global?
        // Simulating efficient fetch:
        const companies = await Utils.getCompanies();
        const userCompanies = companies.filter(c => c.createdBy === username);
        
        // 按时间倒序排列
        userCompanies.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        modalTitle.textContent = `${username} 的录入记录 (${userCompanies.length})`;
        
        if (userCompanies.length === 0) {
            modalContent.innerHTML = '<div class="text-center" style="color:#999;padding:20px;">暂无其他数据</div>';
        } else {
            let html = '<ul style="list-style:none; padding:0;">';
            userCompanies.forEach(comp => {
                html += `
                    <li style="padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 500;">${comp.name}</div>
                            <div style="font-size: 12px; color: #999;">${Utils.formatDate(comp.createdAt)}</div>
                        </div>
                        <a href="dashboard.html" class="btn btn-ghost" style="padding: 4px 8px; font-size: 12px;">去总览查看</a>
                    </li>
                `;
            });
            html += '</ul>';
            modalContent.innerHTML = html;
        }

        userModal.style.display = 'flex';
    };

    // Modal Close Logic
    userModal.addEventListener('click', (e) => {
        if (e.target === userModal) {
            userModal.style.display = 'none';
        }
    });

    render();
});
