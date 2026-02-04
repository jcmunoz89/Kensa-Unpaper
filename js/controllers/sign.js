import Storage from '../storage.js';
import StateMachine from '../stateMachine.js';
import Providers from '../providers.js';
import Billing from '../billing.js';
import Audit from '../audit.js';
import UI from '../ui.js';

const SignController = {
    init() {
        const params = new URLSearchParams(window.location.hash.split('?')[1]);
        const tokenValue = params.get('token');

        this.statusBox = document.getElementById('sign-status');
        this.contentBox = document.getElementById('sign-content');

        if (!tokenValue) {
            return this.showStatus('Token inválido o ausente.', 'error');
        }

        const token = Storage.list('global', 'signingTokens').find(t => t.tokenId === tokenValue || t.id === tokenValue);
        if (!token) {
            return this.showStatus('Token inválido.', 'error');
        }

        this.token = token;
        this.scope = Storage.tenantScope(token.tenantId);
        this.signatureRequest = Storage.findById(this.scope, 'signature_requests', token.signatureRequestId);
        this.procedure = Storage.findById(this.scope, 'procedures', token.procedureId);
        this.isPayer = ['payer', 'signer_payer'].includes(this.signatureRequest?.role);

        if (token.status !== 'active') {
            if (this.signatureRequest && this.signatureRequest.status === 'signed') {
                return this.showFinalStatus(token, 'Este documento ya fue firmado.');
            }
            return this.showFinalStatus(token, 'Este token ya fue utilizado o está inactivo.');
        }

        if (token.expiresAt && new Date(token.expiresAt) < new Date()) {
            Storage.update('global', 'signingTokens', token.id, { status: 'expired' });
            if (this.signatureRequest && this.signatureRequest.status === 'signed') {
                return this.showFinalStatus(token, 'Este documento ya fue firmado.');
            }
            return this.showFinalStatus(token, 'El token ha expirado.');
        }

        if ((token.attempts || 0) >= 10) {
            Storage.update('global', 'signingTokens', token.id, { status: 'blocked' });
            return this.showFinalStatus(token, 'El token superó el máximo de intentos.');
        }

        Storage.update('global', 'signingTokens', token.id, { attempts: (token.attempts || 0) + 1 });

        if (!this.signatureRequest || !this.procedure) {
            return this.showStatus('No se pudo cargar el trámite asociado.', 'error');
        }

        if (this.signatureRequest.status === 'signed') {
            return this.showFinalStatus(token, 'Este documento ya fue firmado.');
        }

        this.setupUI();
        this.setupSteps();
        this.setupSignaturePad();
        this.updateStepState();
    },

    showStatus(message, type) {
        this.contentBox.style.display = 'none';
        this.statusBox.style.display = 'block';
        this.statusBox.innerHTML = `<div class="empty-state"><p>${message}</p></div>`;
        if (type === 'warning') this.statusBox.querySelector('p').style.color = 'var(--warning)';
        if (type === 'error') this.statusBox.querySelector('p').style.color = 'var(--danger)';
    },

    showFinalStatus(token, message) {
        this.contentBox.style.display = 'none';
        this.statusBox.style.display = 'block';
        this.statusBox.innerHTML = `<div class="empty-state"><p>${message}</p></div>`;
    },

    setupUI() {
        document.getElementById('sign-title').innerText = this.procedure.notaryPacket?.deal?.name || 'Trámite';
        document.getElementById('sign-subtitle').innerText = this.signatureRequest.participant?.name || 'Firmante';
        const statusBadge = document.getElementById('sign-procedure-status');
        statusBadge.innerText = this.procedure.status;

        const amount = this.procedure.notaryPacket?.deal?.value || 29990;
        document.getElementById('payment-amount').innerText = `Monto: ${amount} CLP (mock)`;
    },

    setupSteps() {
        document.getElementById('btn-step1').addEventListener('click', () => this.completeClaveUnica());
        document.getElementById('btn-step2').addEventListener('click', () => this.completeBiometrics());
        document.getElementById('btn-step3').addEventListener('click', () => this.completePayment());
    },

    updateStepState() {
        const identity = this.signatureRequest.identity || { claveUnica: null, biometrics: null };
        const payment = this.signatureRequest.payment || { status: 'pending' };
        const procedurePaymentPaid = (this.procedure.flags?.paymentsOk === true) || Storage.list(this.scope, 'payments').some(p => p.procedureId === this.procedure.id && p.status === 'paid');

        const step1Done = !!identity.claveUnica;
        const step2Done = !!identity.biometrics;
        const step3Done = this.isPayer ? payment.status === 'paid' : procedurePaymentPaid;

        this.setStepStatus('step1-status', step1Done);
        this.setStepStatus('step2-status', step2Done);
        this.setStepStatus('step3-status', step3Done);
        this.setStepStatus('step4-status', this.signatureRequest.status === 'signed');

        document.getElementById('btn-step1').disabled = step1Done;
        document.getElementById('btn-step2').disabled = !step1Done || step2Done;
        document.getElementById('btn-step3').disabled = !step2Done || step3Done || !this.isPayer;
        document.getElementById('btn-sign-confirm').disabled = !step3Done;
    },

    setStepStatus(id, done) {
        const el = document.getElementById(id);
        el.className = `badge badge-${done ? 'success' : 'warning'}`;
        el.innerText = done ? 'OK' : 'Pendiente';
    },

    completeClaveUnica() {
        const identity = this.signatureRequest.identity || { claveUnica: null, biometrics: null };
        if (identity.claveUnica) return;
        identity.claveUnica = {
            verifiedAt: new Date().toISOString(),
            simulatedUser: {
                rut: this.signatureRequest.participant?.rut || '11.111.111-1',
                name: this.signatureRequest.participant?.name || 'Firmante'
            }
        };
        this.signatureRequest.identity = identity;
        Storage.update(this.scope, 'signature_requests', this.signatureRequest.id, this.signatureRequest);
        Audit.append(this.token.tenantId, { action: 'signing.claveunica_ok', procedureId: this.procedure.id, meta: { signatureRequestId: this.signatureRequest.id } });
        UI.showToast('Clave Única validada (mock)', 'success');
        this.updateStepState();
    },

    completeBiometrics() {
        const identity = this.signatureRequest.identity || { claveUnica: null, biometrics: null };
        if (!identity.claveUnica || identity.biometrics) return;
        identity.biometrics = {
            verifiedAt: new Date().toISOString(),
            scoreMock: 0.91,
            resultMock: 'pass'
        };
        this.signatureRequest.identity = identity;
        Storage.update(this.scope, 'signature_requests', this.signatureRequest.id, this.signatureRequest);
        const allRequests = Storage.list(this.scope, 'signature_requests').filter(r => r.procedureId === this.procedure.id);
        const allVerified = allRequests.every(r => r.identity?.biometrics);
        if (allVerified) {
            this.procedure = Storage.update(this.scope, 'procedures', this.procedure.id, {
                flags: { ...this.procedure.flags, identityOk: true }
            });
        }
        Audit.append(this.token.tenantId, { action: 'signing.biometrics_ok', procedureId: this.procedure.id, meta: { signatureRequestId: this.signatureRequest.id } });
        UI.showToast('Biometría validada (mock)', 'success');
        this.updateStepState();
    },

    completePayment() {
        if (!this.isPayer) {
            UI.showToast('El pago debe ser realizado por el pagador asignado', 'warning');
            return;
        }
        const payment = this.signatureRequest.payment || { status: 'pending' };
        if (payment.status === 'paid') return;

        const externalId = `tbk_${this.procedure.id}_${this.signatureRequest.id}`;
        const result = Providers.recordEvent(this.token.tenantId, 'transbank', externalId, { amount: 29990 });
        if (!result.created) {
            UI.showToast('Pago ya registrado', 'info');
        }

        payment.status = 'paid';
        payment.paidAt = new Date().toISOString();
        this.signatureRequest.payment = payment;
        Storage.update(this.scope, 'signature_requests', this.signatureRequest.id, this.signatureRequest);

        const existingPayment = Storage.list(this.scope, 'payments').find(p => p.procedureId === this.procedure.id && (p.signatureRequestId === this.signatureRequest.id || !p.signatureRequestId));
        if (!existingPayment) {
            Storage.add(this.scope, 'payments', {
                procedureId: this.procedure.id,
                signatureRequestId: this.signatureRequest.id,
                amount: 29990,
                status: 'paid'
            });
        } else {
            Storage.update(this.scope, 'payments', existingPayment.id, { status: 'paid', updatedAt: new Date().toISOString() });
        }

        this.procedure = Storage.update(this.scope, 'procedures', this.procedure.id, {
            flags: { ...this.procedure.flags, paymentsOk: true }
        });

        Audit.append(this.token.tenantId, { action: 'payment.paid_mock', procedureId: this.procedure.id, meta: { signatureRequestId: this.signatureRequest.id } });
        UI.showToast('Pago registrado (mock)', 'success');
        this.updateStepState();
    },

    setupSignaturePad() {
        const canvas = document.getElementById('sign-canvas');
        const ctx = canvas.getContext('2d');
        const placeholder = document.getElementById('sign-placeholder');
        const btnClear = document.getElementById('btn-sign-clear');
        const btnConfirm = document.getElementById('btn-sign-confirm');

        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';

        let isDrawing = false;
        let hasSignature = false;

        const startDrawing = (e) => {
            isDrawing = true;
            hasSignature = true;
            placeholder.style.display = 'none';
            draw(e);
        };

        const stopDrawing = () => {
            isDrawing = false;
            ctx.beginPath();
        };

        const draw = (e) => {
            if (!isDrawing) return;
            const rect = canvas.getBoundingClientRect();
            let x, y;
            if (e.type.includes('touch')) {
                x = e.touches[0].clientX - rect.left;
                y = e.touches[0].clientY - rect.top;
            } else {
                x = e.clientX - rect.left;
                y = e.clientY - rect.top;
            }
            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y);
        };

        canvas.onmousedown = startDrawing;
        canvas.onmouseup = stopDrawing;
        canvas.onmousemove = draw;
        canvas.onmouseleave = stopDrawing;

        canvas.ontouchstart = (e) => { e.preventDefault(); startDrawing(e); };
        canvas.ontouchend = (e) => { e.preventDefault(); stopDrawing(); };
        canvas.ontouchmove = (e) => { e.preventDefault(); draw(e); };

        btnClear.addEventListener('click', () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            hasSignature = false;
            placeholder.style.display = 'block';
        });

        btnConfirm.addEventListener('click', () => {
            if (btnConfirm.disabled) {
                UI.showToast('Completa los pasos anteriores primero', 'warning');
                return;
            }
            if (!hasSignature) {
                UI.showToast('Dibuja tu firma antes de confirmar', 'warning');
                return;
            }

            this.signatureRequest.status = 'signed';
            this.signatureRequest.evidence = {
                signedAt: new Date().toISOString(),
                ip: '127.0.0.1',
                userAgent: navigator.userAgent
            };
            Storage.update(this.scope, 'signature_requests', this.signatureRequest.id, this.signatureRequest);

            Storage.update('global', 'signingTokens', this.token.id, {
                status: 'used',
                usedAt: new Date().toISOString()
            });

            Audit.append(this.token.tenantId, { action: 'signing.signed', procedureId: this.procedure.id, meta: { signatureRequestId: this.signatureRequest.id } });

            this.advanceProcedureAfterSignature();

            UI.showToast('Firma registrada', 'success');
            this.showStatus('Firma completada. Puedes cerrar esta ventana.', 'success');
        });
    },

    advanceProcedureAfterSignature() {
        const requests = Storage.list(this.scope, 'signature_requests').filter(r => r.procedureId === this.procedure.id);
        const signedCount = requests.filter(r => r.status === 'signed').length;
        const allSigned = signedCount === requests.length;

        let updated = this.procedure;
        try {
            updated = StateMachine.transition(updated, allSigned ? 'SIGNED_ALL' : 'SIGNED_ONE');
            updated.flags = { ...updated.flags, signaturesOk: allSigned };
            this.procedure = Storage.update(this.scope, 'procedures', updated.id, updated);
            Audit.append(this.token.tenantId, { action: 'procedure.status_changed', procedureId: updated.id, meta: { status: updated.status } });
        } catch (err) {
            console.warn(err.message);
        }

        if (allSigned) {
            if (this.procedure.notaryRequired) {
                try {
                    const notary = StateMachine.transition(this.procedure, 'OPEN_NOTARY');
                    this.procedure = Storage.update(this.scope, 'procedures', this.procedure.id, notary);
                    Audit.append(this.token.tenantId, { action: 'procedure.status_changed', procedureId: this.procedure.id, meta: { status: notary.status } });
                } catch (err) {
                    console.warn(err.message);
                }
            } else {
                if (StateMachine.isCompleteEligible(this.procedure)) {
                    try {
                        const completed = StateMachine.transition(this.procedure, 'COMPLETE');
                        this.procedure = Storage.update(this.scope, 'procedures', this.procedure.id, completed);
                        Audit.append(this.token.tenantId, { action: 'procedure.status_changed', procedureId: this.procedure.id, meta: { status: completed.status } });
                        Billing.ensureProcedureCompleted(this.token.tenantId, completed);
                        Audit.append(this.token.tenantId, { action: 'billing.procedure_completed', procedureId: completed.id });
                    } catch (err) {
                        console.warn(err.message);
                    }
                }
            }
        }
    }
};

export default SignController;
