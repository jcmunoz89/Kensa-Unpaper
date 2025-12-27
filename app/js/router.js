/**
 * Router.js
 * Handles hash-based routing, page loading, and controller execution.
 */
import Store from './store.js';

const Router = {
    routes: {
        'login': { view: 'pages/login.html', controller: 'login.js' },
        'dashboard': { view: 'pages/dashboard.html', controller: 'dashboard.js' },
        'clients': { view: 'pages/clients.html', controller: 'clients.js' },
        'client-detail': { view: 'pages/client-detail.html', controller: 'client-detail.js' },
        'properties': { view: 'pages/properties.html', controller: 'properties.js' },
        'property-detail': { view: 'pages/property-detail.html', controller: 'property-detail.js' },
        'deals': { view: 'pages/deals.html', controller: 'deals.js' },
        'deal-detail': { view: 'pages/deal-detail.html', controller: 'deal-detail.js' },
        'documents': { view: 'pages/documents.html', controller: 'documents.js' }, // List view if needed
        'document-editor': { view: 'pages/document-editor.html', controller: 'document-editor.js' },
        'signatures': { view: 'pages/signatures.html', controller: 'signatures.js' },
        'notary': { view: 'pages/notary.html', controller: 'notary.js' },
        'audit': { view: 'pages/audit.html', controller: 'audit.js' },
        'admin': { view: 'pages/admin.html', controller: 'admin.js' },
        'billing': { view: 'pages/billing.html', controller: 'billing.js' },
        'webhook-simulator': { view: 'pages/webhook-simulator.html', controller: 'webhook-simulator.js' }
    },

    init() {
        window.addEventListener('hashchange', () => this.loadRoute());
        this.loadRoute();
    },

    async loadRoute() {
        let hash = window.location.hash.slice(1) || 'dashboard';
        const [route, query] = hash.split('?');

        // Auth Guard
        if (route !== 'login' && !Store.getUser()) {
            window.location.hash = 'login';
            return;
        }
        if (route === 'login' && Store.getUser()) {
            window.location.hash = 'dashboard';
            return;
        }

        const config = this.routes[route];
        if (!config) {
            console.error('Route not found:', route);
            return;
        }

        // Layout Management
        if (route === 'login') {
            document.body.classList.add('login-view');
        } else {
            document.body.classList.remove('login-view');
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
            const title = route.charAt(0).toUpperCase() + route.slice(1).replace('-', ' ');
            document.getElementById('page-title').innerText = title;

            // Load & Execute Controller
            if (config.controller) {
                try {
                    // Dynamic import of the controller
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
