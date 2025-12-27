import Store from '../store.js';
import UI from '../ui.js';

const PropertiesController = {
    init() {
        const topActions = document.getElementById('top-actions');
        const localActions = document.querySelector('.top-actions-teleport');
        topActions.innerHTML = '';
        if (localActions) {
            Array.from(localActions.children).forEach(child => topActions.appendChild(child));
        }

        this.renderProperties();
        document.getElementById('prop-search').addEventListener('input', () => this.renderProperties());
        document.getElementById('prop-status').addEventListener('change', () => this.renderProperties());

        // Modal
        const modal = document.getElementById('prop-modal');
        const btnNew = document.getElementById('btn-new-property');
        const btnClose = document.getElementById('btn-close-prop-modal');
        const form = document.getElementById('prop-form');
        const ownerSelect = document.getElementById('prop-owner');

        if (btnNew) {
            btnNew.addEventListener('click', () => {
                // Populate Owners
                const clients = Store.getAll('clients');
                ownerSelect.innerHTML = '<option value="">Seleccionar...</option>';
                clients.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.innerText = c.name;
                    ownerSelect.appendChild(opt);
                });

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
                const data = {
                    address: document.getElementById('prop-address').value,
                    rol: document.getElementById('prop-rol').value,
                    price: document.getElementById('prop-price').value,
                    rooms: document.getElementById('prop-rooms').value,
                    baths: document.getElementById('prop-baths').value,
                    ownerId: document.getElementById('prop-owner').value,
                    status: 'available'
                };

                Store.add('properties', data);
                UI.showToast('Propiedad creada', 'success');
                modal.style.display = 'none';
                this.renderProperties();
            });
        }
    },

    renderProperties() {
        const props = Store.getAll('properties');
        const grid = document.getElementById('properties-grid');
        const empty = document.getElementById('properties-empty');
        const search = document.getElementById('prop-search').value.toLowerCase();
        const status = document.getElementById('prop-status').value;

        if (!grid) return;
        grid.innerHTML = '';

        const filtered = props.filter(p => {
            const matchSearch = p.address.toLowerCase().includes(search) || (p.rol && p.rol.includes(search));
            const matchStatus = status === 'all' || p.status === status;
            return matchSearch && matchStatus;
        });

        if (filtered.length === 0) {
            empty.style.display = 'block';
            empty.innerHTML = UI.createEmptyState('No hay propiedades.', '🏠');
            return;
        }

        empty.style.display = 'none';

        filtered.forEach(p => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div style="height: 150px; background-color: #E2E8F0; display: flex; align-items: center; justify-content: center; color: #94A3B8;">
                    📷 Foto Mock
                </div>
                <div class="card-body">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span class="badge badge-info">${p.status === 'available' ? 'Disponible' : p.status}</span>
                        <span style="font-weight: 700; color: var(--primary);">UF ${p.price}</span>
                    </div>
                    <h4 style="margin-bottom: 4px; font-size: 1rem;">${p.address}</h4>
                    <p style="font-size: 0.875rem; margin-bottom: 12px;">${p.rooms} Dorm • ${p.baths} Baños</p>
                    <a href="#property-detail?id=${p.id}" class="btn btn-sm btn-secondary" style="width: 100%;">Ver Detalle</a>
                </div>
            `;
            grid.appendChild(card);
        });
    }
};

export default PropertiesController;
