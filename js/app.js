/**
 * App.js
 * Main entry point.
 */
import Store from './store.js';
import Router from './router.js';
import Auth from './auth.js';
import Seed from './seed.js';

document.addEventListener('DOMContentLoaded', () => {
    Seed.init();
    Store.init();
    Router.init();

    // Global Logout Handler
    document.getElementById('logout-btn').addEventListener('click', () => {
        Store.logout();
    });

    // Update User Info in Sidebar
    const session = Auth.getSession();
    if (session) {
        const displayName = session.displayName || session.uid || 'Usuario';
        const roleLabel = session.isKensaAdmin ? 'Kensa Admin' : session.role;
        document.getElementById('current-user-name').innerText = displayName;
        document.getElementById('current-user-role').innerText = roleLabel;
        document.querySelector('.avatar').innerText = displayName.charAt(0).toUpperCase();
        applyNavVisibility(session);
    }

    // Mobile Sidebar Toggle
    const menuToggle = document.getElementById('menu-toggle');
    const closeSidebar = document.getElementById('close-sidebar');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    function toggleSidebar() {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('open');
    }

    if (menuToggle) menuToggle.addEventListener('click', toggleSidebar);
    if (closeSidebar) closeSidebar.addEventListener('click', toggleSidebar);
    if (overlay) overlay.addEventListener('click', toggleSidebar);

    // Auto-close sidebar on mobile navigation
    document.querySelectorAll('.nav-item').forEach(link => {
        link.addEventListener('click', () => {
            if (sidebar && sidebar.classList.contains('open')) {
                toggleSidebar();
            }
        });
    });
});

function applyNavVisibility(session) {
    document.querySelectorAll('[data-visible-for]').forEach(item => {
        const roles = item.dataset.visibleFor.split(',').map(r => r.trim());
        const isVisible = session.isKensaAdmin || roles.includes(session.role);
        const tenantOnly = item.dataset.tenantOnly === 'true';
        const hideForKensa = session.isKensaAdmin && tenantOnly && !session.tenantId;
        item.style.display = isVisible ? '' : 'none';
        if (hideForKensa) item.style.display = 'none';
    });
}
