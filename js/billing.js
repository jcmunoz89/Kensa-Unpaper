import Storage from './storage.js';

const Billing = {
    resolveAmount(procedure) {
        const candidates = [
            procedure?.fees?.total,
            procedure?.amount,
            procedure?.notaryPacket?.deal?.value
        ];
        for (const candidate of candidates) {
            const value = Number(candidate);
            if (Number.isFinite(value)) return value;
        }
        return 0;
    },

    resolveCurrency(procedure) {
        return procedure?.currency || procedure?.notaryPacket?.deal?.currency || 'CLP';
    },

    ensureProcedureCompleted(tenantId, procedure) {
        const scope = Storage.tenantScope(tenantId);
        const events = Storage.list(scope, 'billing_events');
        const exists = events.some(e => e.type === 'procedure_completed' && e.procedureId === procedure.id);
        if (exists) return null;
        return Storage.append(scope, 'billing_events', {
            type: 'procedure_completed',
            procedureId: procedure.id,
            amount: this.resolveAmount(procedure),
            currency: this.resolveCurrency(procedure),
            createdAt: new Date().toISOString(),
            meta: {
                tenantId,
                status: procedure.status
            }
        });
    }
};

export default Billing;
