import Store from '../store.js';
import Storage from '../storage.js';
import Auth from '../auth.js';
import Audit from '../audit.js';
import UI from '../ui.js';

const DealDetailController = {
    init() {
        const params = new URLSearchParams(window.location.hash.split('?')[1]);
        const id = params.get('id');
        const deal = Store.getById('deals', id);
        const tenantId = Auth.getTenantId();
        const scope = tenantId ? Storage.tenantScope(tenantId) : null;

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

        const btnProcedure = document.getElementById('btn-create-procedure');
        if (btnProcedure) {
            btnProcedure.addEventListener('click', () => {
                if (!tenantId || !scope) return;
                const versions = Storage.list(scope, 'document_versions').filter(v => v.dealId === deal.id && !v.voidedAt);
                const latestVersion = versions.sort((a, b) => (b.version || 0) - (a.version || 0))[0];

                let versionRef = latestVersion;
                if (!versionRef) {
                    const publishedDocs = Store.getAll('documents').filter(d => d.dealId === deal.id && d.status === 'published');
                    const doc = publishedDocs[0];
                    if (doc) {
                        versionRef = { id: doc.id, title: doc.title, version: doc.version, hash: doc.hash };
                    }
                }

                if (!versionRef) {
                    UI.showToast('Debe publicar un documento antes de crear el trámite', 'warning');
                    return;
                }

                const property = Store.getById('properties', deal.propertyId);
                const packet = {
                    landlord: property ? { name: client ? client.name : 'Cliente', rut: client ? client.rut : '-' } : null,
                    tenant: client ? { name: client.name, rut: client.rut, email: client.email, phone: client.phone } : null,
                    property: property ? { address: property.address, rol: property.rol, price: property.price } : null,
                    deal: { id: deal.id, name: deal.name, value: deal.value },
                    documentVersionRef: {
                        id: versionRef.id,
                        title: versionRef.title,
                        version: versionRef.version,
                        hash: versionRef.hash
                    }
                };

                const procedure = Storage.add(scope, 'procedures', {
                    status: 'draft',
                    identityPolicy: { mode: 'either' },
                    paymentPolicy: { requireBeforeSignature: false },
                    notaryRequired: true,
                    notaryPacket: packet,
                    assignedNotary: null,
                    flags: { identityOk: false, paymentsOk: true, signaturesOk: false, notaryOk: false },
                    createdBy: Auth.getSession()?.uid || 'system'
                });

                Audit.append(tenantId, { action: 'PROCEDURE_CREATED', procedureId: procedure.id, meta: { dealId: deal.id } });
                UI.showToast('Trámite creado', 'success');
                window.location.hash = `procedure-detail?id=${procedure.id}`;
            });
        }

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
