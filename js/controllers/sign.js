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
        this.paymentRequired = this.isPaymentRequired();
        this.normalizeSignatureRequest();

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
        this.statusBox.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.className = 'empty-state';
        const p = document.createElement('p');
        p.textContent = message;
        if (type === 'warning') p.style.color = 'var(--warning)';
        if (type === 'error') p.style.color = 'var(--danger)';
        wrapper.appendChild(p);
        this.statusBox.appendChild(wrapper);
    },

    showFinalStatus(_token, message) {
        this.contentBox.style.display = 'none';
        this.statusBox.style.display = 'block';
        this.statusBox.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.className = 'empty-state';
        const p = document.createElement('p');
        p.textContent = message;
        wrapper.appendChild(p);
        this.statusBox.appendChild(wrapper);
    },

    setupUI() {
        document.getElementById('sign-title').innerText = this.procedure.notaryPacket?.deal?.name || 'Trámite';
        document.getElementById('sign-subtitle').innerText = this.signatureRequest.participant?.name || 'Firmante';
        const statusBadge = document.getElementById('sign-procedure-status');
        statusBadge.innerText = this.procedure.status;

        const amountLabel = document.getElementById('payment-amount');
        if (!amountLabel) return;
        if (!this.paymentRequired) {
            amountLabel.innerText = 'Pago no requerido para este trámite.';
            return;
        }
        const amount = this.getProcedureAmount();
        const currency = this.getProcedureCurrency();
        amountLabel.innerText = `Monto: ${UI.formatMoney(amount, currency)} (mock)`;
    },

    isPaymentRequired() {
        return this.procedure?.paymentPolicy?.requireBeforeSignature === true;
    },

    isIdentityRequired() {
        const mode = this.procedure?.identityPolicy?.mode || 'none';
        return mode !== 'none';
    },

    getProcedureAmount() {
        const candidate = this.procedure?.fees?.total
            ?? this.procedure?.amount
            ?? this.procedure?.notaryPacket?.deal?.value
            ?? 0;
        const numeric = Number(candidate);
        return Number.isFinite(numeric) ? numeric : 0;
    },

    getProcedureCurrency() {
        return this.procedure?.currency || this.procedure?.notaryPacket?.deal?.currency || 'CLP';
    },

    normalizeSignatureRequest() {
        let changed = false;
        const legacyStatus = this.signatureRequest.paymentStatus;
        if (!this.signatureRequest.payment || typeof this.signatureRequest.payment !== 'object') {
            const status = legacyStatus || (this.paymentRequired ? 'pending' : 'not_required');
            this.signatureRequest.payment = { status };
            changed = true;
        } else if (!this.signatureRequest.payment.status) {
            this.signatureRequest.payment.status = this.paymentRequired ? 'pending' : 'not_required';
            changed = true;
        }

        if (!this.paymentRequired && this.signatureRequest.payment.status !== 'not_required') {
            this.signatureRequest.payment.status = 'not_required';
            changed = true;
        }

        if (!Number.isFinite(Number(this.signatureRequest.paymentPercent))) {
            if (!this.paymentRequired) {
                this.signatureRequest.paymentPercent = 0;
            } else if (this.isPayer) {
                this.signatureRequest.paymentPercent = 100;
            } else {
                this.signatureRequest.paymentPercent = 0;
            }
            changed = true;
        }

        if (changed) {
            this.signatureRequest = Storage.update(this.scope, 'signature_requests', this.signatureRequest.id, this.signatureRequest);
        }
    },

    syncProcedureMilestones(identityVerified, procedurePaymentPaid) {
        let updatedProcedure = this.procedure;
        let changed = false;

        if (identityVerified && StateMachine.canTransition(updatedProcedure.status, 'IDENTITY_OK')) {
            updatedProcedure = StateMachine.transition(updatedProcedure, 'IDENTITY_OK');
            Audit.append(this.token.tenantId, { action: 'IDENTITY_OK', procedureId: updatedProcedure.id, meta: { signatureRequestId: this.signatureRequest.id } });
            Audit.append(this.token.tenantId, { action: 'procedure.status_changed', procedureId: updatedProcedure.id, meta: { status: updatedProcedure.status } });
            changed = true;
        }

        if (procedurePaymentPaid && StateMachine.canTransition(updatedProcedure.status, 'PAYMENTS_OK')) {
            updatedProcedure = StateMachine.transition(updatedProcedure, 'PAYMENTS_OK');
            Audit.append(this.token.tenantId, { action: 'PAYMENTS_OK', procedureId: updatedProcedure.id, meta: { signatureRequestId: this.signatureRequest.id } });
            Audit.append(this.token.tenantId, { action: 'procedure.status_changed', procedureId: updatedProcedure.id, meta: { status: updatedProcedure.status } });
            changed = true;
        }

        const flags = {
            ...updatedProcedure.flags,
            identityOk: identityVerified || updatedProcedure.flags?.identityOk === true,
            paymentsOk: procedurePaymentPaid || updatedProcedure.flags?.paymentsOk === true || !this.paymentRequired
        };

        if (flags.identityOk !== updatedProcedure.flags?.identityOk || flags.paymentsOk !== updatedProcedure.flags?.paymentsOk) {
            updatedProcedure = { ...updatedProcedure, flags };
            changed = true;
        }

        if (changed) {
            this.procedure = Storage.update(this.scope, 'procedures', updatedProcedure.id, updatedProcedure);
            const statusBadge = document.getElementById('sign-procedure-status');
            if (statusBadge) statusBadge.innerText = this.procedure.status;
        }
    },

    setupSteps() {
        document.getElementById('btn-step1').addEventListener('click', () => this.completeClaveUnica());
        document.getElementById('btn-step2').addEventListener('click', () => this.completeBiometrics());
        document.getElementById('btn-step3').addEventListener('click', () => this.completePayment());
    },

    updateStepState() {
        this.paymentRequired = this.isPaymentRequired();
        const identityRequired = this.isIdentityRequired();
        const identity = this.signatureRequest.identity || { claveUnica: null, biometrics: null };
        const payment = this.signatureRequest.payment || { status: this.paymentRequired ? 'pending' : 'not_required' };
        const payments = Storage.list(this.scope, 'payments').filter(p => p.procedureId === this.procedure.id);
        const summaryPayment = this.paymentRequired ? payments.find(p => p.kind === 'procedure') : null;
        const requiredPercent = this.paymentRequired ? (summaryPayment?.requiredPercent ?? 100) : 0;
        const paidPercent = this.paymentRequired ? (summaryPayment?.paidPercent ?? this.calculatePaidPercent()) : requiredPercent;
        const procedurePaymentPaid = !this.paymentRequired || paidPercent >= requiredPercent || summaryPayment?.status === 'paid';

        const step1Done = !identityRequired || !!identity.claveUnica;
        const step2Done = !identityRequired || !!identity.biometrics;
        const step3Done = !this.paymentRequired
            ? true
            : (this.isPayer ? payment.status === 'paid' : procedurePaymentPaid);
        const canSign = step2Done
            && procedurePaymentPaid
            && (!this.paymentRequired || !this.isPayer || payment.status === 'paid');

        this.setStepStatus('step1-status', step1Done);
        this.setStepStatus('step2-status', step2Done);
        this.setStepStatus('step3-status', step3Done);
        this.setStepStatus('step4-status', this.signatureRequest.status === 'signed');

        document.getElementById('btn-step1').disabled = !identityRequired || step1Done;
        document.getElementById('btn-step2').disabled = !identityRequired || !step1Done || step2Done;
        document.getElementById('btn-step3').disabled = !this.paymentRequired || !step2Done || step3Done || !this.isPayer;
        document.getElementById('btn-sign-confirm').disabled = !canSign;

        if (step2Done && step3Done && this.signatureRequest.progress !== 'payment_ok' && this.signatureRequest.status !== 'signed') {
            const updatedPayment = payment;
            if (!this.paymentRequired) {
                updatedPayment.status = 'not_required';
            } else if (!this.isPayer && updatedPayment.status !== 'paid') {
                updatedPayment.status = 'paid';
                updatedPayment.paidAt = summaryPayment?.paidAt || new Date().toISOString();
                this.signatureRequest.payment = updatedPayment;
            }
            this.signatureRequest.progress = 'payment_ok';
            this.signatureRequest = Storage.update(this.scope, 'signature_requests', this.signatureRequest.id, this.signatureRequest);
        }

        this.syncProcedureMilestones(step2Done, procedurePaymentPaid);
    },

    setStepStatus(id, done) {
        const el = document.getElementById(id);
        el.className = `badge badge-${done ? 'success' : 'warning'}`;
        el.innerText = done ? 'OK' : 'Pendiente';
    },

    calculatePaidPercent() {
        const requests = Storage.list(this.scope, 'signature_requests').filter(r => r.procedureId === this.procedure.id);
        return requests.reduce((sum, r) => {
            const percent = r.paymentPercent || 0;
            return sum + (r.payment?.status === 'paid' ? percent : 0);
        }, 0);
    },

    getOrCreateSummaryPayment() {
        const payments = Storage.list(this.scope, 'payments').filter(p => p.procedureId === this.procedure.id);
        let summary = payments.find(p => p.kind === 'procedure');
        if (!summary) {
            summary = Storage.add(this.scope, 'payments', {
                procedureId: this.procedure.id,
                kind: 'procedure',
                status: 'pending',
                requiredPercent: 100,
                paidPercent: this.calculatePaidPercent()
            });
        }
        return summary;
    },

    completeClaveUnica() {
        if (!this.isIdentityRequired()) {
            UI.showToast('Este trámite no requiere validación de identidad.', 'info');
            return;
        }
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
        this.signatureRequest.progress = 'identity_verified_partial';
        Storage.update(this.scope, 'signature_requests', this.signatureRequest.id, this.signatureRequest);
        Audit.append(this.token.tenantId, { action: 'signing.claveunica_ok', procedureId: this.procedure.id, meta: { signatureRequestId: this.signatureRequest.id } });
        UI.showToast('Clave Única validada (mock)', 'success');
        this.updateStepState();
    },

    completeBiometrics() {
        if (!this.isIdentityRequired()) {
            UI.showToast('Este trámite no requiere validación biométrica.', 'info');
            return;
        }
        const identity = this.signatureRequest.identity || { claveUnica: null, biometrics: null };
        if (!identity.claveUnica || identity.biometrics) return;
        identity.biometrics = {
            verifiedAt: new Date().toISOString(),
            scoreMock: 0.91,
            resultMock: 'pass'
        };
        this.signatureRequest.identity = identity;
        this.signatureRequest.progress = 'identity_verified_full';
        Storage.update(this.scope, 'signature_requests', this.signatureRequest.id, this.signatureRequest);
        Audit.append(this.token.tenantId, { action: 'signing.biometrics_ok', procedureId: this.procedure.id, meta: { signatureRequestId: this.signatureRequest.id } });
        UI.showToast('Biometría validada (mock)', 'success');
        this.updateStepState();
    },

    completePayment() {
        if (!this.paymentRequired) {
            UI.showToast('Este trámite no requiere pago.', 'info');
            return;
        }
        if (!this.isPayer) {
            UI.showToast('El pago debe ser realizado por el pagador asignado', 'warning');
            return;
        }
        const payment = this.signatureRequest.payment || { status: 'pending' };
        if (payment.status === 'paid') return;

        const amount = this.getProcedureAmount();
        const currency = this.getProcedureCurrency();
        const externalId = `tbk_${this.procedure.id}_${this.signatureRequest.id}`;
        const result = Providers.recordEvent(this.token.tenantId, 'transbank', externalId, { amount, currency });
        if (!result.created) {
            UI.showToast('Pago ya registrado', 'info');
        }

        payment.status = 'paid';
        payment.paidAt = new Date().toISOString();
        this.signatureRequest.payment = payment;
        this.signatureRequest.progress = 'payment_ok';
        Storage.update(this.scope, 'signature_requests', this.signatureRequest.id, this.signatureRequest);

        const paymentPercent = this.signatureRequest.paymentPercent || 0;
        const summaryPayment = this.getOrCreateSummaryPayment();
        const updatedPercent = Math.min((summaryPayment.paidPercent || 0) + paymentPercent, summaryPayment.requiredPercent || 100);
        const summaryStatus = updatedPercent >= (summaryPayment.requiredPercent || 100) ? 'paid' : 'pending';
        Storage.update(this.scope, 'payments', summaryPayment.id, {
            paidPercent: updatedPercent,
            status: summaryStatus,
            paidAt: summaryStatus === 'paid' ? new Date().toISOString() : summaryPayment.paidAt
        });

        if (summaryStatus === 'paid') {
            this.procedure = Storage.update(this.scope, 'procedures', this.procedure.id, {
                flags: { ...this.procedure.flags, paymentsOk: true }
            });
        }

        Audit.append(this.token.tenantId, { action: 'payment.paid_mock', procedureId: this.procedure.id, meta: { signatureRequestId: this.signatureRequest.id } });
        UI.showToast(`Pago registrado (mock): ${UI.formatMoney(amount, currency)}`, 'success');
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
            this.signatureRequest.progress = 'signed';
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
