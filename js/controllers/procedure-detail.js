import Storage from '../storage.js';
import Auth from '../auth.js';
import UI from '../ui.js';
import StateMachine from '../stateMachine.js';
import Audit from '../audit.js';
import Billing from '../billing.js';
import Providers from '../providers.js';

const statusBadgeMap = {
    draft: 'neutral',
    ready_to_send: 'info',
    in_identity: 'warning',
    in_payment: 'warning',
    in_signature: 'info',
    partially_signed: 'warning',
    fully_signed: 'success',
    notary_pending: 'info',
    notary_in_review: 'warning',
    notary_approved: 'success',
    completed: 'success',
    cancelled: 'danger',
    expired: 'danger',
    rejected: 'danger'
};

const ProceduresDetailController = {
    init() {
        this.tenantId = Auth.getTenantId();
        const params = new URLSearchParams(window.location.hash.split('?')[1]);
        this.procedureId = params.get('id');
        if (!this.tenantId || !this.procedureId) return;

        this.scope = Storage.tenantScope(this.tenantId);
        this.loadProcedure();
        this.bindGrantModal();
    },

    loadProcedure() {
        this.procedure = Storage.findById(this.scope, 'procedures', this.procedureId);
        if (!this.procedure) {
            document.getElementById('procedure-detail').innerHTML = UI.createEmptyState('Trámite no encontrado', '🧾');
            return;
        }

        this.renderHeader();
        this.renderSummary();
        this.renderPacket();
        this.renderSignatureRequests();
        this.renderTimeline();
        this.renderGrants();
    },

    renderHeader() {
        document.getElementById('procedure-title').innerText = this.procedure.notaryPacket?.deal?.name || 'Trámite';
        document.getElementById('procedure-subtitle').innerText = this.procedure.notaryPacket?.tenant?.name || '-';
        document.getElementById('procedure-id').innerText = this.procedure.id;
        const badge = statusBadgeMap[this.procedure.status] || 'neutral';
        const badgeEl = document.getElementById('procedure-status');
        badgeEl.className = `badge badge-${badge}`;
        badgeEl.innerText = this.procedure.status;
    },

    renderSummary() {
        document.getElementById('procedure-identity').innerText = this.procedure.identityPolicy?.mode || 'none';
        document.getElementById('procedure-payment').innerText = this.procedure.paymentPolicy?.requireBeforeSignature ? 'Requerido' : 'No requerido';
        document.getElementById('procedure-notary').innerText = this.procedure.notaryRequired ? 'Sí' : 'No';
        const notaryUser = Storage.list('global', 'users').find(u => u.uid === this.procedure.assignedNotary);
        document.getElementById('procedure-notary-user').innerText = notaryUser ? notaryUser.displayName : 'Sin asignar';

        const actions = document.getElementById('procedure-actions');
        actions.innerHTML = '';

        const addAction = (label, handler, style = 'btn-secondary') => {
            const btn = document.createElement('button');
            btn.className = `btn ${style}`;
            btn.innerText = label;
            btn.addEventListener('click', handler);
            actions.appendChild(btn);
        };

        if (this.procedure.status === 'draft') {
            addAction('Config. Lista', () => this.handleTransition('CONFIG_DONE'));
        }
        if (this.procedure.status === 'ready_to_send') {
            addAction('Enviar Invitaciones', () => this.handleSendInvites(), 'btn-primary');
        }
        if (this.procedure.status === 'fully_signed' && this.procedure.notaryRequired) {
            addAction('Abrir Notaría', () => this.handleTransition('OPEN_NOTARY'), 'btn-primary');
        }
        if (this.procedure.status === 'notary_approved') {
            addAction('Completar', () => this.handleComplete(), 'btn-primary');
        }
        if (this.procedure.status === 'fully_signed' && !this.procedure.notaryRequired) {
            addAction('Completar', () => this.handleComplete(), 'btn-primary');
        }
        if (!['completed', 'cancelled', 'expired', 'rejected'].includes(this.procedure.status)) {
            addAction('Cancelar', () => this.handleTransition('CANCEL'), 'btn-ghost');
        }
    },

    renderPacket() {
        const packet = this.procedure.notaryPacket || {};
        const container = document.getElementById('procedure-packet');
        container.innerHTML = `
            <div style="margin-bottom: var(--space-md);">
                <strong>Cliente</strong><br>
                ${packet.tenant?.name || '-'}<br>
                ${packet.tenant?.rut || ''}<br>
                ${packet.tenant?.email || ''}
            </div>
            <div style="margin-bottom: var(--space-md);">
                <strong>Propiedad</strong><br>
                ${packet.property?.address || '-'}<br>
                ROL: ${packet.property?.rol || '-'}<br>
                UF ${packet.property?.price || '-'}
            </div>
            <div>
                <strong>Documento</strong><br>
                ${packet.documentVersionRef?.title || '-'} v${packet.documentVersionRef?.version || '-'}<br>
                Hash: ${packet.documentVersionRef?.hash ? packet.documentVersionRef.hash.substring(0, 12) : '-'}
            </div>
        `;
    },

    renderSignatureRequests() {
        const container = document.getElementById('signature-requests');
        const requests = Storage.list(this.scope, 'signature_requests').filter(r => r.procedureId === this.procedure.id);
        if (requests.length === 0) {
            container.innerHTML = UI.createEmptyState('No hay solicitudes de firma.', '✍️');
            return;
        }
        container.innerHTML = '';
        requests.forEach(req => {
            const card = document.createElement('div');
            card.style.padding = '12px';
            card.style.border = '1px solid var(--border)';
            card.style.borderRadius = 'var(--radius-md)';
            card.style.display = 'flex';
            card.style.justifyContent = 'space-between';
            card.style.alignItems = 'center';

            const statusBadge = req.status === 'signed' ? 'success' : 'warning';

            card.innerHTML = `
                <div>
                    <div style="font-weight: 600;">${req.participant?.name || 'Firmante'}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${req.participant?.email || '-'}</div>
                </div>
                <div style="display: flex; align-items: center; gap: var(--space-sm);">
                    <span class="badge badge-${statusBadge}">${req.status}</span>
                    <button class="btn btn-sm btn-secondary" data-action="token">Generar Link</button>
                </div>
            `;

            card.querySelector('[data-action="token"]').addEventListener('click', () => {
                const token = this.createSigningToken(req);
                const link = `${window.location.origin}${window.location.pathname}#sign?token=${token}`;
                window.prompt('Link de firma externa', link);
            });

            container.appendChild(card);
        });
    },

    renderTimeline() {
        const events = Storage.list(this.scope, 'audit_events').filter(e => e.procedureId === this.procedure.id);
        const container = document.getElementById('procedure-timeline');
        if (events.length === 0) {
            container.innerHTML = UI.createEmptyState('Sin eventos registrados.', '🕒');
            return;
        }
        container.innerHTML = '';
        events.slice().reverse().forEach(e => {
            const item = document.createElement('div');
            item.style.padding = '8px';
            item.style.border = '1px solid var(--border)';
            item.style.borderRadius = 'var(--radius-md)';
            item.innerHTML = `
                <div style="font-weight: 600; font-size: 0.85rem;">${e.action}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${new Date(e.createdAt).toLocaleString()}</div>
            `;
            container.appendChild(item);
        });
    },

    renderGrants() {
        const grants = Storage.list('global', 'accessGrants').filter(g => g.procedureId === this.procedure.id && g.tenantId === this.tenantId);
        const users = Storage.list('global', 'users');
        const container = document.getElementById('grant-list');
        const btnGrant = document.getElementById('btn-create-grant');
        if (!this.procedure.notaryRequired) {
            if (btnGrant) btnGrant.style.display = 'none';
        }
        container.innerHTML = '';
        if (grants.length === 0) {
            container.innerHTML = UI.createEmptyState('No hay grants activos.', '🔑');
        } else {
            grants.forEach(g => {
                const user = users.find(u => u.uid === g.granteeUid);
                const item = document.createElement('div');
                item.style.padding = '8px';
                item.style.border = '1px solid var(--border)';
                item.style.borderRadius = 'var(--radius-md)';
                item.innerHTML = `
                    <div style="font-weight: 600;">${user ? user.displayName : g.granteeUid}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${g.status} • expira ${new Date(g.expiresAt).toLocaleDateString()}</div>
                `;
                container.appendChild(item);
            });
        }

        if (btnGrant) {
            const enabled = this.procedure.status === 'notary_pending';
            btnGrant.disabled = !enabled;
            btnGrant.title = enabled ? '' : 'Disponible cuando el trámite está en notaría';
        }
    },

    handleSendInvites() {
        const requests = Storage.list(this.scope, 'signature_requests').filter(r => r.procedureId === this.procedure.id);
        if (requests.length === 0) {
            const participant = this.procedure.notaryPacket?.tenant || {};
            const role = this.procedure.paymentPolicy?.requireBeforeSignature ? 'signer_payer' : 'signer';
            Storage.add(this.scope, 'signature_requests', {
                procedureId: this.procedure.id,
                tenantId: this.tenantId,
                role,
                status: 'pending',
                identityStatus: this.procedure.identityPolicy?.mode === 'none' ? 'verified' : 'pending',
                paymentStatus: this.procedure.paymentPolicy?.requireBeforeSignature ? 'pending' : 'not_required',
                participant: {
                    name: participant.name || 'Firmante',
                    rut: participant.rut || '-',
                    email: participant.email || '-',
                    phone: participant.phone || '-'
                }
            });
        }
        this.handleTransition('SEND_INVITES');
    },

    handleTransition(event) {
        try {
            const updated = StateMachine.transition(this.procedure, event);
            this.procedure = Storage.update(this.scope, 'procedures', this.procedure.id, updated);
            Audit.append(this.tenantId, { action: event, procedureId: this.procedure.id });
            UI.showToast('Estado actualizado', 'success');
            this.loadProcedure();
        } catch (err) {
            UI.showToast(err.message, 'error');
        }
    },

    handleComplete() {
        if (!StateMachine.isCompleteEligible(this.procedure)) {
            UI.showToast('Faltan requisitos para completar el trámite', 'warning');
            return;
        }
        this.handleTransition('COMPLETE');
        Billing.ensureProcedureCompleted(this.tenantId, this.procedure);
        Providers.recordEvent(this.tenantId, 'brevo', `procedure:${this.procedure.id}`, { type: 'procedure_completed' });
    },

    createSigningToken(signatureRequest) {
        const token = crypto.randomUUID();
        Storage.add('global', 'signingTokens', {
            id: token,
            token,
            tenantId: this.tenantId,
            procedureId: this.procedure.id,
            signatureRequestId: signatureRequest.id,
            expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
            status: 'active',
            attempts: 0
        });
        Audit.append(this.tenantId, { action: 'SIGN_TOKEN_CREATED', procedureId: this.procedure.id, meta: { signatureRequestId: signatureRequest.id } });
        return token;
    },

    bindGrantModal() {
        const btn = document.getElementById('btn-create-grant');
        const modal = document.getElementById('grant-modal');
        const close = document.getElementById('btn-close-grant');
        const form = document.getElementById('grant-form');
        const select = document.getElementById('grant-notary');

        const loadNotaries = () => {
            const users = Storage.list('global', 'users').filter(u => u.role === 'notary');
            select.innerHTML = '';
            users.forEach(u => {
                const opt = document.createElement('option');
                opt.value = u.uid;
                opt.innerText = u.displayName;
                select.appendChild(opt);
            });
        };

        if (btn) {
            btn.addEventListener('click', () => {
                loadNotaries();
                modal.style.display = 'flex';
            });
        }
        if (close) {
            close.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const notaryUid = select.value;
                const days = parseInt(document.getElementById('grant-expiry').value, 10) || 7;
                const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

                Storage.add('global', 'accessGrants', {
                    granteeUid: notaryUid,
                    tenantId: this.tenantId,
                    procedureId: this.procedure.id,
                    scopes: ['notary:read', 'notary:upload_legalized', 'notary:reject'],
                    status: 'active',
                    expiresAt
                });

                this.procedure = Storage.update(this.scope, 'procedures', this.procedure.id, {
                    assignedNotary: notaryUid
                });

                Audit.append(this.tenantId, { action: 'GRANT_CREATED', procedureId: this.procedure.id, meta: { notaryUid } });

                modal.style.display = 'none';
                UI.showToast('Grant creado', 'success');
                this.loadProcedure();
            });
        }
    }
};

export default ProceduresDetailController;
