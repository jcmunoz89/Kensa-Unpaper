import Store from '../store.js';
import UI from '../ui.js?v=2';

const ClientDetailController = {
    init() {
        const params = new URLSearchParams(window.location.hash.split('?')[1]);
        const id = params.get('id');
        const client = Store.getById('clients', id);

        if (!client) {
            document.getElementById('client-detail-container').innerHTML = UI.createEmptyState('Cliente no encontrado', '👤');
            return;
        }

        // Populate Data
        document.getElementById('c-name').innerText = client.name;
        document.getElementById('c-rut').innerText = client.rut;
        document.getElementById('c-email').innerText = client.email;
        document.getElementById('c-phone').innerText = client.phone || '-';
        document.getElementById('c-type').innerText = client.type === 'natural' ? 'Persona Natural' : 'Persona Jurídica';

        const kycBadge = document.getElementById('c-kyc-badge');
        kycBadge.innerText = client.kycStatus === 'approved' ? 'Aprobado' : 'Pendiente';
        kycBadge.className = `badge badge-${client.kycStatus === 'approved' ? 'success' : 'warning'}`;

        // Tabs Logic
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');

                btn.classList.add('active');
                document.getElementById(`tab-${btn.dataset.tab}`).style.display = 'block';
            });
        });

        // Actions
        document.getElementById('btn-toggle-kyc').addEventListener('click', () => {
            const newStatus = client.kycStatus === 'approved' ? 'pending' : 'approved';
            Store.update('clients', client.id, { kycStatus: newStatus });
            // Refresh
            this.init();
            UI.showToast('Estado KYC actualizado', 'success');
        });

        document.getElementById('btn-create-deal-client').addEventListener('click', () => {
            window.location.hash = 'deals';
            setTimeout(() => UI.showToast('Cree un nuevo negocio seleccionando a este cliente.', 'info'), 500);
        });
    }
};

export default ClientDetailController;
