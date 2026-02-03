import Storage from '../storage.js';
import Auth from '../auth.js';
import Store from '../store.js';

const LoginController = {
    init() {
        const form = document.getElementById('login-form');
        const modeSelect = document.getElementById('login-mode');
        const tenantFields = document.getElementById('tenant-fields');
        const globalFields = document.getElementById('global-fields');
        const tenantSelect = document.getElementById('tenant-select');
        const memberSelect = document.getElementById('member-select');
        const globalSelect = document.getElementById('global-user-select');

        const tenants = Storage.list('global', 'tenants');
        tenantSelect.innerHTML = '';
        tenants.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.innerText = t.name;
            tenantSelect.appendChild(opt);
        });

        const loadMemberships = () => {
            const tenantId = tenantSelect.value;
            const membershipScope = Storage.tenantScope(tenantId);
            const memberships = Storage.list(membershipScope, 'memberships');
            const users = Storage.list('global', 'users');
            memberSelect.innerHTML = '';
            memberships.forEach(m => {
                const user = users.find(u => u.uid === m.uid);
                if (!user) return;
                const opt = document.createElement('option');
                opt.value = m.uid;
                opt.dataset.role = m.role;
                opt.innerText = `${user.displayName} (${m.role})`;
                memberSelect.appendChild(opt);
            });
        };

        const loadGlobalUsers = (roleFilter) => {
            const users = Storage.list('global', 'users');
            const filtered = users.filter(u => roleFilter === 'kensa_admin' ? u.isKensaAdmin : u.role === roleFilter);
            globalSelect.innerHTML = '';
            filtered.forEach(u => {
                const opt = document.createElement('option');
                opt.value = u.uid;
                opt.innerText = u.displayName;
                globalSelect.appendChild(opt);
            });
        };

        const syncMode = () => {
            const mode = modeSelect.value;
            if (mode === 'tenant') {
                tenantFields.style.display = 'block';
                globalFields.style.display = 'none';
                loadMemberships();
            } else {
                tenantFields.style.display = 'none';
                globalFields.style.display = 'block';
                loadGlobalUsers(mode === 'kensa_admin' ? 'kensa_admin' : 'notary');
            }
        };

        if (tenantSelect) tenantSelect.addEventListener('change', loadMemberships);
        if (modeSelect) modeSelect.addEventListener('change', syncMode);

        syncMode();

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const mode = modeSelect.value;
                let session = null;

                if (mode === 'tenant') {
                    const tenantId = tenantSelect.value;
                    const uid = memberSelect.value;
                    const users = Storage.list('global', 'users');
                    const user = users.find(u => u.uid === uid);
                    const membershipScope = Storage.tenantScope(tenantId);
                    const memberships = Storage.list(membershipScope, 'memberships');
                    const membership = memberships.find(m => m.uid === uid);

                    if (!user || !membership) return;

                    session = {
                        uid: user.uid,
                        role: membership.role,
                        tenantId,
                        displayName: user.displayName,
                        email: user.email
                    };
                } else if (mode === 'kensa_admin') {
                    const uid = globalSelect.value;
                    const users = Storage.list('global', 'users');
                    const user = users.find(u => u.uid === uid && u.isKensaAdmin);
                    if (!user) return;
                    session = {
                        uid: user.uid,
                        role: 'admin',
                        isKensaAdmin: true,
                        displayName: user.displayName,
                        email: user.email
                    };
                } else if (mode === 'notary') {
                    const uid = globalSelect.value;
                    const users = Storage.list('global', 'users');
                    const user = users.find(u => u.uid === uid && u.role === 'notary');
                    if (!user) return;
                    session = {
                        uid: user.uid,
                        role: 'notary',
                        displayName: user.displayName,
                        email: user.email
                    };
                }

                if (!session) return;
                Auth.setSession(session);
                Store.init();
                Store.seedIfEmpty();
                window.location.hash = session.role === 'notary' ? 'notary-inbox' : 'dashboard';
            });
        }
    }
};

export default LoginController;
