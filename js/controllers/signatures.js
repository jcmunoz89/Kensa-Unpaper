import Storage from '../storage.js';
import Auth from '../auth.js';
import Audit from '../audit.js';
import UI from '../ui.js';

const procedureTypeLabels = {
    cert: 'Certificación Notarial',
    proto: 'Protocolización Notarial',
    fes: 'Firma Electrónica Simple'
};

const SignaturesController = {
    init() {
        this.session = Auth.getSession();
        this.tenantId = this.session?.tenantId || null;
        if (!this.tenantId) return;
        this.scope = Storage.tenantScope(this.tenantId);

        this.renderList();
        this.setupWizard();
    },

    renderList() {
        const requests = Storage.list(this.scope, 'signature_requests');
        const tbody = document.getElementById('signatures-list');
        const empty = document.getElementById('sig-empty');

        if (!tbody) return;

        if (requests.length === 0) {
            tbody.parentElement.style.display = 'none';
            empty.style.display = 'block';
            empty.innerHTML = UI.createEmptyState('No hay solicitudes de firma.', '✍️');
            return;
        }

        tbody.parentElement.style.display = 'table';
        empty.style.display = 'none';
        tbody.innerHTML = '';

        requests.forEach(req => {
            const tr = document.createElement('tr');
            const isSigned = req.status === 'signed';
            tr.innerHTML = `
                <td><strong>${req.participant?.name || 'Firmante'}</strong></td>
                <td><span class="badge badge-neutral">${req.role || 'signer'}</span></td>
                <td>${req.participant?.email || '-'}</td>
                <td><span class="badge badge-${isSigned ? 'success' : 'warning'}">${isSigned ? 'Firmado' : 'Pendiente'}</span></td>
                <td>
                    ${!isSigned ? `<button class="btn btn-sm btn-secondary btn-sign" data-id="${req.id}">Copiar Link</button>` : '✅'}
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.btn-sign').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                const req = requests.find(r => r.id === id);
                if (!req) return;
                const tokens = Storage.list('global', 'signingTokens');
                let token = tokens.find(t => t.signatureRequestId === req.id && t.status === 'active');
                if (!token) {
                    token = this.createToken(req, req.role);
                }
                const link = this.buildLink(token.tokenId);
                const copied = await UI.copyToClipboard(link);
                UI.showToast(copied ? 'Link copiado' : 'No se pudo copiar', copied ? 'success' : 'warning');
            });
        });
    },

    setupWizard() {
        const viewList = document.getElementById('view-list');
        const viewWizard = document.getElementById('view-wizard');
        const btnNew = document.getElementById('btn-new-request');
        const btnBack = document.getElementById('btn-back-list');

        const steps = ['step-1', 'step-2', 'step-3', 'step-4'];
        const showStep = (index) => {
            steps.forEach((id, i) => {
                const el = document.getElementById(id);
                if (el) el.style.display = i === index ? 'block' : 'none';
            });
        };

        if (btnNew) {
            btnNew.addEventListener('click', () => {
                if (viewList) viewList.style.display = 'none';
                if (viewWizard) viewWizard.style.display = 'block';
                btnNew.style.display = 'none';
                showStep(0);
            });
        }

        if (btnBack) {
            btnBack.addEventListener('click', () => {
                if (viewList) viewList.style.display = 'block';
                if (viewWizard) viewWizard.style.display = 'none';
                if (btnNew) btnNew.style.display = 'inline-flex';
            });
        }

        const btnNext1 = document.getElementById('btn-next-1');
        if (btnNext1) btnNext1.addEventListener('click', () => showStep(1));

        const btnPrev2 = document.getElementById('btn-prev-2');
        if (btnPrev2) btnPrev2.addEventListener('click', () => showStep(0));

        const btnNext2 = document.getElementById('btn-next-2');
        if (btnNext2) btnNext2.addEventListener('click', () => showStep(2));

        const btnPrev3 = document.getElementById('btn-prev-3');
        if (btnPrev3) btnPrev3.addEventListener('click', () => showStep(1));

        const payerMode = document.getElementById('wiz-payer-mode');
        const payerExtra = document.getElementById('wiz-payer-extra');
        if (payerMode) {
            payerMode.addEventListener('change', () => {
                payerExtra.style.display = payerMode.value === 'separate' ? 'block' : 'none';
            });
        }

        const docSelect = document.getElementById('wiz-doc-version');
        this.loadDocumentVersions(docSelect);

        const btnFinish = document.getElementById('btn-finish');
        if (btnFinish) {
            btnFinish.addEventListener('click', () => this.finishExpress(showStep));
        }

        const btnViewProc = document.getElementById('btn-view-procedure');
        if (btnViewProc) {
            btnViewProc.addEventListener('click', () => {
                if (this.latestProcedureId) {
                    window.location.hash = `procedure-detail?id=${this.latestProcedureId}`;
                }
            });
        }
    },

    loadDocumentVersions(selectEl) {
        if (!selectEl) return;
        const versions = Storage.list(this.scope, 'document_versions').filter(v => !v.voidedAt);
        selectEl.innerHTML = '';
        if (versions.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.innerText = 'No hay documentos publicados';
            selectEl.appendChild(opt);
            selectEl.disabled = true;
            return;
        }
        selectEl.disabled = false;
        versions.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.innerText = `${v.title || 'Documento'} v${v.version}`;
            selectEl.appendChild(opt);
        });
    },

    finishExpress(showStep) {
        const type = document.querySelector('input[name="wiz-type"]:checked')?.value || 'cert';
        const landlord = {
            name: document.getElementById('wiz-landlord-name').value,
            email: document.getElementById('wiz-landlord-email').value,
            rut: document.getElementById('wiz-landlord-rut').value
        };
        const tenant = {
            name: document.getElementById('wiz-tenant-name').value,
            email: document.getElementById('wiz-tenant-email').value,
            rut: document.getElementById('wiz-tenant-rut').value
        };
        const payerMode = document.getElementById('wiz-payer-mode').value;
        const payer = payerMode === 'separate'
            ? {
                name: document.getElementById('wiz-payer-name').value,
                email: document.getElementById('wiz-payer-email').value,
                rut: document.getElementById('wiz-payer-rut').value
            }
            : null;

        if (!landlord.name || !landlord.email || !tenant.name || !tenant.email) {
            UI.showToast('Completa los datos de los firmantes', 'warning');
            return;
        }

        if (payerMode === 'separate' && (!payer?.name || !payer?.email)) {
            UI.showToast('Completa los datos del pagador', 'warning');
            return;
        }

        const docVersionId = document.getElementById('wiz-doc-version').value;
        const version = Storage.findById(this.scope, 'document_versions', docVersionId);
        if (!version) {
            UI.showToast('Selecciona un documento publicado', 'warning');
            return;
        }

        const notaryRequired = type !== 'fes';

        const procedure = Storage.add(this.scope, 'procedures', {
            status: 'in_signature',
            type,
            identityPolicy: { mode: 'both' },
            paymentPolicy: { requireBeforeSignature: true },
            notaryRequired,
            notaryPacket: {
                landlord,
                tenant,
                property: { address: '-', rol: '-', price: '-' },
                deal: { id: 'express', name: `Trámite Express (${procedureTypeLabels[type]})`, value: 0 },
                documentVersionRef: {
                    id: version.id,
                    title: version.title,
                    version: version.version,
                    hash: version.hash
                }
            },
            assignedNotary: null,
            flags: { identityOk: false, paymentsOk: false, signaturesOk: false, notaryOk: !notaryRequired },
            createdBy: this.session.uid
        });

        Audit.append(this.tenantId, { action: 'procedure.created_express', procedureId: procedure.id });
        Audit.append(this.tenantId, { action: 'procedure.status_changed', procedureId: procedure.id, meta: { status: procedure.status } });

        const signatureRequests = [];

        signatureRequests.push(this.createSignatureRequest(procedure.id, landlord, payerMode === 'landlord' ? 'signer_payer' : 'signer'));
        signatureRequests.push(this.createSignatureRequest(procedure.id, tenant, payerMode === 'tenant' ? 'signer_payer' : 'signer'));

        if (payerMode === 'separate') {
            signatureRequests.push(this.createSignatureRequest(procedure.id, payer, 'payer'));
        }

        const payerRequest = signatureRequests.find(r => r.role === 'payer' || r.role === 'signer_payer');

        Storage.add(this.scope, 'payments', {
            procedureId: procedure.id,
            signatureRequestId: payerRequest ? payerRequest.id : null,
            status: 'pending',
            amount: 29990
        });

        const tokens = signatureRequests.map(req => this.createToken(req, req.role));

        this.latestProcedureId = procedure.id;
        this.renderSummary(procedure, signatureRequests, tokens, showStep);
    },

    createSignatureRequest(procedureId, participant, role) {
        const request = Storage.add(this.scope, 'signature_requests', {
            procedureId,
            tenantId: this.tenantId,
            role,
            status: 'pending',
            participant,
            identity: { claveUnica: null, biometrics: null },
            payment: { status: 'pending' }
        });
        return request;
    },

    createToken(signatureRequest, roleInProcedure) {
        const tokenId = crypto.randomUUID();
        const token = Storage.add('global', 'signingTokens', {
            id: tokenId,
            tokenId,
            tenantId: this.tenantId,
            procedureId: signatureRequest.procedureId,
            signatureRequestId: signatureRequest.id,
            roleInProcedure,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            attempts: 0,
            status: 'active'
        });
        Audit.append(this.tenantId, { action: 'token.created', procedureId: signatureRequest.procedureId, meta: { signatureRequestId: signatureRequest.id } });
        return token;
    },

    buildLink(tokenId) {
        return `${window.location.origin}${window.location.pathname}#/sign?token=${tokenId}`;
    },

    async renderSummary(procedure, signatureRequests, tokens, showStep) {
        const summary = document.getElementById('wizard-summary');
        if (!summary) return;

        const rows = signatureRequests.map(req => {
            const token = tokens.find(t => t.signatureRequestId === req.id);
            const link = this.buildLink(token.tokenId);
            return `
                <tr>
                    <td>${req.participant.name}</td>
                    <td>${req.role}</td>
                    <td>
                        <div style="display:flex; gap:8px; align-items:center;">
                            <input type="text" class="form-control" value="${link}" readonly style="font-size:0.75rem;">
                            <button class="btn btn-sm btn-secondary" data-copy="${link}">Copiar</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        summary.innerHTML = `
            <div style="margin-bottom: var(--space-md);">
                <strong>Estado del trámite:</strong> <span class="badge badge-info">${procedure.status}</span>
            </div>
            <div style="margin-bottom: var(--space-md);">
                <strong>Tipo:</strong> ${procedureTypeLabels[procedure.type]}
            </div>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Participante</th>
                            <th>Rol</th>
                            <th>Link</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;

        summary.querySelectorAll('[data-copy]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const link = btn.dataset.copy;
                const copied = await UI.copyToClipboard(link);
                UI.showToast(copied ? 'Link copiado' : 'No se pudo copiar', copied ? 'success' : 'warning');
            });
        });

        showStep(3);
        this.renderList();
    }
};

export default SignaturesController;
