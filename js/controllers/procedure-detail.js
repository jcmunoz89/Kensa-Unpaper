import Storage from '../storage.js';
import Auth from '../auth.js';
import UI from '../ui.js?v=2';
import StateMachine from '../stateMachine.js';
import Audit from '../audit.js';
import Billing from '../billing.js';

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

        const subtitle = this.procedure.type ? `Tipo: ${this.procedure.type}` : '';
        if (subtitle) {
            document.getElementById('procedure-subtitle').innerText = `${this.procedure.notaryPacket?.tenant?.name || '-'} • ${subtitle}`;
        }

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
        const tenantName = UI.escapeHTML(packet.tenant?.name || '-');
        const tenantRut = UI.escapeHTML(packet.tenant?.rut || '');
        const tenantEmail = UI.escapeHTML(packet.tenant?.email || '');
        const propertyAddress = UI.escapeHTML(packet.property?.address || '-');
        const propertyRol = UI.escapeHTML(packet.property?.rol || '-');
        const propertyPrice = UI.escapeHTML(packet.property?.price || '-');
        const docTitle = UI.escapeHTML(packet.documentVersionRef?.title || '-');
        const docVersion = UI.escapeHTML(packet.documentVersionRef?.version || '-');
        const docHash = UI.escapeHTML(packet.documentVersionRef?.hash ? packet.documentVersionRef.hash.substring(0, 12) : '-');
        container.innerHTML = `
            <div style="margin-bottom: var(--space-md);">
                <strong>Cliente</strong><br>
                ${tenantName}<br>
                ${tenantRut}<br>
                ${tenantEmail}
            </div>
            <div style="margin-bottom: var(--space-md);">
                <strong>Propiedad</strong><br>
                ${propertyAddress}<br>
                ROL: ${propertyRol}<br>
                UF ${propertyPrice}
            </div>
            <div>
                <strong>Documento</strong><br>
                ${docTitle} v${docVersion}<br>
                Hash: ${docHash}
            </div>
        `;
    },

    renderSignatureRequests() {
        const container = document.getElementById('signature-requests');
        const linksContainer = document.getElementById('signature-links');
        const requests = Storage.list(this.scope, 'signature_requests').filter(r => r.procedureId === this.procedure.id);
        if (requests.length === 0) {
            container.innerHTML = UI.createEmptyState('No hay solicitudes de firma.', '✍️');
            if (linksContainer) linksContainer.innerHTML = '';
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
            const participantName = UI.escapeHTML(req.participant?.name || 'Firmante');
            const participantEmail = UI.escapeHTML(req.participant?.email || '-');
            const participantStatus = UI.escapeHTML(req.status || 'pending');

            card.innerHTML = `
                <div>
                    <div style="font-weight: 600;">${participantName}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${participantEmail}</div>
                </div>
                <div style="display: flex; align-items: center; gap: var(--space-sm);">
                    <span class="badge badge-${statusBadge}">${participantStatus}</span>
                </div>
            `;
            container.appendChild(card);
        });

        if (!linksContainer) return;
        linksContainer.innerHTML = '';
        const tokens = Storage.list('global', 'signingTokens');

        requests.forEach(req => {
            const activeToken = tokens.find(t => t.signatureRequestId === req.id && t.status === 'active');
            const tokenValue = activeToken ? (activeToken.tokenId || activeToken.id) : null;
            const link = tokenValue ? `${window.location.origin}${window.location.pathname}#/sign?token=${tokenValue}` : null;
            const safeParticipant = UI.escapeHTML(req.participant?.name || 'Firmante');
            const safeRole = UI.escapeHTML(req.role || 'signer');

            const item = document.createElement('div');
            item.style.border = '1px solid var(--border)';
            item.style.borderRadius = 'var(--radius-md)';
            item.style.padding = '10px';
            item.innerHTML = `
                <div style="font-weight: 600; margin-bottom: 6px;">${safeParticipant} (${safeRole})</div>
                <div style="display:flex; gap:8px; align-items:center; flex-wrap: wrap;">
                    <input type="text" class="form-control" value="${link || 'Sin link activo'}" readonly style="font-size:0.75rem; flex:1; min-width: 240px;">
                    <button class="btn btn-sm btn-secondary" data-copy="${link || ''}" ${link ? '' : 'disabled'}>Copiar</button>
                    <button class="btn btn-sm btn-ghost" data-regen="${req.id}">Regenerar link</button>
                </div>
            `;

            item.querySelector('[data-copy]')?.addEventListener('click', async (e) => {
                const url = e.target.dataset.copy;
                if (!url) return;
                const copied = await UI.copyToClipboard(url);
                UI.showToast(copied ? 'Link copiado' : 'No se pudo copiar', copied ? 'success' : 'warning');
            });

            item.querySelector('[data-regen]')?.addEventListener('click', () => {
                this.regenerateToken(req);
            });

            linksContainer.appendChild(item);
        });
    },

    renderTimeline() {
        const events = Storage.list(this.scope, 'audit_events')
            .filter(e => e.procedureId === this.procedure.id)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const container = document.getElementById('procedure-timeline');
        if (events.length === 0) {
            container.innerHTML = UI.createEmptyState('Sin eventos registrados.', '🕒');
            return;
        }
        container.innerHTML = '';
        events.forEach(e => {
            const item = document.createElement('div');
            item.style.padding = '8px';
            item.style.border = '1px solid var(--border)';
            item.style.borderRadius = 'var(--radius-md)';
            const safeAction = UI.escapeHTML(e.action || '-');
            item.innerHTML = `
                <div style="font-weight: 600; font-size: 0.85rem;">${safeAction}</div>
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
                const safeUser = UI.escapeHTML(user ? user.displayName : g.granteeUid);
                const safeStatus = UI.escapeHTML(g.status || '-');
                item.innerHTML = `
                    <div style="font-weight: 600;">${safeUser}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${safeStatus} • expira ${new Date(g.expiresAt).toLocaleDateString()}</div>
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
            const paymentRequired = this.procedure.paymentPolicy?.requireBeforeSignature === true;
            const role = paymentRequired ? 'signer_payer' : 'signer';
            Storage.add(this.scope, 'signature_requests', {
                procedureId: this.procedure.id,
                tenantId: this.tenantId,
                role,
                status: 'pending',
                identityStatus: this.procedure.identityPolicy?.mode === 'none' ? 'verified' : 'pending',
                payment: { status: paymentRequired ? 'pending' : 'not_required' },
                paymentPercent: paymentRequired ? 100 : 0,
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
            Audit.append(this.tenantId, { action: 'procedure.status_changed', procedureId: this.procedure.id, meta: { status: this.procedure.status } });
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
        const billingEvent = Billing.ensureProcedureCompleted(this.tenantId, this.procedure);
        if (billingEvent) {
            Audit.append(this.tenantId, { action: 'billing.procedure_completed', procedureId: this.procedure.id });
        }
    },

    createSigningToken(signatureRequest) {
        const tokenId = crypto.randomUUID();
        const token = Storage.add('global', 'signingTokens', {
            id: tokenId,
            tokenId,
            tenantId: this.tenantId,
            procedureId: this.procedure.id,
            signatureRequestId: signatureRequest.id,
            roleInProcedure: signatureRequest.role,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'active',
            attempts: 0
        });
        Audit.append(this.tenantId, { action: 'token.created', procedureId: this.procedure.id, meta: { signatureRequestId: signatureRequest.id } });
        return token;
    },

    regenerateToken(signatureRequest) {
        const tokens = Storage.list('global', 'signingTokens').filter(t => t.signatureRequestId === signatureRequest.id && t.status === 'active');
        tokens.forEach(t => Storage.update('global', 'signingTokens', t.id, { status: 'revoked' }));
        const token = this.createSigningToken(signatureRequest);
        Audit.append(this.tenantId, { action: 'token.regenerated', procedureId: this.procedure.id, meta: { signatureRequestId: signatureRequest.id } });
        UI.showToast('Link regenerado', 'success');
        this.loadProcedure();
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
