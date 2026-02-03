import Storage from '../storage.js';
import StateMachine from '../stateMachine.js';
import Providers from '../providers.js';
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

        const token = Storage.list('global', 'signingTokens').find(t => t.id === tokenValue || t.token === tokenValue);
        if (!token) {
            return this.showStatus('Token inválido.', 'error');
        }
        if (token.status !== 'active') {
            return this.showStatus('Este token ya fue utilizado o está inactivo.', 'warning');
        }
        if (token.expiresAt && new Date(token.expiresAt) < new Date()) {
            return this.showStatus('El token ha expirado.', 'warning');
        }

        this.token = token;
        this.scope = Storage.tenantScope(token.tenantId);
        this.signatureRequest = Storage.findById(this.scope, 'signature_requests', token.signatureRequestId);
        this.procedure = Storage.findById(this.scope, 'procedures', token.procedureId);

        if (!this.signatureRequest || !this.procedure) {
            return this.showStatus('No se pudo cargar el trámite asociado.', 'error');
        }

        this.setupUI();
        this.setupIdentity();
        this.setupPayment();
        this.setupSignaturePad();
    },

    showStatus(message, type) {
        this.contentBox.style.display = 'none';
        this.statusBox.style.display = 'block';
        this.statusBox.innerHTML = `<div class="empty-state"><p>${message}</p></div>`;
        if (type === 'warning') this.statusBox.querySelector('p').style.color = 'var(--warning)';
        if (type === 'error') this.statusBox.querySelector('p').style.color = 'var(--danger)';
    },

    setupUI() {
        document.getElementById('sign-title').innerText = this.procedure.notaryPacket?.deal?.name || 'Trámite';
        document.getElementById('sign-subtitle').innerText = this.signatureRequest.participant?.name || 'Firmante';
        const statusBadge = document.getElementById('sign-procedure-status');
        statusBadge.innerText = this.procedure.status;
    },

    setupIdentity() {
        const identitySection = document.getElementById('sign-identity');
        const statusBadge = document.getElementById('identity-status');
        const mode = this.procedure.identityPolicy?.mode || 'none';

        if (mode === 'none') {
            identitySection.style.display = 'none';
            return;
        }

        const evidence = this.signatureRequest.identityEvidence || { clave: false, bio: false };
        const updateStatus = () => {
            const verified = this.isIdentityVerified(mode, evidence);
            statusBadge.innerText = verified ? 'Verificado' : 'Pendiente';
            statusBadge.className = `badge badge-${verified ? 'success' : 'warning'}`;
            if (verified) {
                this.signatureRequest.identityStatus = 'verified';
                this.signatureRequest.identityEvidence = evidence;
                Storage.update(this.scope, 'signature_requests', this.signatureRequest.id, this.signatureRequest);
                Audit.append(this.token.tenantId, { action: 'IDENTITY_OK', procedureId: this.procedure.id, meta: { signatureRequestId: this.signatureRequest.id } });
                if (this.procedure.status === 'in_identity') {
                    this.applyProcedureEvent('IDENTITY_OK');
                }
            }
        };

        const btnClave = document.getElementById('btn-identity-clave');
        const btnBio = document.getElementById('btn-identity-bio');

        btnClave.addEventListener('click', () => {
            evidence.clave = true;
            updateStatus();
            UI.showToast('Clave Única validada (mock)', 'success');
        });
        btnBio.addEventListener('click', () => {
            evidence.bio = true;
            updateStatus();
            UI.showToast('Biometría validada (mock)', 'success');
        });

        updateStatus();
    },

    setupPayment() {
        const paymentSection = document.getElementById('sign-payment');
        const paymentRequired = this.procedure.paymentPolicy?.requireBeforeSignature || ['payer', 'signer_payer'].includes(this.signatureRequest.role);

        if (!paymentRequired) {
            paymentSection.style.display = 'none';
            return;
        }

        const amount = this.procedure.notaryPacket?.deal?.value || 0;
        document.getElementById('payment-amount').innerText = `Monto: ${amount} UF`;

        const btnPay = document.getElementById('btn-pay');
        btnPay.addEventListener('click', () => {
            if (this.signatureRequest.paymentStatus === 'paid') {
                UI.showToast('Pago ya registrado', 'info');
                return;
            }
            const externalId = `tbk_${Date.now()}`;
            const result = Providers.recordEvent(this.token.tenantId, 'transbank', externalId, { amount });
            if (!result.created) {
                UI.showToast('Evento duplicado ignorado', 'warning');
                return;
            }
            Storage.add(this.scope, 'payments', {
                procedureId: this.procedure.id,
                signatureRequestId: this.signatureRequest.id,
                amount,
                status: 'paid'
            });
            this.signatureRequest.paymentStatus = 'paid';
            Storage.update(this.scope, 'signature_requests', this.signatureRequest.id, this.signatureRequest);
            Audit.append(this.token.tenantId, { action: 'PAYMENTS_OK', procedureId: this.procedure.id, meta: { signatureRequestId: this.signatureRequest.id } });

            if (this.procedure.status === 'in_payment') {
                this.applyProcedureEvent('PAYMENTS_OK');
            }

            UI.showToast('Pago registrado (mock)', 'success');
        });
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
            if (!hasSignature) {
                UI.showToast('Dibuja tu firma antes de confirmar', 'warning');
                return;
            }
            if (this.procedure.identityPolicy?.mode !== 'none' && this.signatureRequest.identityStatus !== 'verified') {
                UI.showToast('Primero debes validar tu identidad', 'warning');
                return;
            }
            if (this.procedure.paymentPolicy?.requireBeforeSignature && this.signatureRequest.paymentStatus !== 'paid') {
                UI.showToast('Debes completar el pago antes de firmar', 'warning');
                return;
            }

            this.signatureRequest.status = 'signed';
            this.signatureRequest.evidence = {
                signedAt: new Date().toISOString(),
                ip: '127.0.0.1',
                userAgent: navigator.userAgent
            };
            Storage.update(this.scope, 'signature_requests', this.signatureRequest.id, this.signatureRequest);
            Audit.append(this.token.tenantId, { action: 'SIGNATURE_SUBMITTED', procedureId: this.procedure.id, meta: { signatureRequestId: this.signatureRequest.id } });

            Storage.update('global', 'signingTokens', this.token.id, {
                status: 'used',
                usedAt: new Date().toISOString()
            });

            const requests = Storage.list(this.scope, 'signature_requests').filter(r => r.procedureId === this.procedure.id);
            const signedCount = requests.filter(r => r.status === 'signed').length;

            if (signedCount === requests.length) {
                this.applyProcedureEvent('SIGNED_ALL');
            } else {
                this.applyProcedureEvent('SIGNED_ONE');
            }

            UI.showToast('Firma registrada', 'success');
            this.showStatus('Firma completada. Puedes cerrar esta ventana.', 'success');
        });
    },

    isIdentityVerified(mode, evidence) {
        if (mode === 'claveunica_only') return evidence.clave;
        if (mode === 'biometrics_only') return evidence.bio;
        if (mode === 'either') return evidence.clave || evidence.bio;
        if (mode === 'both') return evidence.clave && evidence.bio;
        return true;
    },

    applyProcedureEvent(event) {
        try {
            const updated = StateMachine.transition(this.procedure, event);
            this.procedure = Storage.update(this.scope, 'procedures', this.procedure.id, updated);
        } catch (err) {
            console.error(err);
        }
    }
};

export default SignController;
