import Storage from './storage.js';
import Auth from './auth.js';

const Audit = {
    append(tenantId, entry) {
        const scope = Storage.tenantScope(tenantId);
        const session = Auth.getSession();
        return Storage.append(scope, 'audit_events', {
            actorUid: entry.actorUid || session?.uid || 'system',
            ...entry,
            createdAt: entry.createdAt || new Date().toISOString()
        });
    }
};

export default Audit;
