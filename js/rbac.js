const RBAC = {
    can(session, action, context = {}) {
        if (!session) return false;
        if (session.isKensaAdmin) return true;

        const role = session.role;

        switch (action) {
            case 'user:manage':
                return role === 'admin' || role === 'broker';
            case 'procedure:create':
            case 'procedure:read':
            case 'procedure:update':
            case 'procedure:send_invites':
            case 'procedure:grant_notary':
            case 'procedure:void_doc':
            case 'billing:read':
            case 'audit:read':
            case 'documents:write':
            case 'deals:write':
            case 'clients:write':
            case 'properties:write':
                return role === 'admin' || role === 'broker';
            case 'notary:read':
            case 'notary:upload_legalized':
            case 'notary:reject':
                return role === 'notary';
            case 'sign:external':
                return true;
            default:
                return false;
        }
    }
};

export default RBAC;
