import Storage from './storage.js';
import Store from './store.js';

const Seed = {
    init() {
        const tenants = Storage.list('global', 'tenants');
        if (tenants.length === 0) {
            Storage.add('global', 'tenants', { id: 'tenant_demo', name: 'Demo Corredora' });
        }

        const users = Storage.list('global', 'users');
        if (users.length === 0) {
            Storage.add('global', 'users', {
                id: 'u_kensa_admin',
                uid: 'u_kensa_admin',
                displayName: 'Kensa Admin',
                email: 'admin@kensa-unpaper.com',
                role: 'admin',
                isKensaAdmin: true
            });
            Storage.add('global', 'users', {
                id: 'u_notary_1',
                uid: 'u_notary_1',
                displayName: 'Notario Principal',
                email: 'notario@kensa-unpaper.com',
                role: 'notary'
            });
            Storage.add('global', 'users', {
                id: 'u_broker_1',
                uid: 'u_broker_1',
                displayName: 'Broker Demo',
                email: 'broker@kensa-unpaper.com',
                role: 'broker'
            });
            Storage.add('global', 'users', {
                id: 'u_admin_tenant',
                uid: 'u_admin_tenant',
                displayName: 'Admin Corredora',
                email: 'admin@corredora-demo.com',
                role: 'admin'
            });
        }

        const tenantId = 'tenant_demo';
        const membershipScope = Storage.tenantScope(tenantId);
        const memberships = Storage.list(membershipScope, 'memberships');
        if (memberships.length === 0) {
            Storage.add(membershipScope, 'memberships', {
                uid: 'u_broker_1',
                role: 'broker',
                status: 'active'
            });
            Storage.add(membershipScope, 'memberships', {
                uid: 'u_admin_tenant',
                role: 'admin',
                status: 'active'
            });
        }

        // Ensure required arrays exist
        Storage.list('global', 'accessGrants');
        Storage.list('global', 'signingTokens');

        // Seed legacy store (pipeline stages, plans, demo users) for existing modules
        if (Store && typeof Store.init === 'function') {
            const session = localStorage.getItem('KensaUnpaper:session');
            if (session) {
                Store.init();
                Store.seedIfEmpty();
            }
        }
    }
};

export default Seed;
