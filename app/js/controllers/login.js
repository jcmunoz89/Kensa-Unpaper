import Store from '../store.js';

const LoginController = {
    init() {
        const form = document.getElementById('login-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const tenant = document.getElementById('tenant-input').value;
                const userId = document.getElementById('user-select').value;

                let user;
                if (userId === 'u1') user = { id: 'u1', name: 'Admin User', role: 'admin', email: 'admin@propsaas.com' };
                if (userId === 'u2') user = { id: 'u2', name: 'Juan Agente', role: 'agent', email: 'juan@propsaas.com' };
                if (userId === 'u3') user = { id: 'u3', name: 'Maria Supervisor', role: 'supervisor', email: 'maria@propsaas.com' };

                Store.login(tenant, user);
                window.location.hash = 'dashboard';
            });
        }
    }
};

export default LoginController;
