const statusTransitions = {
    draft: {
        CONFIG_DONE: 'ready_to_send',
        CANCEL: 'cancelled'
    },
    ready_to_send: {
        SEND_INVITES: (procedure) => {
            if (requiresIdentity(procedure)) return 'in_identity';
            if (requiresPaymentBeforeSignature(procedure)) return 'in_payment';
            return 'in_signature';
        },
        CANCEL: 'cancelled'
    },
    in_identity: {
        IDENTITY_OK: (procedure) => {
            if (requiresPaymentBeforeSignature(procedure)) return 'in_payment';
            return 'in_signature';
        },
        CANCEL: 'cancelled',
        EXPIRE: 'expired'
    },
    in_payment: {
        PAYMENTS_OK: 'in_signature',
        CANCEL: 'cancelled',
        EXPIRE: 'expired'
    },
    in_signature: {
        SIGNED_ONE: 'partially_signed',
        SIGNED_ALL: 'fully_signed',
        CANCEL: 'cancelled',
        EXPIRE: 'expired'
    },
    partially_signed: {
        SIGNED_ONE: 'partially_signed',
        SIGNED_ALL: 'fully_signed',
        CANCEL: 'cancelled',
        EXPIRE: 'expired'
    },
    fully_signed: {
        OPEN_NOTARY: (procedure) => (procedure.notaryRequired ? 'notary_pending' : 'completed'),
        COMPLETE: 'completed',
        CANCEL: 'cancelled'
    },
    notary_pending: {
        NOTARY_OPENS: 'notary_in_review',
        NOTARY_REJECT: 'rejected',
        CANCEL: 'cancelled'
    },
    notary_in_review: {
        NOTARY_UPLOAD_APPROVE: 'notary_approved',
        NOTARY_REJECT: 'rejected',
        CANCEL: 'cancelled'
    },
    notary_approved: {
        COMPLETE: 'completed',
        CANCEL: 'cancelled'
    },
    rejected: {
        CANCEL: 'cancelled'
    },
    completed: {},
    cancelled: {},
    expired: {}
};

function requiresIdentity(procedure) {
    const mode = procedure.identityPolicy?.mode || 'none';
    return mode !== 'none';
}

function requiresPaymentBeforeSignature(procedure) {
    return procedure.paymentPolicy?.requireBeforeSignature === true;
}

function canTransition(currentStatus, event) {
    const map = statusTransitions[currentStatus] || {};
    return !!map[event];
}

function transition(procedure, event, payload = {}) {
    const current = procedure.status || 'draft';
    if (!canTransition(current, event)) {
        throw new Error(`Evento ${event} no permitido desde estado ${current}`);
    }

    const nextResolver = statusTransitions[current][event];
    const nextStatus = typeof nextResolver === 'function' ? nextResolver(procedure, payload) : nextResolver;

    const updated = {
        ...procedure,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
        lastEvent: event
    };

    updated.flags = { ...procedure.flags };

    if (event === 'IDENTITY_OK') updated.flags.identityOk = true;
    if (event === 'PAYMENTS_OK') updated.flags.paymentsOk = true;
    if (event === 'SIGNED_ALL') updated.flags.signaturesOk = true;
    if (event === 'NOTARY_UPLOAD_APPROVE') updated.flags.notaryOk = true;
    if (event === 'NOTARY_REJECT') updated.flags.notaryOk = false;
    if (event === 'COMPLETE') updated.completedAt = new Date().toISOString();

    return updated;
}

function isCompleteEligible(procedure) {
    const flags = procedure.flags || {};
    if (requiresIdentity(procedure) && !flags.identityOk) return false;
    if (requiresPaymentBeforeSignature(procedure) && !flags.paymentsOk) return false;
    if (!flags.signaturesOk) return false;
    if (procedure.notaryRequired && !flags.notaryOk) return false;
    return true;
}

export default {
    transition,
    isCompleteEligible,
    canTransition
};
