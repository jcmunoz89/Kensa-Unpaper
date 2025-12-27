import Store from '../store.js';

const AuditController = {
    init() {
        const events = [];
        const user = Store.getUser();
        const userName = user ? user.name : 'System';

        // Collect events
        Store.getAll('deals').forEach(d => {
            events.push({ date: d.createdAt, action: 'CREATE', entity: 'Deal', detail: `Creó negocio "${d.name}"` });
            if (d.updatedAt !== d.createdAt) {
                events.push({ date: d.updatedAt, action: 'UPDATE', entity: 'Deal', detail: `Actualizó negocio "${d.name}"` });
            }
        });

        Store.getAll('clients').forEach(c => {
            events.push({ date: c.createdAt, action: 'CREATE', entity: 'Client', detail: `Registró cliente "${c.name}"` });
        });

        Store.getAll('documents').forEach(d => {
            events.push({ date: d.createdAt, action: 'CREATE', entity: 'Document', detail: `Creó documento "${d.title}"` });
            if (d.status === 'published') {
                events.push({ date: d.updatedAt, action: 'PUBLISH', entity: 'Document', detail: `Publicó documento "${d.title}" (Hash: ${d.hash ? d.hash.substring(0, 8) : '?'})` });
            }
            if (d.signed) {
                events.push({ date: d.signedAt || d.updatedAt, action: 'SIGN', entity: 'Document', detail: `Firma recibida en "${d.title}"` });
            }
            if (d.notarized) {
                events.push({ date: d.notarizedAt || d.updatedAt, action: 'NOTARIZE', entity: 'Document', detail: `Protocolizado "${d.title}"` });
            }
        });

        events.sort((a, b) => new Date(b.date) - new Date(a.date));

        const tbody = document.getElementById('audit-list');
        if (!tbody) return;

        tbody.innerHTML = '';

        events.forEach(e => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(e.date).toLocaleString()}</td>
                <td>${userName}</td>
                <td><span class="badge badge-neutral">${e.action}</span></td>
                <td>${e.entity}</td>
                <td>${e.detail}</td>
            `;
            tbody.appendChild(tr);
        });

        if (events.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem;">No hay registros de auditoría.</td></tr>';
        }
    }
};

export default AuditController;
