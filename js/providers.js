import Storage from './storage.js';

const Providers = {
    recordEvent(tenantId, provider, externalId, payload = {}) {
        const scope = Storage.tenantScope(tenantId);
        const events = Storage.list(scope, 'provider_events');
        const exists = events.find(e => e.provider === provider && e.externalId === externalId);
        if (exists) {
            return { created: false, event: exists };
        }
        const event = Storage.append(scope, 'provider_events', {
            provider,
            externalId,
            payload,
            createdAt: new Date().toISOString()
        });
        return { created: true, event };
    }
};

export default Providers;
