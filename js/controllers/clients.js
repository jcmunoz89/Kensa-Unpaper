import Store from '../store.js';
import UI from '../ui.js?v=2';

const ClientsController = {
    init() {
        // Teleport Actions
        const topActions = document.getElementById('top-actions');
        const localActions = document.querySelector('.top-actions-teleport');
        topActions.innerHTML = '';
        if (localActions) {
            Array.from(localActions.children).forEach(child => topActions.appendChild(child));
        }

        this.renderClients();

        // Search Handler
        document.getElementById('client-search').addEventListener('input', () => this.renderClients());

        // Modal Logic
        const modal = document.getElementById('client-modal');
        const btnNew = document.getElementById('btn-new-client');
        const btnClose = document.getElementById('btn-close-modal');
        const form = document.getElementById('client-form');

        if (btnNew) {
            btnNew.addEventListener('click', () => {
                form.reset();
                document.getElementById('client-id').value = '';
                document.getElementById('modal-title').innerText = 'Nuevo Cliente';
                modal.style.display = 'flex';
            });
        }

        if (btnClose) {
            btnClose.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const id = document.getElementById('client-id').value;
                const data = {
                    type: document.getElementById('client-type').value,
                    rut: document.getElementById('client-rut').value,
                    name: document.getElementById('client-name').value,
                    email: document.getElementById('client-email').value,
                    phone: document.getElementById('client-phone').value,
                    kycStatus: 'pending'
                };

                if (id) {
                    Store.update('clients', id, data);
                    UI.showToast('Cliente actualizado correctamente', 'success');
                } else {
                    Store.add('clients', data);
                    UI.showToast('Cliente creado correctamente', 'success');
                }

                modal.style.display = 'none';
                this.renderClients();
            });
        }
    },

    renderClients() {
        const clients = Store.getAll('clients');
        const tbody = document.getElementById('clients-list');
        const empty = document.getElementById('clients-empty');
        const search = document.getElementById('client-search').value.toLowerCase();

        if (!tbody) return;

        tbody.innerHTML = '';

        const filtered = clients.filter(c =>
            c.name.toLowerCase().includes(search) ||
            c.rut.includes(search)
        );

        if (filtered.length === 0) {
            tbody.parentElement.style.display = 'none';
            empty.style.display = 'block';
            empty.innerHTML = UI.createEmptyState('No se encontraron clientes.', '👥');
            return;
        }

        tbody.parentElement.style.display = 'table';
        empty.style.display = 'none';

        filtered.forEach(client => {
            const tr = document.createElement('tr');
            const name = UI.escapeHTML(client.name || '-');
            const rut = UI.escapeHTML(client.rut || '-');
            const email = UI.escapeHTML(client.email || '-');
            const phone = UI.escapeHTML(client.phone || '-');
            const clientType = client.type === 'natural' ? 'Natural' : 'Jurídica';
            const kycStatusLabel = client.kycStatus === 'approved' ? 'Aprobado' : 'Pendiente';
            const safeClientType = UI.escapeHTML(clientType);
            const safeKycStatus = UI.escapeHTML(kycStatusLabel);
            const safeClientId = encodeURIComponent(client.id || '');
            tr.innerHTML = `
                <td data-label="Nombre"><strong>${name}</strong></td>
                <td data-label="RUT">${rut}</td>
                <td data-label="Tipo"><span class="badge badge-neutral">${safeClientType}</span></td>
                <td data-label="Email">${email}</td>
                <td data-label="Teléfono">${phone}</td>
                <td data-label="KYC"><span class="badge badge-${client.kycStatus === 'approved' ? 'success' : 'warning'}">${safeKycStatus}</span></td>
                <td data-label="Acciones">
                    <a href="#client-detail?id=${safeClientId}" class="btn btn-sm btn-ghost">Ver</a>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
};

export default ClientsController;
