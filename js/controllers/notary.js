import Storage from '../storage.js';
import Auth from '../auth.js';
import UI from '../ui.js?v=2';

const statusBadgeMap = {
    notary_pending: 'info',
    notary_in_review: 'warning',
    notary_approved: 'success',
    rejected: 'danger'
};

const NotaryController = {
    init() {
        const tenantId = Auth.getTenantId();
        if (!tenantId) return;

        const scope = Storage.tenantScope(tenantId);
        const procedures = Storage.list(scope, 'procedures').filter(p => p.notaryRequired);
        const tbody = document.getElementById('notary-list');
        const empty = document.getElementById('notary-empty');

        if (!tbody) return;

        if (procedures.length === 0) {
            tbody.parentElement.style.display = 'none';
            empty.style.display = 'block';
            empty.innerHTML = UI.createEmptyState('No hay trámites con notaría.', '⚖️');
            return;
        }

        tbody.parentElement.style.display = 'table';
        empty.style.display = 'none';
        tbody.innerHTML = '';

        procedures.forEach(proc => {
            const badge = statusBadgeMap[proc.status] || 'neutral';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${proc.notaryPacket?.documentVersionRef?.title || '-'}</td>
                <td>${proc.notaryPacket?.deal?.name || '-'}</td>
                <td><span class="badge badge-${proc.flags?.signaturesOk ? 'success' : 'warning'}">${proc.flags?.signaturesOk ? 'Firmado' : 'Pendiente'}</span></td>
                <td><span class="badge badge-${badge}">${proc.status}</span></td>
                <td>${proc.assignedNotary || 'Sin asignar'}</td>
            `;
            tbody.appendChild(tr);
        });
    }
};

export default NotaryController;
