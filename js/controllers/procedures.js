import Storage from '../storage.js';
import Auth from '../auth.js';
import Store from '../store.js';
import UI from '../ui.js';
import Audit from '../audit.js';

const statusBadgeMap = {
    draft: 'neutral',
    ready_to_send: 'info',
    in_identity: 'warning',
    in_payment: 'warning',
    in_signature: 'info',
    partially_signed: 'warning',
    fully_signed: 'success',
    notary_pending: 'info',
    notary_in_review: 'warning',
    notary_approved: 'success',
    completed: 'success',
    cancelled: 'danger',
    expired: 'danger',
    rejected: 'danger'
};

const ProceduresController = {
    init() {
        this.tenantId = Auth.getTenantId();
        const topActions = document.getElementById('top-actions');
        const localActions = document.querySelector('.top-actions-teleport');
        topActions.innerHTML = '';
        if (localActions) {
            Array.from(localActions.children).forEach(child => topActions.appendChild(child));
        }

        this.renderProcedures();

        const searchInput = document.getElementById('procedure-search');
        if (searchInput) searchInput.addEventListener('input', () => this.renderProcedures());

        const modal = document.getElementById('procedure-modal');
        const btnNew = document.getElementById('btn-new-procedure');
        const btnClose = document.getElementById('btn-close-procedure');
        const form = document.getElementById('procedure-form');
        const dealSelect = document.getElementById('procedure-deal');
        const docSelect = document.getElementById('procedure-doc-version');

        const loadDeals = () => {
            const deals = Store.getAll('deals');
            dealSelect.innerHTML = '<option value="">Seleccionar...</option>';
            deals.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.id;
                opt.innerText = d.name;
                dealSelect.appendChild(opt);
            });
        };

        const loadDocVersions = (dealId) => {
            const versions = this.getDocumentVersions(dealId);
            docSelect.innerHTML = '';
            if (versions.length === 0) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.innerText = 'No hay documentos publicados';
                docSelect.appendChild(opt);
                docSelect.disabled = true;
                return;
            }
            docSelect.disabled = false;
            versions.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.id;
                opt.dataset.hash = v.hash || '';
                opt.dataset.version = v.version || '1';
                opt.innerText = `${v.title || 'Documento'} v${v.version || 1}`;
                docSelect.appendChild(opt);
            });
        };

        if (btnNew) {
            btnNew.addEventListener('click', () => {
                loadDeals();
                loadDocVersions(dealSelect.value);
                modal.style.display = 'flex';
            });
        }

        if (dealSelect) {
            dealSelect.addEventListener('change', () => loadDocVersions(dealSelect.value));
        }

        if (btnClose) {
            btnClose.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                if (!this.tenantId) return;

                const dealId = dealSelect.value;
                const versionId = docSelect.value;
                if (!dealId || !versionId) {
                    UI.showToast('Selecciona un negocio y una versión de documento', 'warning');
                    return;
                }

                const deal = Store.getById('deals', dealId);
                const client = deal ? Store.getById('clients', deal.clientId) : null;
                const property = deal ? Store.getById('properties', deal.propertyId) : null;
                const dealCurrency = deal?.currency || 'UF';
                const version = this.getDocumentVersions(dealId).find(v => v.id === versionId);
                if (!deal || !version) return;

                const identityMode = document.getElementById('procedure-identity').value;
                const paymentRequired = document.getElementById('procedure-payment').value === 'true';
                const notaryRequired = document.getElementById('procedure-notary').value === 'true';

                const notaryPacket = {
                    landlord: property ? { name: client ? client.name : 'Cliente', rut: client ? client.rut : '-' } : null,
                    tenant: client ? { name: client.name, rut: client.rut, email: client.email, phone: client.phone } : null,
                    property: property ? { address: property.address, rol: property.rol, price: property.price } : null,
                    deal: { id: deal.id, name: deal.name, value: deal.value, currency: dealCurrency },
                    documentVersionRef: {
                        id: version.id,
                        version: version.version,
                        hash: version.hash,
                        title: version.title
                    }
                };

                const scope = Storage.tenantScope(this.tenantId);
                const session = Auth.getSession();
                const procedure = Storage.add(scope, 'procedures', {
                    status: 'draft',
                    identityPolicy: { mode: identityMode },
                    paymentPolicy: { requireBeforeSignature: paymentRequired },
                    notaryRequired,
                    notaryPacket,
                    amount: Number(deal.value) || 0,
                    currency: dealCurrency,
                    assignedNotary: null,
                    flags: { identityOk: identityMode === 'none', paymentsOk: !paymentRequired, signaturesOk: false, notaryOk: !notaryRequired },
                    createdBy: session ? session.uid : 'system'
                });

                Audit.append(this.tenantId, {
                    action: 'PROCEDURE_CREATED',
                    procedureId: procedure.id,
                    meta: { dealId, versionId }
                });

                modal.style.display = 'none';
                UI.showToast('Trámite creado', 'success');
                window.location.hash = `procedure-detail?id=${procedure.id}`;
            });
        }
    },

    getDocumentVersions(dealId) {
        if (!this.tenantId) return [];
        const scope = Storage.tenantScope(this.tenantId);
        const versions = Storage.list(scope, 'document_versions').filter(v => v.dealId === dealId && !v.voidedAt);
        if (versions.length > 0) return versions;

        const docs = Store.getAll('documents').filter(d => d.dealId === dealId && d.status === 'published');
        return docs.map(d => ({
            id: d.id,
            title: d.title,
            version: d.version,
            hash: d.hash
        }));
    },

    renderProcedures() {
        if (!this.tenantId) return;
        const scope = Storage.tenantScope(this.tenantId);
        const procedures = Storage.list(scope, 'procedures');
        const tbody = document.getElementById('procedures-list');
        const empty = document.getElementById('procedures-empty');
        const searchInput = document.getElementById('procedure-search');
        const search = searchInput ? searchInput.value.toLowerCase() : '';

        if (!tbody) return;
        tbody.innerHTML = '';

        const filtered = procedures.filter(p => {
            const dealName = p.notaryPacket?.deal?.name || '';
            const clientName = p.notaryPacket?.tenant?.name || '';
            return dealName.toLowerCase().includes(search) || clientName.toLowerCase().includes(search);
        });

        if (filtered.length === 0) {
            tbody.parentElement.style.display = 'none';
            empty.style.display = 'block';
            empty.innerHTML = UI.createEmptyState('No hay trámites registrados.', '🧾');
            return;
        }

        tbody.parentElement.style.display = 'table';
        empty.style.display = 'none';

        filtered.forEach(p => {
            const tr = document.createElement('tr');
            const badge = statusBadgeMap[p.status] || 'neutral';
            const notaryUser = Storage.list('global', 'users').find(u => u.uid === p.assignedNotary);
            const safeDealName = UI.escapeHTML(p.notaryPacket?.deal?.name || '-');
            const safeClientName = UI.escapeHTML(p.notaryPacket?.tenant?.name || '-');
            const safeStatus = UI.escapeHTML(p.status || '-');
            const safeNotary = UI.escapeHTML(notaryUser ? notaryUser.displayName : 'Sin asignar');
            const safeProcedureId = encodeURIComponent(p.id || '');
            tr.innerHTML = `
                <td data-label="ID">${p.id.slice(0, 6)}</td>
                <td data-label="Negocio">${safeDealName}</td>
                <td data-label="Cliente">${safeClientName}</td>
                <td data-label="Estado"><span class="badge badge-${badge}">${safeStatus}</span></td>
                <td data-label="Notario">${safeNotary}</td>
                <td data-label="Acciones">
                    <a href="#procedure-detail?id=${safeProcedureId}" class="btn btn-sm btn-ghost">Ver</a>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
};

export default ProceduresController;
