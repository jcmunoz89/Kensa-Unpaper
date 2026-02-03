import Storage from '../storage.js';
import Auth from '../auth.js';

const AuditController = {
    init() {
        const tenantId = Auth.getTenantId();
        if (!tenantId) return;
        const scope = Storage.tenantScope(tenantId);
        const events = Storage.list(scope, 'audit_events').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const tbody = document.getElementById('audit-list');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (events.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem;">No hay registros de auditoría.</td></tr>';
            return;
        }

        events.forEach(e => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(e.createdAt).toLocaleString()}</td>
                <td>${e.actorUid || 'System'}</td>
                <td><span class="badge badge-neutral">${e.action}</span></td>
                <td>${e.procedureId || '-'}</td>
                <td>${e.meta ? JSON.stringify(e.meta) : ''}</td>
            `;
            tbody.appendChild(tr);
        });
    }
};

export default AuditController;
