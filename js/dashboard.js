document.addEventListener('DOMContentLoaded', () => {
    // 只要登录用户都可以访问
    const user = Utils.requireAuth();
    if (!user) return;

    Utils.renderHeader(user);

    const tableBody = document.getElementById('tableBody');
    const searchInput = document.getElementById('searchInput');
    const stageFilter = document.getElementById('stageFilter');
    const emptyState = document.getElementById('emptyState');
    const detailModal = document.getElementById('detailModal');
    const detailContent = document.getElementById('detailContent');
    const modalEditBtn = document.getElementById('modalEditBtn');

    let allCompanies = [];

    function getStageClass(stage) {
        const map = {
            '已申请待通过': 'tag-pending',
            '已通过': 'tag-approved',
            '有交流无意向': 'tag-no-intent',
            '有意向无面谈': 'tag-intent-no-meet',
            '已面谈无机会': 'tag-no-chance',
            '有机会': 'tag-opportunity'
        };
        return map[stage] || 'tag-unknown';
    }

    async function render() {
        try {
            // 获取所有公司信息
            let rawCompanies = await Utils.getCompanies();
            
            // 如果不是管理员，只保留自己创建的
            if (user.role !== 'admin') {
                rawCompanies = rawCompanies.filter(c => c.createdBy === user.username);
            }
            allCompanies = rawCompanies;
    
            const query = searchInput.value.trim().toLowerCase();
            const stageValue = stageFilter.value;
            
            // Flasken rows
            let rows = [];
            let indexCounter = 1;
    
            // Sort by newest first
            allCompanies.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
            allCompanies.forEach(comp => {
                if (comp.shareholders && comp.shareholders.length > 0) {
                    comp.shareholders.forEach(sh => {
                        rows.push({
                            id: comp.id, // Company ID
                            uniqueKey: comp.id + sh.id,
                            createdAt: comp.createdAt,
                            createdBy: comp.createdBy,
                            companyName: comp.name,
                            shareholderName: sh.name,
                            share: sh.share,
                            source: sh.source,
                            stage: sh.stage,
                            fullCompany: comp
                        });
                    });
                } else {
                    // Should not happen theoretically based on input logic, but safe fallback
                    rows.push({
                        id: comp.id,
                        uniqueKey: comp.id,
                        createdAt: comp.createdAt,
                        createdBy: comp.createdBy,
                        companyName: comp.name,
                        shareholderName: '-',
                        share: '-',
                        source: '-',
                        stage: '-',
                        fullCompany: comp
                    });
                }
            });
    
            // Filter
            const filtered = rows.filter(r => {
                if (!query) return true;
                return (
                    r.companyName.toLowerCase().includes(query) ||
                    r.shareholderName.toLowerCase().includes(query) ||
                    (r.stage || '').toLowerCase().includes(query)
                );
            }).filter(r => {
                if (!stageValue) return true;
                return r.stage === stageValue;
            });
    
            tableBody.innerHTML = '';
            
            if (filtered.length === 0) {
                emptyState.classList.remove('hidden');
            } else {
                emptyState.classList.add('hidden');
                
                filtered.forEach((row, idx) => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${idx + 1}</td>
                        <td>${Utils.formatDate(row.createdAt)}</td>
                        <td>${row.createdBy || '-'}</td>
                        <td>${row.companyName}</td>
                        <td>${row.shareholderName}</td>
                        <td>${row.share || '-'}</td>
                        <td>${row.source || '-'}</td>
                        <td><span class="status-tag ${getStageClass(row.stage)}">${row.stage || '-'}</span></td>
                        <td>
                            <button class="btn btn-ghost" style="padding: 4px 8px;" onclick="showDetail('${row.id}')">详情</button>
                            <button class="btn btn-ghost" style="padding: 4px 8px;" onclick="window.location.href='input.html?id=${row.id}'">修改</button>
                            ${user.role === 'admin' ? `<button class="btn btn-danger-ghost" style="padding: 4px 8px;" onclick="deleteCompany('${row.id}')">删除</button>` : ''}
                        </td>
                    `;
                    tableBody.appendChild(tr);
                });
            }
        } catch (e) {
            console.error(e);
            alert('Failed to load data');
        }
    }

    searchInput.addEventListener('input', render);
    stageFilter.addEventListener('change', render);

    // Global scope for onclick
    window.showDetail = async function(id) {
        const company = await Utils.getCompanyById(id);
        if (!company) return;

        let content = `
            <div class="form-group">
                <label>公司名称</label>
                <div style="font-weight: 600; font-size: 16px;">${company.name}</div>
            </div>
            <div class="form-group">
                <label>录入信息</label>
                <div>${company.createdBy} 于 ${Utils.formatDate(company.createdAt)}</div>
                ${company.lastModified ? `<div>最后修改: ${company.lastModifiedBy} 于 ${Utils.formatDate(company.lastModified)}</div>` : ''}
            </div>
            <hr style="border:0; border-top:1px solid #eee; margin: 16px 0;">
            <h4>股东列表 (${company.shareholders.length})</h4>
        `;

        company.shareholders.forEach((sh, idx) => {
            content += `
                <div style="background: #f9f9f9; padding: 12px; margin-bottom: 12px; border-radius: 8px;">
                    <div style="margin-bottom: 4px;"><strong>${sh.name}</strong> <span style="font-size: 12px; color: #666;">(${sh.stage})</span></div>
                    <div style="font-size: 13px; color: #555;">
                        <div>手机: ${sh.phone || '-'}</div>
                        <div>股份: ${sh.share || '-'}</div>
                        <div>来源: ${sh.source || '-'}</div>
                        ${sh.notes ? `<div style="margin-top:4px; padding-top:4px; border-top:1px dashed #ddd;">跟进情况: ${sh.notes}</div>` : ''}
                    </div>
                </div>
            `;
        });

        if (company.followHistory && company.followHistory.length > 0) {
            content += `
                <hr style="border:0; border-top:1px solid #eee; margin: 16px 0;">
                <h4>跟进记录</h4>
            `;
            company.followHistory.forEach(item => {
                content += `
                    <div style="font-size: 13px; color: #555; margin-bottom: 8px;">
                        ${Utils.formatDate(item.changedAt)} - ${item.shareholderName || '未知股东'}：${item.stage || '-'}
                    </div>
                `;
            });
        }

        detailContent.innerHTML = content;
        
        // Setup edit link
        modalEditBtn.onclick = () => {
            window.location.href = `input.html?id=${id}`;
        };

        detailModal.style.display = 'flex';
    };

    window.deleteCompany = async function(id) {
        const company = allCompanies.find(c => c.id === id);
        if (!company) {
            alert('未找到该公司');
            return;
        }

        if (user.role !== 'admin' && company.createdBy !== user.username) {
            alert('您没有权限删除此公司');
            return;
        }

        if (!confirm(`确定删除公司「${company.name}」吗？此操作不可恢复。`)) return;

        try {
            await Utils.deleteCompany(id);
            render();
        } catch (e) {
            alert(e.message || '删除失败');
        }
    };

    // Close modal on outside click
    detailModal.addEventListener('click', (e) => {
        if (e.target === detailModal) {
            detailModal.style.display = 'none';
        }
    });

    render();
});
