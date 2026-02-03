import Storage from '../storage.js';
import Auth from '../auth.js';
import UI from '../ui.js';
import StateMachine from '../stateMachine.js';
import Audit from '../audit.js';

const statusBadgeMap = {
    notary_pending: 'info',
    notary_in_review: 'warning',
    notary_approved: 'success',
    rejected: 'danger'
};

const NotaryInboxController = {
    init() {
        this.session = Auth.getSession();
        this.renderInbox();
    },

    renderInbox() {
        const list = document.getElementById('notary-inbox-list');
        const empty = document.getElementById('notary-inbox-empty');
        if (!list) return;

        const grants = Storage.list('global', 'accessGrants');
        const now = new Date();
        const activeGrants = grants.filter(g => {
            if (g.status !== 'active') return false;
            if (g.expiresAt && new Date(g.expiresAt) < now) return false;
            if (this.session?.isKensaAdmin) return true;
            return g.granteeUid === this.session?.uid;
        });

        list.innerHTML = '';

        if (activeGrants.length === 0) {
            empty.style.display = 'block';
            empty.innerHTML = UI.createEmptyState('No hay trámites asignados.', '📥');
            return;
        }

        empty.style.display = 'none';

        activeGrants.forEach(grant => {
            const scope = Storage.tenantScope(grant.tenantId);
            const procedure = Storage.findById(scope, 'procedures', grant.procedureId);
            if (!procedure) return;

            const packet = procedure.notaryPacket || {};
            const badge = statusBadgeMap[procedure.status] || 'neutral';

            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div class="card-body" style="display: flex; flex-direction: column; gap: var(--space-sm);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-weight: 600;">${packet.deal?.name || 'Trámite'}</div>
                        <span class="badge badge-${badge}">${procedure.status}</span>
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">
                        Tenant: ${grant.tenantId} • Cliente: ${packet.tenant?.name || '-'}
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">
                        Documento: ${packet.documentVersionRef?.title || '-'} v${packet.documentVersionRef?.version || '-'}
                    </div>
                    <div style="display: flex; gap: var(--space-sm);">
                        <button class="btn btn-sm btn-secondary" data-action="open">Abrir revisión</button>
                        <button class="btn btn-sm btn-primary" data-action="approve">Subir legalizado</button>
                        <button class="btn btn-sm btn-ghost" data-action="reject" style="color: var(--danger);">Rechazar</button>
                    </div>
                </div>
            `;

            card.querySelector('[data-action="open"]').addEventListener('click', () => {
                this.applyNotaryEvent(procedure, grant, 'NOTARY_OPENS');
            });
            card.querySelector('[data-action="approve"]').addEventListener('click', () => {
                const fileName = window.prompt('Nombre del archivo legalizado', `legalizado_${procedure.id}.pdf`);
                if (!fileName) return;
                this.applyNotaryEvent(procedure, grant, 'NOTARY_UPLOAD_APPROVE', { fileName });
            });
            card.querySelector('[data-action="reject"]').addEventListener('click', () => {
                const reason = window.prompt('Motivo de rechazo');
                if (!reason) return;
                this.applyNotaryEvent(procedure, grant, 'NOTARY_REJECT', { reason });
            });

            list.appendChild(card);
        });
    },

    applyNotaryEvent(procedure, grant, event, payload = {}) {
        const scope = Storage.tenantScope(grant.tenantId);
        const scopeMap = {
            NOTARY_OPENS: 'notary:read',
            NOTARY_UPLOAD_APPROVE: 'notary:upload_legalized',
            NOTARY_REJECT: 'notary:reject'
        };
        const requiredScope = scopeMap[event];
        if (requiredScope && !grant.scopes.includes(requiredScope)) {
            UI.showToast('No tienes permisos para esta acción', 'error');
            return;
        }
        try {
            const updated = StateMachine.transition(procedure, event);
            Storage.update(scope, 'procedures', procedure.id, updated);

            const notaryRequests = Storage.list(scope, 'notary_requests');
            let request = notaryRequests.find(r => r.procedureId === procedure.id);
            if (!request) {
                request = Storage.add(scope, 'notary_requests', {
                    procedureId: procedure.id,
                    notaryUid: grant.granteeUid,
                    status: 'created'
                });
            }

            if (event === 'NOTARY_OPENS') {
                Storage.update(scope, 'notary_requests', request.id, { status: 'in_review', openedAt: new Date().toISOString() });
            }
            if (event === 'NOTARY_UPLOAD_APPROVE') {
                Storage.update(scope, 'notary_requests', request.id, {
                    status: 'approved',
                    notarizedPdfUploaded: true,
                    legalizedFileName: payload.fileName,
                    uploadedAt: new Date().toISOString()
                });
            }
            if (event === 'NOTARY_REJECT') {
                Storage.update(scope, 'notary_requests', request.id, {
                    status: 'rejected',
                    rejectedAt: new Date().toISOString(),
                    reason: payload.reason
                });
            }

            Audit.append(grant.tenantId, { action: event, procedureId: procedure.id, meta: payload });
            UI.showToast('Acción notarial aplicada', 'success');
            this.renderInbox();
        } catch (err) {
            UI.showToast(err.message, 'error');
        }
    }
};

export default NotaryInboxController;
