import Storage from '../storage.js';
import Auth from '../auth.js';
import Audit from '../audit.js';
import UI from '../ui.js?v=2';
import Store from '../store.js';

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
            const safeName = UI.escapeHTML(req.participant?.name || 'Firmante');
            const safeRole = UI.escapeHTML(req.role || 'signer');
            const safeEmail = UI.escapeHTML(req.participant?.email || '-');
            const safeReqId = UI.escapeHTML(req.id || '');
            tr.innerHTML = `
                <td><strong>${safeName}</strong></td>
                <td><span class="badge badge-neutral">${safeRole}</span></td>
                <td>${safeEmail}</td>
                <td><span class="badge badge-${isSigned ? 'success' : 'warning'}">${isSigned ? 'Firmado' : 'Pendiente'}</span></td>
                <td>
                    ${!isSigned ? `<button class="btn btn-sm btn-secondary btn-sign" data-id="${safeReqId}">Copiar Link</button>` : '✅'}
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
                const link = this.buildLink(token.tokenId || token.id);
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

        const docSelect = document.getElementById('wiz-doc-version');
        this.loadDocumentVersions(docSelect);

        // Participants Logic
        const pListContainer = document.getElementById('participants-list-container');
        const pForm = document.getElementById('participant-form');
        const pList = document.getElementById('participants-list');
        const paymentWarning = document.getElementById('payment-warning');
        const paymentTotalSpan = document.getElementById('payment-total');

        const btnShowAdd = document.getElementById('btn-show-add-participant');
        const btnCancelP = document.getElementById('btn-cancel-participant');
        const btnSaveP = document.getElementById('btn-save-participant');

        const participants = [];
        let docUploaded = false;

        const updatePaymentWarning = () => {
            const total = participants.reduce((sum, p) => sum + parseInt(p.paymentPercent, 10), 0);
            if (paymentTotalSpan) paymentTotalSpan.innerText = total;
            if (paymentWarning) paymentWarning.style.display = total < 100 ? 'block' : 'none';
        };

        const getRoleLabel = (role) => {
            switch (role) {
                case 'payer': return 'Pagador';
                case 'signer_payer': return 'Firmante y Pagador';
                case 'signer': return 'Firmante';
                default: return 'Firmante';
            }
        };

        const updatePaymentOptions = (role) => {
            const lbl0 = document.getElementById('lbl-pay-0');
            const lbl50 = document.getElementById('lbl-pay-50');
            const lbl100 = document.getElementById('lbl-pay-100');
            const radio0 = document.querySelector('input[name="p-pay"][value="0"]');
            const radio100 = document.querySelector('input[name="p-pay"][value="100"]');

            if (!lbl0 || !lbl50 || !lbl100) return;

            if (role === 'signer') {
                lbl0.style.display = 'flex';
                lbl50.style.display = 'none';
                lbl100.style.display = 'none';
                if (radio0) radio0.checked = true;
            } else {
                lbl0.style.display = 'none';
                lbl50.style.display = 'flex';
                lbl100.style.display = 'flex';
                if (radio0 && radio0.checked) {
                    if (radio100) radio100.checked = true;
                }
            }

            const orderGroup = document.getElementById('p-order-group');
            if (orderGroup) {
                orderGroup.style.display = (role === 'payer') ? 'none' : 'block';
            }

            const checked = document.querySelector('input[name="p-pay"]:checked');
            if (checked) checked.dispatchEvent(new Event('change'));
        };

        const renderParticipants = () => {
            if (!pList) return;
            pList.innerHTML = '';
            participants.forEach((p, index) => {
                const item = document.createElement('div');
                item.className = 'card';
                item.style.padding = 'var(--space-md)';
                item.style.border = '1px solid var(--border)';
                item.style.display = 'flex';
                item.style.justifyContent = 'space-between';
                item.style.alignItems = 'center';

                item.innerHTML = `
                    <div style="display: flex; align-items: center; gap: var(--space-md);">
                        <div style="width: 8px; height: 8px; background: var(--primary); border-radius: 50%;"></div>
                        <div>
                            <div style="font-weight: 600; font-size: 0.9rem;">${p.name}</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted);">
                                ${p.rut || '-'} • ${getRoleLabel(p.role)} • ${p.paymentPercent}%
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: var(--space-sm);">
                        <button class="btn btn-sm btn-ghost btn-del-p" style="color: var(--danger);" data-index="${index}">🗑️</button>
                    </div>
                `;
                pList.appendChild(item);
            });

            updatePaymentWarning();

            document.querySelectorAll('.btn-del-p').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = e.target.dataset.index;
                    participants.splice(idx, 1);
                    renderParticipants();
                });
            });
        };

        if (btnShowAdd) {
            btnShowAdd.addEventListener('click', () => {
                const pName = document.getElementById('p-name');
                if (pName) pName.value = '';
                const pEmail = document.getElementById('p-email');
                if (pEmail) pEmail.value = '';
                const pRut = document.getElementById('p-rut');
                if (pRut) pRut.value = '';
                const pPhone = document.getElementById('p-phone');
                if (pPhone) pPhone.value = '';
                const pOrder = document.getElementById('p-order');
                if (pOrder) pOrder.value = '1';

                document.querySelectorAll('input[name="p-pay"]').forEach(r => r.checked = r.value === '0');
                const pDocTypeGroup = document.getElementById('p-doc-type-group');
                if (pDocTypeGroup) pDocTypeGroup.style.display = 'none';

                if (pListContainer) pListContainer.style.display = 'none';
                if (pForm) pForm.style.display = 'block';

                document.querySelectorAll('.p-role-btn').forEach(b => {
                    b.classList.remove('active', 'btn-primary');
                    b.classList.add('btn-secondary');
                    if (b.dataset.role === 'signer') {
                        b.classList.add('active', 'btn-primary');
                        b.classList.remove('btn-secondary');
                    }
                });
                updatePaymentOptions('signer');
            });
        }

        if (btnCancelP) {
            btnCancelP.addEventListener('click', () => {
                if (pForm) pForm.style.display = 'none';
                if (pListContainer) pListContainer.style.display = 'block';
            });
        }

        document.querySelectorAll('input[name="p-pay"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const val = e.target.value;
                const pDocTypeGroup = document.getElementById('p-doc-type-group');
                if (pDocTypeGroup) pDocTypeGroup.style.display = val === '0' ? 'none' : 'block';
            });
        });

        if (btnSaveP) {
            btnSaveP.addEventListener('click', () => {
                const pName = document.getElementById('p-name');
                const pEmail = document.getElementById('p-email');
                const name = pName ? pName.value : '';
                const email = pEmail ? pEmail.value : '';

                if (!name || !email) {
                    UI.showToast('Nombre y email son obligatorios', 'warning');
                    return;
                }

                const payRadio = document.querySelector('input[name="p-pay"]:checked');
                const paymentVal = payRadio ? payRadio.value : '0';

                const roleBtn = document.querySelector('.p-role-btn.active');
                const role = roleBtn ? roleBtn.dataset.role : 'signer';

                const pRut = document.getElementById('p-rut');
                const pPhone = document.getElementById('p-phone');
                const pOrder = document.getElementById('p-order');
                const docTypeRadio = document.querySelector('input[name="p-doc-type"]:checked');

                participants.push({
                    name,
                    email,
                    rut: pRut ? pRut.value : '',
                    phone: pPhone ? pPhone.value : '',
                    role: role,
                    order: pOrder ? pOrder.value : '1',
                    paymentPercent: parseInt(paymentVal, 10),
                    docType: (paymentVal !== '0' && docTypeRadio) ? docTypeRadio.value : null
                });

                renderParticipants();
                if (pForm) pForm.style.display = 'none';
                if (pListContainer) pListContainer.style.display = 'block';
            });
        }

        document.querySelectorAll('.p-role-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.p-role-btn').forEach(b => b.classList.remove('active', 'btn-primary'));
                document.querySelectorAll('.p-role-btn').forEach(b => b.classList.add('btn-secondary'));

                btn.classList.remove('btn-secondary');
                btn.classList.add('active', 'btn-primary');

                updatePaymentOptions(btn.dataset.role);
            });
        });

        const btnMerge = document.getElementById('btn-merge-docs');
        const btnUpload = document.getElementById('btn-upload-doc');
        const uploadActions = document.getElementById('upload-actions');
        const docUploadedState = document.getElementById('doc-uploaded-state');
        const docUploadedName = document.getElementById('doc-uploaded-name');
        const btnRemoveDoc = document.getElementById('btn-remove-doc');

        const setDocUploaded = (fileName) => {
            docUploaded = true;
            if (uploadActions) uploadActions.style.display = 'none';
            if (docUploadedState) docUploadedState.style.display = 'block';
            if (docUploadedName) docUploadedName.innerText = fileName;
        };

        if (btnMerge) {
            btnMerge.addEventListener('click', () => {
                setDocUploaded('archivos_unidos.pdf');
                UI.showToast('Archivos unidos (mock)', 'success');
            });
        }

        if (btnUpload) {
            btnUpload.addEventListener('click', () => {
                setDocUploaded('documento_subido.pdf');
                UI.showToast('Documento subido (mock)', 'success');
            });
        }

        if (btnRemoveDoc) {
            btnRemoveDoc.addEventListener('click', () => {
                docUploaded = false;
                if (docUploadedState) docUploadedState.style.display = 'none';
                if (uploadActions) uploadActions.style.display = 'flex';
            });
        }

        const btnFinish = document.getElementById('btn-finish');
        if (btnFinish) {
            btnFinish.addEventListener('click', () => {
                const totalPayment = participants.reduce((sum, p) => sum + parseInt(p.paymentPercent, 10), 0);
                if (participants.length === 0) {
                    UI.showToast('Agrega al menos un participante', 'warning');
                    return;
                }
                if (totalPayment !== 100) {
                    UI.showToast('El pago debe sumar 100%', 'warning');
                    return;
                }
                if (!docUploaded) {
                    UI.showToast('Debes unir o subir documentos antes de continuar', 'warning');
                    return;
                }

                const wizName = document.getElementById('wiz-name');
                const name = wizName ? wizName.value : 'Trámite sin nombre';

                const docVersionId = document.getElementById('wiz-doc-version').value;
                let version = Storage.findById(this.scope, 'document_versions', docVersionId);
                if (!version && docVersionId) {
                    const fallbackDoc = Store.getById('documents', docVersionId);
                    if (fallbackDoc && fallbackDoc.status === 'published') {
                        version = {
                            id: fallbackDoc.id,
                            title: fallbackDoc.title,
                            version: fallbackDoc.version,
                            hash: fallbackDoc.hash
                        };
                    }
                }
                if (!version && docUploaded) {
                    const fallbackName = (name && name.trim()) ? `Express ${name.trim()}` : 'Documento subido en Trámite Express';
                    version = Storage.add(this.scope, 'document_versions', {
                        dealId: null,
                        title: fallbackName,
                        version: 1,
                        hash: `adhoc_${crypto.randomUUID()}`,
                        content: '[express_upload]',
                        status: 'published',
                        source: 'express_upload',
                        createdBy: this.session?.uid || 'system'
                    });
                    UI.showToast('Se utilizará el documento subido en este trámite.', 'info');
                }
                if (!version) {
                    UI.showToast('Selecciona un documento publicado', 'warning');
                    return;
                }

                const wizType = document.querySelector('input[name="wiz-type"]:checked');
                const type = wizType ? wizType.value : 'cert';
                const notaryRequired = type !== 'fes';
                const expressAmount = 29990;

                const signerParticipants = participants.filter(p => p.role !== 'payer');
                const landlord = signerParticipants[0] || participants[0];
                const tenant = signerParticipants[1] || signerParticipants[0] || participants[0];

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
                        deal: { id: 'express', name: name || `Trámite Express (${procedureTypeLabels[type]})`, value: expressAmount, currency: 'CLP' },
                        documentVersionRef: {
                            id: version.id,
                            title: version.title,
                            version: version.version,
                            hash: version.hash
                        }
                    },
                    amount: expressAmount,
                    currency: 'CLP',
                    assignedNotary: null,
                    flags: { identityOk: false, paymentsOk: false, signaturesOk: false, notaryOk: !notaryRequired },
                    createdBy: this.session.uid
                });

                Audit.append(this.tenantId, { action: 'procedure.created_express', procedureId: procedure.id });
                Audit.append(this.tenantId, { action: 'procedure.status_changed', procedureId: procedure.id, meta: { status: procedure.status } });

                const signatureRequests = participants.map(p => this.createSignatureRequest(procedure.id, p));

                Storage.add(this.scope, 'payments', {
                    procedureId: procedure.id,
                    kind: 'procedure',
                    status: 'pending',
                    requiredPercent: 100,
                    paidPercent: 0
                });

                const tokens = signatureRequests.map(req => this.createToken(req, req.role));

                this.latestProcedureId = procedure.id;
                this.renderSummary(procedure, signatureRequests, tokens, showStep);
            });
        }

        const btnViewProc = document.getElementById('btn-view-procedure');
        if (btnViewProc) {
            btnViewProc.addEventListener('click', () => {
                if (this.latestProcedureId) {
                    window.location.hash = `procedure-detail?id=${this.latestProcedureId}`;
                }
            });
        }

        showStep(0);
    },

    loadDocumentVersions(selectEl) {
        if (!selectEl) return;
        const versions = Storage.list(this.scope, 'document_versions').filter(v => !v.voidedAt);
        const fallbackDocs = Store.getAll('documents')
            .filter(d => d.status === 'published')
            .map(d => ({
                id: d.id,
                title: d.title,
                version: d.version,
                hash: d.hash,
                source: 'store_documents'
            }));
        const merged = [...versions];
        fallbackDocs.forEach((doc) => {
            const exists = merged.some((v) => v.id === doc.id || (v.hash && doc.hash && v.hash === doc.hash));
            if (!exists) merged.push(doc);
        });

        selectEl.innerHTML = '';
        if (merged.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.innerText = 'No hay documentos publicados';
            selectEl.appendChild(opt);
            selectEl.disabled = true;
            return;
        }
        selectEl.disabled = false;
        merged.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.innerText = `${v.title || 'Documento'} v${v.version || 1}`;
            selectEl.appendChild(opt);
        });
    },

    createSignatureRequest(procedureId, participant) {
        const request = Storage.add(this.scope, 'signature_requests', {
            procedureId,
            tenantId: this.tenantId,
            role: participant.role,
            status: 'pending',
            progress: 'opened',
            paymentPercent: participant.paymentPercent,
            participant: {
                name: participant.name,
                email: participant.email,
                rut: participant.rut,
                phone: participant.phone
            },
            identity: { claveUnica: null, biometrics: null },
            payment: { status: participant.paymentPercent > 0 ? 'pending' : 'not_required' }
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
            const tokenId = token ? (token.tokenId || token.id) : '';
            const link = this.buildLink(tokenId);
            const safeName = UI.escapeHTML(req.participant.name || 'Firmante');
            const safeRole = UI.escapeHTML(req.role || 'signer');
            return `
                <tr>
                    <td>${safeName}</td>
                    <td>${safeRole}</td>
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
