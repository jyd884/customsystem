document.addEventListener('DOMContentLoaded', () => {
    // Check if already logged in
    const currentUser = Utils.getCurrentUser();
    if (currentUser) {
        window.location.href = 'input.html?mode=new';
        return;
    }

    const tabs = document.querySelectorAll('.auth-tab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    // Tab Switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            if (tab.dataset.tab === 'login') {
                loginForm.classList.remove('hidden');
                registerForm.classList.add('hidden');
            } else {
                loginForm.classList.add('hidden');
                registerForm.classList.remove('hidden');
            }
        });
    });

    // Login Handler
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = loginForm.username.value.trim();
        const password = loginForm.password.value.trim();

        const user = await Utils.login(username, password);
        if (user) {
            window.location.href = 'input.html?mode=new';
        } else {
            alert('用户名或密码错误');
        }
    });

    // Register Handler
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = registerForm.reg_username.value.trim();
        const password = registerForm.reg_password.value.trim();
        const role = 'user'; // 强制默认为普通用户

        try {
            await Utils.register(username, password, role);
            alert('注册成功，请直接登录');
            // Switch to login tab
            tabs[0].click(); 
        } catch (err) {
            alert(err.message);
        }
    });
});
