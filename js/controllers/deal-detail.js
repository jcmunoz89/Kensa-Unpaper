import Store from '../store.js';
import UI from '../ui.js';

const DealDetailController = {
    init() {
        const params = new URLSearchParams(window.location.hash.split('?')[1]);
        const id = params.get('id');
        const deal = Store.getById('deals', id);

        if (!deal) {
            document.getElementById('deal-container').innerHTML = UI.createEmptyState('Negocio no encontrado', '❌');
            return;
        }

        // Render Header
        document.getElementById('d-title').innerText = deal.name;
        document.getElementById('d-subtitle').innerText = `ID: ${deal.id}`;
        document.getElementById('d-amount').innerText = UI.formatCurrency(deal.value) + ' UF';
        document.getElementById('d-created-at').innerText = UI.formatDate(deal.createdAt);

        const stage = Store.getById('stages', deal.stageId);
        if (stage) {
            document.getElementById('d-stage').innerText = stage.name;
        }

        // Render Client
        const client = Store.getById('clients', deal.clientId);
        if (client) {
            document.getElementById('d-client-info').innerHTML = `
                <strong>${client.name}</strong><br>
                ${client.email}<br>
                ${client.phone || ''}
            `;
            document.getElementById('link-client').href = `#client-detail?id=${client.id}`;
        }

        // Render Docs
        const docs = Store.getAll('documents').filter(d => d.dealId === id);
        const docsList = document.getElementById('docs-list');

        if (docs.length === 0) {
            docsList.innerHTML = '<div class="empty-state" style="padding: 1rem;">Sin documentos</div>';
        } else {
            docsList.innerHTML = '';
            docs.forEach(doc => {
                const item = document.createElement('div');
                item.style.display = 'flex';
                item.style.justifyContent = 'space-between';
                item.style.alignItems = 'center';
                item.style.padding = '8px';
                item.style.border = '1px solid var(--border)';
                item.style.borderRadius = 'var(--radius-md)';
                item.style.backgroundColor = 'var(--surface)';

                item.innerHTML = `
                    <div>
                        <div style="font-weight: 500;">${doc.title}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">v${doc.version} • ${doc.status === 'published' ? 'Publicado' : 'Borrador'}</div>
                    </div>
                    <a href="#document-editor?id=${doc.id}&dealId=${deal.id}" class="btn btn-sm btn-secondary">Abrir</a>
                `;
                docsList.appendChild(item);
            });
        }

        // Actions
        document.getElementById('btn-create-doc').addEventListener('click', () => {
            window.location.hash = `document-editor?dealId=${deal.id}`;
        });

        // Payment Logic
        const btnPay = document.getElementById('btn-add-payment');
        const payModal = document.getElementById('payment-modal');

        if (btnPay) {
            btnPay.addEventListener('click', () => {
                payModal.style.display = 'flex';
            });
        }

        document.getElementById('btn-close-pay').addEventListener('click', () => payModal.style.display = 'none');

        document.getElementById('payment-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const amount = document.getElementById('pay-amount').value;
            const type = document.getElementById('pay-type').value;

            UI.showToast(`Pago de ${UI.formatCurrency(amount)} (${type}) registrado exitosamente.`, 'success');
            payModal.style.display = 'none';

            const emptyState = document.querySelector('#payments-card .empty-state');
            if (emptyState) emptyState.style.display = 'none';

            const list = document.getElementById('payments-list');
            const item = document.createElement('div');
            item.innerHTML = `
                <div style="padding: 8px; border-bottom: 1px solid var(--divider); display: flex; justify-content: space-between;">
                    <span>${type}</span>
                    <strong>${UI.formatCurrency(amount)}</strong>
                </div>
            `;
            list.appendChild(item);
        });
    }
};

export default DealDetailController;
