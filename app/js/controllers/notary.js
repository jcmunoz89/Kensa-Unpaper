import Store from '../store.js';
import UI from '../ui.js';

const NotaryController = {
    init() {
        const docs = Store.getAll('documents').filter(d => d.signed === true);
        const tbody = document.getElementById('notary-list');
        const empty = document.getElementById('notary-empty');

        if (docs.length === 0) {
            tbody.parentElement.style.display = 'none';
            empty.style.display = 'block';
            empty.innerHTML = UI.createEmptyState('No hay documentos firmados listos para notaría.', '⚖️');
        } else {
            tbody.innerHTML = '';
            docs.forEach(doc => {
                const deal = Store.getById('deals', doc.dealId);
                const tr = document.createElement('tr');
                const isNotarized = doc.notarized === true;

                tr.innerHTML = `
                    <td>${doc.title}</td>
                    <td>${deal ? deal.name : '-'}</td>
                    <td><span class="badge badge-success">Firmado</span></td>
                    <td><span class="badge badge-${isNotarized ? 'success' : 'info'}">${isNotarized ? 'Protocolizado' : 'Pendiente'}</span></td>
                    <td>
                        ${!isNotarized ? `<button class="btn btn-sm btn-primary btn-notarize" data-id="${doc.id}">Simular Protocolización</button>` : '✅ Listo'}
                    </td>
                `;
                tbody.appendChild(tr);
            });

            document.querySelectorAll('.btn-notarize').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.dataset.id;
                    Store.update('documents', id, { notarized: true, notarizedAt: new Date().toISOString() });
                    UI.showToast('Documento protocolizado (Mock)', 'success');
                    this.init(); // Refresh
                });
            });
        }
    }
};

export default NotaryController;
