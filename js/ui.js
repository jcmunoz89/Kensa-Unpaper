/**
 * UI.js
 * Helper functions for UI components.
 */

const UI = {
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.style.borderLeftColor = `var(--${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'primary'})`;

        const title = document.createElement('div');
        title.style.fontWeight = '600';
        title.style.marginBottom = '4px';
        title.textContent = String(type || 'info').toUpperCase();

        const body = document.createElement('div');
        body.textContent = String(message || '');

        toast.appendChild(title);
        toast.appendChild(body);

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    escapeHTML(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    sanitizeRichHTML(html) {
        if (!html) return '';
        const template = document.createElement('template');
        template.innerHTML = String(html);

        // Remove active/scriptable nodes.
        template.content.querySelectorAll('script, style, iframe, object, embed, link, meta, base').forEach((node) => node.remove());

        const walk = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
        while (walk.nextNode()) {
            const node = walk.currentNode;
            const attrs = Array.from(node.attributes);
            attrs.forEach((attr) => {
                const name = attr.name.toLowerCase();
                const value = attr.value.trim().toLowerCase();
                const isEventHandler = name.startsWith('on');
                const isJsUrl = (name === 'href' || name === 'src' || name === 'xlink:href') && value.startsWith('javascript:');
                if (isEventHandler || isJsUrl) {
                    node.removeAttribute(attr.name);
                }
            });
        }

        return template.innerHTML;
    },

    formatCurrency(amount) {
        return this.formatMoney(amount, 'CLP');
    },

    formatMoney(amount, currency = 'CLP') {
        const numericAmount = Number(amount);
        if (!Number.isFinite(numericAmount)) return '-';

        if (currency === 'UF') {
            return `UF ${new Intl.NumberFormat('es-CL', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(numericAmount)}`;
        }

        try {
            return new Intl.NumberFormat('es-CL', { style: 'currency', currency }).format(numericAmount);
        } catch (err) {
            return `${new Intl.NumberFormat('es-CL').format(numericAmount)} ${currency}`;
        }
    },

    formatDate(dateString) {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('es-CL');
    },

    createEmptyState(message, icon = '📭') {
        return `
            <div class="empty-state">
                <div class="empty-icon">${this.escapeHTML(icon)}</div>
                <p>${this.escapeHTML(message)}</p>
            </div>
        `;
    },

    async copyToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch (err) {
            // fallback below
        }

        const temp = document.createElement('textarea');
        temp.value = text;
        temp.style.position = 'fixed';
        temp.style.opacity = '0';
        document.body.appendChild(temp);
        temp.focus();
        temp.select();
        let success = false;
        try {
            success = document.execCommand('copy');
        } catch (err) {
            success = false;
        }
        document.body.removeChild(temp);
        return success;
    }
};

export default UI;
