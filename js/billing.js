import Storage from './storage.js';

const Billing = {
    ensureProcedureCompleted(tenantId, procedure) {
        const scope = Storage.tenantScope(tenantId);
        const events = Storage.list(scope, 'billing_events');
        const exists = events.some(e => e.type === 'procedure_completed' && e.procedureId === procedure.id);
        if (exists) return null;
        return Storage.append(scope, 'billing_events', {
            type: 'procedure_completed',
            procedureId: procedure.id,
            amount: procedure.fees?.total || 0,
            currency: 'CLP',
            createdAt: new Date().toISOString(),
            meta: {
                tenantId,
                status: procedure.status
            }
        });
    }
};

export default Billing;
