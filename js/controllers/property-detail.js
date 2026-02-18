import Store from '../store.js';
import UI from '../ui.js?v=2';

const PropertyDetailController = {
    init() {
        const params = new URLSearchParams(window.location.hash.split('?')[1]);
        const id = params.get('id');
        const prop = Store.getById('properties', id);

        if (!prop) {
            document.getElementById('prop-detail-container').innerHTML = UI.createEmptyState('Propiedad no encontrada', '🏠');
            return;
        }

        document.getElementById('p-address').innerText = prop.address;
        document.getElementById('p-price').innerText = `UF ${prop.price}`;
        document.getElementById('p-rol').innerText = prop.rol || 'S/R';
        document.getElementById('p-features').innerText = `${prop.rooms} Dormitorios • ${prop.baths} Baños`;

        const statusBadge = document.getElementById('p-status');
        statusBadge.innerText = prop.status === 'available' ? 'Disponible' : prop.status;

        const owner = Store.getById('clients', prop.ownerId);
        if (owner) {
            const safeOwnerName = UI.escapeHTML(owner.name || '-');
            const safeOwnerId = encodeURIComponent(owner.id || '');
            document.getElementById('p-owner').innerHTML = `
                <strong>${safeOwnerName}</strong><br>
                <a href="#client-detail?id=${safeOwnerId}" class="btn btn-sm btn-ghost" style="margin-top: 8px; padding-left: 0;">Ver Perfil</a>
            `;
        }

        document.getElementById('btn-create-deal-prop').addEventListener('click', () => {
            window.location.hash = 'deals';
            setTimeout(() => UI.showToast('Cree un nuevo negocio seleccionando esta propiedad.', 'info'), 500);
        });
    }
};

export default PropertyDetailController;
