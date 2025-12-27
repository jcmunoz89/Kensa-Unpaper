import Store from '../store.js';
import UI from '../ui.js';

const SignaturesController = {
    init() {
        this.renderList();
        this.setupWizard();
    },

    renderList() {
        // For MVP, we'll just list 'documents' that are published as 'requests'
        // In a real app, we'd have a separate 'signature_requests' collection.
        const docs = Store.getAll('documents').filter(d => d.status === 'published');
        const tbody = document.getElementById('signatures-list');
        const empty = document.getElementById('sig-empty');

        if (!tbody) return;

        if (docs.length === 0) {
            tbody.parentElement.style.display = 'none';
            empty.style.display = 'block';
            empty.innerHTML = UI.createEmptyState('No hay solicitudes de firma.', '✍️');
        } else {
            tbody.parentElement.style.display = 'table';
            empty.style.display = 'none';
            tbody.innerHTML = '';

            docs.forEach(doc => {
                const tr = document.createElement('tr');
                const isSigned = doc.signed === true;
                const typeLabel = doc.notarized ? 'Protocolización' : 'Firma Simple';

                tr.innerHTML = `
                    <td><strong>${doc.title}</strong></td>
                    <td><span class="badge badge-neutral">${typeLabel}</span></td>
                    <td>1 Participante</td> <!-- Mock -->
                    <td><span class="badge badge-${isSigned ? 'success' : 'warning'}">${isSigned ? 'Firmado' : 'Pendiente'}</span></td>
                    <td>
                        ${!isSigned ? `<button class="btn btn-sm btn-primary btn-sign" data-id="${doc.id}">Firmar</button>` : '✅'}
                    </td>
                `;
                tbody.appendChild(tr);
            });

            document.querySelectorAll('.btn-sign').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.dataset.id;
                    Store.update('documents', id, { signed: true, signedAt: new Date().toISOString() });
                    UI.showToast('Documento firmado exitosamente', 'success');
                    this.renderList();
                });
            });
        }
    },

    setupWizard() {
        const viewList = document.getElementById('view-list');
        const viewWizard = document.getElementById('view-wizard');
        const btnNew = document.getElementById('btn-new-request');
        const btnBack = document.getElementById('btn-back-list');

        if (btnNew) {
            btnNew.addEventListener('click', () => {
                if (viewList) viewList.style.display = 'none';
                if (viewWizard) viewWizard.style.display = 'block';
                btnNew.style.display = 'none';
            });
        }

        if (btnBack) {
            btnBack.addEventListener('click', () => {
                if (viewList) viewList.style.display = 'block';
                if (viewWizard) viewWizard.style.display = 'none';
                if (btnNew) btnNew.style.display = 'inline-flex';
            });
        }

        // Steps Navigation
        const steps = ['step-1', 'step-2', 'step-3'];
        let currentStep = 0;

        const showStep = (index) => {
            steps.forEach((id, i) => {
                const el = document.getElementById(id);
                if (el) el.style.display = i === index ? 'block' : 'none';
            });
            currentStep = index;
        };

        const btnNext1 = document.getElementById('btn-next-1');
        if (btnNext1) btnNext1.addEventListener('click', () => showStep(1));

        const btnPrev2 = document.getElementById('btn-prev-2');
        if (btnPrev2) btnPrev2.addEventListener('click', () => showStep(0));

        const btnNext2 = document.getElementById('btn-next-2');
        if (btnNext2) {
            btnNext2.addEventListener('click', () => {
                // Validate Payment Total
                const totalPayment = participants.reduce((sum, p) => sum + parseInt(p.payment), 0);
                if (totalPayment < 100) {
                    UI.showToast(`Solo se ha definido un ${totalPayment}% del pago.`, 'warning');
                }
                showStep(2);
            });
        }

        const btnPrev3 = document.getElementById('btn-prev-3');
        if (btnPrev3) btnPrev3.addEventListener('click', () => showStep(1));

        // Participants Logic
        const pListContainer = document.getElementById('participants-list-container');
        const pForm = document.getElementById('participant-form');
        const pList = document.getElementById('participants-list');
        const paymentWarning = document.getElementById('payment-warning');
        const paymentTotalSpan = document.getElementById('payment-total');

        const btnShowAdd = document.getElementById('btn-show-add-participant');
        const btnCancelP = document.getElementById('btn-cancel-participant');
        const btnSaveP = document.getElementById('btn-save-participant');

        let participants = [];

        const updatePaymentWarning = () => {
            const total = participants.reduce((sum, p) => sum + parseInt(p.payment), 0);
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
                // Signer: Only "No" allowed
                lbl0.style.display = 'flex';
                lbl50.style.display = 'none';
                lbl100.style.display = 'none';
                if (radio0) radio0.checked = true;
            } else {
                // Payer / Signer & Payer: Only 50% / 100% allowed
                lbl0.style.display = 'none';
                lbl50.style.display = 'flex';
                lbl100.style.display = 'flex';

                // If "No" was checked, switch to 100% default
                if (radio0 && radio0.checked) {
                    if (radio100) radio100.checked = true;
                }
            }

            // Toggle Signature Order visibility
            const orderGroup = document.getElementById('p-order-group');
            if (orderGroup) {
                orderGroup.style.display = (role === 'payer') ? 'none' : 'block';
            }

            // Trigger change event to update doc type visibility
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
                                ${p.rut} • ${getRoleLabel(p.role)}
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

            // Re-attach listeners
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
                // Clear form
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

                // Reset radios
                document.querySelectorAll('input[name="p-pay"]').forEach(r => r.checked = r.value === '0');
                const pDocTypeGroup = document.getElementById('p-doc-type-group');
                if (pDocTypeGroup) pDocTypeGroup.style.display = 'none';

                if (pListContainer) pListContainer.style.display = 'none';
                if (pForm) pForm.style.display = 'block';

                // Reset to default role (Signer) and update options
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

        // Toggle Boleta/Factura visibility based on payment
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
                const pRut = document.getElementById('p-rut');
                const name = pName ? pName.value : '';
                const rut = pRut ? pRut.value : '';

                if (!name || !rut) {
                    UI.showToast('Nombre y RUT son obligatorios', 'warning');
                    return;
                }

                const payRadio = document.querySelector('input[name="p-pay"]:checked');
                const paymentVal = payRadio ? payRadio.value : '0';

                const roleBtn = document.querySelector('.p-role-btn.active');
                const role = roleBtn ? roleBtn.dataset.role : 'signer';

                const pEmail = document.getElementById('p-email');
                const pPhone = document.getElementById('p-phone');
                const pOrder = document.getElementById('p-order');
                const docTypeRadio = document.querySelector('input[name="p-doc-type"]:checked');

                participants.push({
                    name,
                    email: pEmail ? pEmail.value : '',
                    rut,
                    phone: pPhone ? pPhone.value : '',
                    role: role,
                    order: pOrder ? pOrder.value : '1',
                    payment: paymentVal,
                    docType: (paymentVal !== '0' && docTypeRadio) ? docTypeRadio.value : null
                });

                renderParticipants();
                if (pForm) pForm.style.display = 'none';
                if (pListContainer) pListContainer.style.display = 'block';
            });
        }

        // Role Toggle
        document.querySelectorAll('.p-role-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.p-role-btn').forEach(b => b.classList.remove('active', 'btn-primary'));
                document.querySelectorAll('.p-role-btn').forEach(b => b.classList.add('btn-secondary'));

                btn.classList.remove('btn-secondary');
                btn.classList.add('active', 'btn-primary');

                updatePaymentOptions(btn.dataset.role);
            });
        });

        // Document Upload & Assign Logic
        const btnUpload = document.getElementById('btn-upload-doc');
        const uploadActions = document.getElementById('upload-actions');
        const docUploadedState = document.getElementById('doc-uploaded-state');
        const btnRemoveDoc = document.getElementById('btn-remove-doc');
        const modalAssign = document.getElementById('modal-assign-sig');
        const btnCloseAssign = document.getElementById('btn-close-assign');
        const btnConfirmAssign = document.getElementById('btn-confirm-assign');
        const assignList = document.getElementById('assign-participants-list');

        if (btnUpload) {
            btnUpload.addEventListener('click', () => {
                // Simulate Upload -> Show Modal
                if (assignList) {
                    assignList.innerHTML = '';
                    participants.forEach((p, i) => {
                        assignList.innerHTML += `
                            <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                                <input type="radio" name="assign-p" value="${i}" ${i === 0 ? 'checked' : ''}>
                                <span style="font-weight: 500;">${p.name}</span>
                            </label>
                        `;
                    });
                }
                if (modalAssign) modalAssign.style.display = 'flex';
            });
        }

        if (btnCloseAssign) {
            btnCloseAssign.addEventListener('click', () => {
                if (modalAssign) modalAssign.style.display = 'none';
            });
        }

        if (btnConfirmAssign) {
            btnConfirmAssign.addEventListener('click', () => {
                if (modalAssign) modalAssign.style.display = 'none';
                if (uploadActions) uploadActions.style.display = 'none';
                if (docUploadedState) docUploadedState.style.display = 'block';
                UI.showToast('Documento subido y asignado', 'success');
            });
        }

        if (btnRemoveDoc) {
            btnRemoveDoc.addEventListener('click', () => {
                if (docUploadedState) docUploadedState.style.display = 'none';
                if (uploadActions) uploadActions.style.display = 'flex';
            });
        }

        // Finish
        const btnFinish = document.getElementById('btn-finish');
        if (btnFinish) {
            btnFinish.addEventListener('click', () => {
                const wizName = document.getElementById('wiz-name');
                const name = wizName ? wizName.value : 'Trámite sin nombre';

                const wizType = document.querySelector('input[name="wiz-type"]:checked');
                const isNotarized = wizType ? wizType.value === 'proto' : false;

                // Create a mock document
                Store.add('documents', {
                    title: name,
                    status: 'published',
                    version: 1,
                    signed: false,
                    notarized: isNotarized,
                    participants: participants
                });

                UI.showToast('Solicitud creada exitosamente', 'success');

                // Reset & Return
                if (viewList) viewList.style.display = 'block';
                if (viewWizard) viewWizard.style.display = 'none';
                if (btnNew) btnNew.style.display = 'inline-flex';
                showStep(0);
                participants = [];
                renderParticipants();

                // Reset Doc State
                if (docUploadedState) docUploadedState.style.display = 'none';
                if (uploadActions) uploadActions.style.display = 'flex';

                this.renderList();
            });
        }

        // Clean
        const btnClean = document.getElementById('btn-clean');
        if (btnClean) {
            btnClean.addEventListener('click', () => {
                const wizName = document.getElementById('wiz-name');
                if (wizName) wizName.value = '';
                UI.showToast('Formulario limpiado', 'info');
            });
        }
    }
};

export default SignaturesController;
