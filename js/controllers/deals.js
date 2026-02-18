import Store from '../store.js';
import UI from '../ui.js';

const DealsController = {
    init() {
        const topActions = document.getElementById('top-actions');
        const localActions = document.querySelector('.top-actions-teleport');
        topActions.innerHTML = '';
        if (localActions) {
            Array.from(localActions.children).forEach(child => topActions.appendChild(child));
        }

        this.stages = Store.getAll('stages').sort((a, b) => a.order - b.order);
        this.renderBoard();

        // Move Logic
        const moveModal = document.getElementById('move-modal');
        const moveSelect = document.getElementById('move-stage-select');

        document.getElementById('btn-close-move-modal').addEventListener('click', () => moveModal.style.display = 'none');

        document.getElementById('btn-confirm-move').addEventListener('click', () => {
            const dealId = document.getElementById('move-deal-id').value;
            const stageId = moveSelect.value;
            Store.update('deals', dealId, { stageId });
            moveModal.style.display = 'none';
            this.renderBoard();
            UI.showToast('Negocio movido', 'success');
        });

        // New Deal Logic
        const dealModal = document.getElementById('deal-modal');
        const btnNew = document.getElementById('btn-new-deal');

        if (btnNew) {
            btnNew.addEventListener('click', () => {
                // Populate Selects
                const clients = Store.getAll('clients');
                const props = Store.getAll('properties').filter(p => p.status === 'available');

                const clientSelect = document.getElementById('deal-client');
                const propSelect = document.getElementById('deal-property');

                clientSelect.innerHTML = '';
                const clientPlaceholder = document.createElement('option');
                clientPlaceholder.value = '';
                clientPlaceholder.textContent = 'Seleccionar Cliente...';
                clientSelect.appendChild(clientPlaceholder);
                clients.forEach((c) => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.name;
                    clientSelect.appendChild(opt);
                });

                propSelect.innerHTML = '';
                const propPlaceholder = document.createElement('option');
                propPlaceholder.value = '';
                propPlaceholder.textContent = 'Seleccionar Propiedad...';
                propSelect.appendChild(propPlaceholder);
                props.forEach((p) => {
                    const opt = document.createElement('option');
                    opt.value = p.id;
                    opt.textContent = p.address;
                    propSelect.appendChild(opt);
                });

                dealModal.style.display = 'flex';
            });
        }

        document.getElementById('btn-close-deal-modal').addEventListener('click', () => dealModal.style.display = 'none');

        document.getElementById('deal-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const clientSelect = document.getElementById('deal-client');
            const propSelect = document.getElementById('deal-property');
            const rawValue = Number(document.getElementById('deal-value').value);

            const data = {
                name: document.getElementById('deal-name').value,
                clientId: clientSelect.value,
                clientName: clientSelect.options[clientSelect.selectedIndex].text,
                propertyId: propSelect.value,
                value: Number.isFinite(rawValue) ? rawValue : 0,
                currency: 'UF',
                stageId: this.stages[0].id // First stage
            };

            Store.add('deals', data);
            dealModal.style.display = 'none';
            this.renderBoard();
            UI.showToast('Negocio creado', 'success');
        });
    },

    renderBoard() {
        const deals = Store.getAll('deals');
        const board = document.getElementById('kanban-board');
        if (!board) return;

        board.innerHTML = '';

        this.stages.forEach(stage => {
            const stageDeals = deals.filter(d => d.stageId === stage.id);

            const col = document.createElement('div');
            col.style.flex = '1';
            col.style.minWidth = '280px';
            col.style.backgroundColor = '#F1F5F9';
            col.style.borderRadius = 'var(--radius-md)';
            col.style.display = 'flex';
            col.style.flexDirection = 'column';
            col.style.maxHeight = '100%';
            const safeStageName = UI.escapeHTML(stage.name || '');

            col.innerHTML = `
                <div style="padding: var(--space-md); border-bottom: 1px solid var(--border); font-weight: 600; color: var(--secondary); display: flex; justify-content: space-between;">
                    <span>${safeStageName}</span>
                    <span class="badge badge-neutral">${stageDeals.length}</span>
                </div>
                <div class="kanban-col-body" style="padding: var(--space-sm); overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: var(--space-sm);">
                    <!-- Cards -->
                </div>
            `;

            const colBody = col.querySelector('.kanban-col-body');

            stageDeals.forEach(deal => {
                const card = document.createElement('div');
                card.className = 'card';
                card.style.boxShadow = 'var(--shadow-sm)';
                card.style.cursor = 'pointer';
                const safeDealName = UI.escapeHTML(deal.name || '');
                const safeClientName = UI.escapeHTML(deal.clientName || 'Cliente');
                const dealCurrency = deal.currency || 'UF';
                card.innerHTML = `
                    <div class="card-body" style="padding: var(--space-md);">
                        <h4 style="font-size: 0.9rem; margin-bottom: 4px;">${safeDealName}</h4>
                        <p style="font-size: 0.8rem; margin-bottom: 8px;">${UI.formatMoney(deal.value, dealCurrency)}</p>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span class="badge badge-info" style="font-size: 0.7rem;">${safeClientName}</span>
                            <button class="btn btn-sm btn-ghost btn-move" data-id="${deal.id}" style="padding: 2px 6px;">→</button>
                        </div>
                    </div>
                `;

                card.addEventListener('click', (e) => {
                    if (!e.target.classList.contains('btn-move')) {
                        window.location.hash = `deal-detail?id=${deal.id}`;
                    }
                });

                card.querySelector('.btn-move').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openMoveModal(deal.id);
                });

                colBody.appendChild(card);
            });

            board.appendChild(col);
        });
    },

    openMoveModal(dealId) {
        const moveModal = document.getElementById('move-modal');
        const moveSelect = document.getElementById('move-stage-select');
        document.getElementById('move-deal-id').value = dealId;
        moveSelect.innerHTML = '';
        this.stages.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.innerText = s.name;
            moveSelect.appendChild(opt);
        });
        moveModal.style.display = 'flex';
    }
};

export default DealsController;
