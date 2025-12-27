/**
 * App.js
 * Main entry point.
 */
import Store from './store.js';
import Router from './router.js';

document.addEventListener('DOMContentLoaded', () => {
    Store.init();
    Router.init();

    // Global Logout Handler
    document.getElementById('logout-btn').addEventListener('click', () => {
        Store.logout();
    });

    // Update User Info in Sidebar
    const user = Store.getUser();
    if (user) {
        document.getElementById('current-user-name').innerText = user.name;
        document.getElementById('current-user-role').innerText = user.role;
        document.querySelector('.avatar').innerText = user.name.charAt(0).toUpperCase();
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
