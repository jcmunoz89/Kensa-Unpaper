import UI from '../ui.js';

const WebhookSimulatorController = {
    init() {
        const typeSelect = document.getElementById('event-type');
        const payloadArea = document.getElementById('event-payload');
        const form = document.getElementById('webhook-form');

        if (typeSelect) {
            typeSelect.addEventListener('change', (e) => {
                const type = e.target.value;
                let payload = {};

                if (type.includes('payment')) {
                    payload = { eventId: 'evt_' + Date.now(), timestamp: new Date().toISOString(), data: { amount: 29990, currency: 'CLP' } };
                } else if (type.includes('signature')) {
                    payload = { eventId: 'evt_' + Date.now(), timestamp: new Date().toISOString(), data: { documentId: 'doc_123', signer: 'Juan Perez' } };
                }

                payloadArea.value = JSON.stringify(payload, null, 2);
            });
        }

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                try {
                    const payload = JSON.parse(payloadArea.value);
                    console.log('Webhook Received:', payload);
                    UI.showToast('Evento recibido y procesado correctamente (Simulación)', 'success');
                } catch (err) {
                    UI.showToast('Error: JSON inválido', 'error');
                }
            });
        }
    }
};

export default WebhookSimulatorController;
