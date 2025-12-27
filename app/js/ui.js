/**
 * UI.js
 * Helper functions for UI components.
 */

const UI = {
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.style.borderLeftColor = `var(--${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'primary'})`;
        toast.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 4px;">${type.toUpperCase()}</div>
            <div>${message}</div>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
    },

    formatDate(dateString) {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('es-CL');
    },

    createEmptyState(message, icon = '📭') {
        return `
            <div class="empty-state">
                <div class="empty-icon">${icon}</div>
                <p>${message}</p>
            </div>
        `;
    }
};

export default UI;
