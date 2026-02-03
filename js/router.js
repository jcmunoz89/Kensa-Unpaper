/**
 * Router.js
 * Handles hash-based routing, page loading, and controller execution.
 */
import Auth from './auth.js';

const Router = {
    routes: {
        'login': { view: 'pages/login.html', controller: 'login.js', public: true, title: 'Iniciar Sesión' },
        'dashboard': { view: 'pages/dashboard.html', controller: 'dashboard.js', tenantRequired: true },
        'procedures': { view: 'pages/procedures.html', controller: 'procedures.js', tenantRequired: true, title: 'Trámites' },
        'procedure-detail': { view: 'pages/procedure-detail.html', controller: 'procedure-detail.js', tenantRequired: true, title: 'Detalle Trámite' },
        'clients': { view: 'pages/clients.html', controller: 'clients.js', tenantRequired: true },
        'client-detail': { view: 'pages/client-detail.html', controller: 'client-detail.js', tenantRequired: true },
        'properties': { view: 'pages/properties.html', controller: 'properties.js', tenantRequired: true },
        'property-detail': { view: 'pages/property-detail.html', controller: 'property-detail.js', tenantRequired: true },
        'deals': { view: 'pages/deals.html', controller: 'deals.js', tenantRequired: true },
        'deal-detail': { view: 'pages/deal-detail.html', controller: 'deal-detail.js', tenantRequired: true },
        'documents': { view: 'pages/documents.html', controller: 'documents.js', tenantRequired: true },
        'document-editor': { view: 'pages/document-editor.html', controller: 'document-editor.js', tenantRequired: true },
        'signatures': { view: 'pages/signatures.html', controller: 'signatures.js', tenantRequired: true },
        'notary': { view: 'pages/notary.html', controller: 'notary.js', tenantRequired: true },
        'notary-inbox': { view: 'pages/notary-inbox.html', controller: 'notary-inbox.js', roles: ['notary', 'admin'], title: 'Bandeja Notario' },
        'audit': { view: 'pages/audit.html', controller: 'audit.js', tenantRequired: true },
        'users': { view: 'pages/users.html', controller: 'users.js', tenantRequired: true, title: 'Administrador de Usuarios' },
        'admin': { view: 'pages/admin.html', controller: 'admin.js', tenantRequired: true },
        'billing': { view: 'pages/billing.html', controller: 'billing.js', title: 'Facturación' },
        'webhook-simulator': { view: 'pages/webhook-simulator.html', controller: 'webhook-simulator.js', tenantRequired: true },
        'sign': { view: 'pages/sign.html', controller: 'sign.js', public: true, title: 'Firma Externa' }
    },

    init() {
        window.addEventListener('hashchange', () => this.loadRoute());
        this.loadRoute();
    },

    syncSidebar(session) {
        const nameEl = document.getElementById('current-user-name');
        const roleEl = document.getElementById('current-user-role');
        const avatarEl = document.querySelector('.avatar');
        if (nameEl && roleEl && avatarEl) {
            const displayName = session.displayName || session.uid || 'Usuario';
            const roleLabel = session.isKensaAdmin ? 'Kensa Admin' : session.role;
            nameEl.innerText = displayName;
            roleEl.innerText = roleLabel;
            avatarEl.innerText = displayName.charAt(0).toUpperCase();
        }

        document.querySelectorAll('[data-visible-for]').forEach(item => {
            const roles = item.dataset.visibleFor.split(',').map(r => r.trim());
            const isVisible = session.isKensaAdmin || roles.includes(session.role);
            const tenantOnly = item.dataset.tenantOnly === 'true';
            const hideForKensa = session.isKensaAdmin && tenantOnly && !session.tenantId;
            item.style.display = isVisible ? '' : 'none';
            if (hideForKensa) item.style.display = 'none';
        });
    },

    async loadRoute() {
        let hash = window.location.hash.slice(1) || 'dashboard';
        const [route] = hash.split('?');

        const config = this.routes[route];
        if (!config) {
            console.error('Route not found:', route);
            return;
        }

        const session = Auth.getSession();
        const isPublic = config.public === true;

        // Auth Guard
        if (!isPublic && !session) {
            window.location.hash = 'login';
            return;
        }
        if (route === 'login' && session) {
            window.location.hash = session.role === 'notary' ? 'notary-inbox' : 'dashboard';
            return;
        }
        if (config.roles && session) {
            const allowed = session.isKensaAdmin || config.roles.includes(session.role);
            if (!allowed) {
                window.location.hash = session.role === 'notary' ? 'notary-inbox' : 'dashboard';
                return;
            }
        }
        if (config.tenantRequired && session && !session.tenantId) {
            if (session.isKensaAdmin) {
                window.location.hash = 'billing';
            } else {
                window.location.hash = 'login';
            }
            return;
        }

        if (session) {
            this.syncSidebar(session);
        }

        // Layout Management
        if (route === 'login') {
            document.body.classList.add('login-view');
        } else {
            document.body.classList.remove('login-view');
        }
        if (route === 'sign') {
            document.body.classList.add('sign-view');
        } else {
            document.body.classList.remove('sign-view');
        }

        // Update Sidebar Active State
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        const activeLink = document.querySelector(`.nav-item[href="#${route}"]`);
        if (activeLink) activeLink.classList.add('active');

        // Load View
        try {
            const response = await fetch(config.view);
            const html = await response.text();
            document.getElementById('content-area').innerHTML = html;

            // Update Title
            const title = config.title || (route.charAt(0).toUpperCase() + route.slice(1).replace('-', ' '));
            const titleEl = document.getElementById('page-title');
            if (titleEl) titleEl.innerText = title;

            // Load & Execute Controller
            if (config.controller) {
                try {
                    const module = await import(`./controllers/${config.controller}?t=${Date.now()}`);
                    if (module.default && typeof module.default.init === 'function') {
                        module.default.init();
                    }
                } catch (err) {
                    console.error(`Error loading controller ${config.controller}:`, err);
                }
            }

        } catch (error) {
            console.error('Error loading page:', error);
            document.getElementById('content-area').innerHTML = '<h2>Error cargando la página</h2>';
        }
    }
};

export default Router;
