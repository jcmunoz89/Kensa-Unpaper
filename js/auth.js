import Storage from './storage.js';

const SESSION_KEY = 'KensaUnpaper:session';

const Auth = {
    getSession() {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    },

    setSession(session) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    },

    clearSession() {
        localStorage.removeItem(SESSION_KEY);
    },

    isLoggedIn() {
        return !!this.getSession();
    },

    getTenantId() {
        const session = this.getSession();
        return session ? session.tenantId || null : null;
    },

    getUser() {
        const session = this.getSession();
        if (!session) return null;
        const users = Storage.list('global', 'users');
        return users.find(u => u.uid === session.uid) || null;
    },

    hasRole(role) {
        const session = this.getSession();
        if (!session) return false;
        if (session.isKensaAdmin) return true;
        return session.role === role;
    },

    isKensaAdmin() {
        const session = this.getSession();
        return !!(session && session.isKensaAdmin);
    }
};

export default Auth;
