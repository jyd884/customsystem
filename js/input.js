document.addEventListener('DOMContentLoaded', async () => {
    const user = Utils.requireAuth(); 
    if (!user) return;

    Utils.renderHeader(user);

    // DOM Elements
    const companyNameInput = document.getElementById('companyName');
    const shareholdersList = document.getElementById('shareholdersList');
    const addShareholderBtn = document.getElementById('addShareholderBtn');
    const saveBtn = document.getElementById('saveBtn');
    const template = document.getElementById('shareholderTemplate');
    const pageTitle = document.getElementById('pageTitle');
    const backBtn = document.getElementById('backBtn');

    // Parse Query Params
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('id');
    const isEditMode = !!editId;

    let currentShareholders = [];

    let currentCompany = null;
    // Initialize
    if (isEditMode) {
        try {
            const company = await Utils.getCompanyById(editId);
            if (!company) {
                alert('找不到该记录');
                window.location.href = 'dashboard.html';
                return;
            }

            // 鉴权：管理员 或者 是这条记录的创建者
            if (user.role !== 'admin' && company.createdBy !== user.username) {
                alert('您没有权限修改此记录');
                window.location.href = 'dashboard.html';
                return;
            }

            currentCompany = company;
            
            pageTitle.textContent = '修改公司信息';
            backBtn.style.display = 'inline-flex';
            backBtn.onclick = () => window.location.href = 'dashboard.html';
            backBtn.removeAttribute('href'); 
            
            companyNameInput.value = company.name;
            // Load existing shareholders
            if (company.shareholders && company.shareholders.length > 0) {
                company.shareholders.forEach(sh => addShareholder(sh));
            }
            
            // 权限控制：非管理员只能修改跟进情况和备注
            if (user.role !== 'admin') {
                companyNameInput.disabled = true;
                addShareholderBtn.style.display = 'none';
                
                // Disable specific fields in shareholder items
                const items = document.querySelectorAll('.shareholder-item');
                items.forEach(item => {
                    const inputsToDisable = [
                        item.querySelector('.sh-name'),
                        item.querySelector('.sh-phone'),
                        item.querySelector('.sh-share'),
                        item.querySelector('.sh-source')
                    ];
                    inputsToDisable.forEach(input => {
                        if(input) {
                            input.disabled = true;
                            input.style.backgroundColor = '#f5f5f5';
                            input.style.cursor = 'not-allowed';
                        }
                    });
                    
                    const removeBtn = item.querySelector('.remove-btn');
                    if (removeBtn) removeBtn.style.display = 'none';
                });
            }
            
            // Edit mode: don't force empty one if empty (though logic says at least one usually)
        } catch (e) {
            console.error(e);
            alert('获取数据失败');
        }
    } else {
        // New Entry Mode: Do NOT add default shareholder card per request
    }

    // Event Handlers
    addShareholderBtn.addEventListener('click', async () => {
        // 编辑时：仅允许管理员或该公司创建者新增股东
        if (isEditMode && currentCompany) {
            if (user.role !== 'admin' && currentCompany.createdBy !== user.username) {
                alert('您没有权限为该公司新增股东');
                return;
            }
        }

        const name = companyNameInput.value.trim();
        if (!name) {
            alert('请先填写公司名称');
            companyNameInput.focus();
            return;
        }

        // Check for duplicate company name
        try {
            // Disable button slightly
            addShareholderBtn.disabled = true;
            addShareholderBtn.textContent = '校验中...';

            const companies = await Utils.getCompanies();
            const duplicate = companies.find(c => c.name === name);
            
            if (duplicate) {
                // If in edit mode, it matches itself, that's fine.
                if (isEditMode && duplicate.id === editId) {
                    // It's this company, proceed
                } else {
                    alert('该公司已经被抢先录入了哦');
                    return;
                }
            }

            // Passed check
            addShareholder();
            
        } catch (err) {
            console.error(err);
            alert('校验公司名称失败，请重试');
        } finally {
            addShareholderBtn.disabled = false;
            addShareholderBtn.textContent = '+ 添加股东';
        }
    });

    saveBtn.addEventListener('click', async () => {
        const name = companyNameInput.value.trim();
        if (!name) {
            alert('请输入公司名称');
            return;
        }

        const shareholderItems = document.querySelectorAll('.shareholder-item');
        const shareholders = [];
        let isValid = true;
        let hasPhoneError = false;
        let hasShareError = false;
        let firstInvalidInput = null;

        shareholderItems.forEach(item => {
            const shNameInput = item.querySelector('.sh-name');
            const shPhoneInput = item.querySelector('.sh-phone');
            const shShareInput = item.querySelector('.sh-share');
            const shSourceInput = item.querySelector('.sh-source');

            const shName = shNameInput.value.trim();
            const shPhone = shPhoneInput.value.trim();
            let shShare = shShareInput.value.trim();
            const shSource = shSourceInput.value.trim();

            if (!shName || !shPhone || !shShare || !shSource) {
                isValid = false;
                if (!firstInvalidInput) {
                    firstInvalidInput = !shName
                        ? shNameInput
                        : (!shPhone ? shPhoneInput : (!shShare ? shShareInput : shSourceInput));
                }
            } else {
                // 1. Phone validation: 11 digits, starts with 1
                if (!/^1\d{10}$/.test(shPhone)) {
                    hasPhoneError = true;
                    if (!firstInvalidInput) firstInvalidInput = shPhoneInput;
                }

                // 2. Share validation and formatting
                let tempShare = shShare;
                if (tempShare.endsWith('%')) {
                    tempShare = tempShare.slice(0, -1);
                }
                
                if (isNaN(Number(tempShare)) || tempShare === '') {
                    hasShareError = true;
                    if (!firstInvalidInput) firstInvalidInput = shShareInput;
                } else {
                    // Automatically add % if missing
                    if (!shShare.endsWith('%')) {
                        shShare += '%';
                    }
                }
            }

            shareholders.push({
                id: item.dataset.id || Utils.generateId(), // Keep ID if editing existing sub-item, else new
                name: shName,
                phone: shPhone,
                share: shShare,
                stage: item.querySelector('.sh-stage').value,
                source: shSource,
                notes: item.querySelector('.sh-notes').value.trim()
            });
        });

        if (shareholders.length === 0) {
            alert('请至少添加一个股东信息');
            return;
        }

        if (!isValid) {
            alert('股东姓名、股东手机、股份占比、来源均填写后才能录入');
            if (firstInvalidInput) firstInvalidInput.focus();
            return;
        }

        if (hasPhoneError) {
            alert('手机号填写有误');
            if (firstInvalidInput) firstInvalidInput.focus();
            return;
        }
        
        if (hasShareError) {
            alert('股份占比只能填写数字');
            if (firstInvalidInput) firstInvalidInput.focus();
            return;
        }

        const data = {
            id: isEditMode ? editId : Utils.generateId(),
            name: name,
            shareholders: shareholders
        };

        if (isEditMode) {
            data.lastModified = new Date().toISOString();
            data.lastModifiedBy = user.username;
        } else {
            data.createdAt = new Date().toISOString();
            data.createdBy = user.username;
        }

        try {
            await Utils.saveCompany(data);

            if (isEditMode) {
                window.location.href = 'dashboard.html';
                return;
            }

            const continueInput = confirm('新增成功，是否继续录入？\n点击[取消]返回总览。');
            if (continueInput) {
                window.location.href = 'input.html?mode=new';
            } else {
                window.location.href = 'dashboard.html';
            }
        } catch (e) {
            alert(e.message);
        }
    });

    // Helper Functions
    function addShareholder(data = null) {
        const clone = template.content.cloneNode(true);
        const item = clone.querySelector('.shareholder-item');
        
        // Stage Select
        const select = item.querySelector('.sh-stage');
        FOLLOW_STAGES.forEach(stage => {
            const opt = document.createElement('option');
            opt.value = stage;
            opt.textContent = stage;
            select.appendChild(opt);
        });

        // Fill Data if exists
        if (data) {
            item.dataset.id = data.id;
            item.querySelector('.sh-name').value = data.name || '';
            item.querySelector('.sh-phone').value = data.phone || '';
            item.querySelector('.sh-share').value = data.share || '';
            item.querySelector('.sh-source').value = data.source || '';
            item.querySelector('.sh-notes').value = data.notes || '';
            if (data.stage) select.value = data.stage;
        }

        // Remove Handler
        item.querySelector('.remove-btn').addEventListener('click', (e) => {
            if (document.querySelectorAll('.shareholder-item').length > 1) {
                e.target.closest('.shareholder-item').remove();
                updateIndexes();
            } else {
                alert('至少保留一条股东信息');
            }
        });

        shareholdersList.appendChild(item);
        updateIndexes();
    }

    function updateIndexes() {
        const items = document.querySelectorAll('.shareholder-item');
        items.forEach((item, index) => {
            item.querySelector('.shareholder-count').textContent = `股东 #${index + 1}`;
        });
    }
});
