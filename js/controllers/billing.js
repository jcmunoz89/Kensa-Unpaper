import Storage from '../storage.js';
import Auth from '../auth.js';
import UI from '../ui.js';

const BillingController = {
    init() {
        const session = Auth.getSession();
        const tenantSelectWrapper = document.getElementById('billing-tenant-select-wrapper');
        const tenantSelect = document.getElementById('billing-tenant-select');

        if (session?.isKensaAdmin) {
            tenantSelectWrapper.style.display = 'block';
            const tenants = Storage.list('global', 'tenants');
            tenantSelect.innerHTML = '';
            tenants.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.id;
                opt.innerText = t.name;
                tenantSelect.appendChild(opt);
            });
            tenantSelect.addEventListener('change', () => this.renderEvents(tenantSelect.value));
            if (tenants.length > 0) this.renderEvents(tenants[0].id);
        } else {
            const tenantId = session?.tenantId;
            if (tenantId) this.renderEvents(tenantId);
        }

        const btn = document.getElementById('btn-change-plan');
        if (btn) {
            btn.addEventListener('click', () => {
                UI.showToast('Funcionalidad de cambio de plan simulada.', 'info');
            });
        }
    },

    renderEvents(tenantId) {
        const scope = Storage.tenantScope(tenantId);
        const events = Storage.list(scope, 'billing_events');
        const tbody = document.getElementById('billing-events-list');
        const empty = document.getElementById('billing-events-empty');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (events.length === 0) {
            empty.style.display = 'block';
            empty.innerHTML = UI.createEmptyState('No hay eventos de facturación.', '💳');
            return;
        }

        empty.style.display = 'none';
        events.forEach(e => {
            const tr = document.createElement('tr');
            const safeType = UI.escapeHTML(e.type || '-');
            const safeProcedureId = UI.escapeHTML(e.procedureId || '-');
            const currency = e.currency || 'CLP';
            tr.innerHTML = `
                <td>${new Date(e.createdAt).toLocaleDateString()}</td>
                <td>${safeType}</td>
                <td>${safeProcedureId}</td>
                <td>${UI.formatMoney(e.amount, currency)}</td>
            `;
            tbody.appendChild(tr);
        });
    }
};

export default BillingController;
