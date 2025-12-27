/**
 * Store.js
 * Handles persistence using localStorage with Tenant Scoping.
 * Key format: KensaUnpaper:{tenant}:{entity} (Stores array of items)
 */

const Store = {
    state: {
        tenant: null,
        user: null
    },

    init() {
        // Try to recover session
        const session = localStorage.getItem('KensaUnpaper:session');
        if (session) {
            const { tenant, user } = JSON.parse(session);
            this.state.tenant = tenant;
            this.state.user = user;
        }
    },

    login(tenant, user) {
        this.state.tenant = tenant;
        this.state.user = user;
        localStorage.setItem('KensaUnpaper:session', JSON.stringify({ tenant, user }));
        this.seedIfEmpty();
    },

    logout() {
        this.state.tenant = null;
        this.state.user = null;
        localStorage.removeItem('KensaUnpaper:session');
        window.location.hash = '#login';
    },

    getTenant() {
        return this.state.tenant;
    },

    getUser() {
        return this.state.user;
    },

    // --- CRUD Operations ---

    _getKey(entity) {
        if (!this.state.tenant) throw new Error("No tenant selected");
        return `KensaUnpaper:${this.state.tenant}:${entity}`;
    },

    getAll(entity) {
        const key = this._getKey(entity);
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    },

    getById(entity, id) {
        const items = this.getAll(entity);
        return items.find(item => item.id === id);
    },

    add(entity, item) {
        const items = this.getAll(entity);
        // Auto-generate ID if not present
        if (!item.id) item.id = crypto.randomUUID();
        item.createdAt = new Date().toISOString();
        item.updatedAt = new Date().toISOString();
        item.createdBy = this.state.user ? this.state.user.id : 'system';

        items.push(item);
        this._save(entity, items);
        return item;
    },

    update(entity, id, updates) {
        const items = this.getAll(entity);
        const index = items.findIndex(item => item.id === id);
        if (index === -1) return null;

        items[index] = { ...items[index], ...updates, updatedAt: new Date().toISOString() };
        this._save(entity, items);
        return items[index];
    },

    remove(entity, id) {
        let items = this.getAll(entity);
        items = items.filter(item => item.id !== id);
        this._save(entity, items);
    },

    _save(entity, items) {
        localStorage.setItem(this._getKey(entity), JSON.stringify(items));
    },

    // --- Seeding ---

    seedIfEmpty() {
        if (!this.state.tenant) return;

        // Seed Users if empty
        if (this.getAll('users').length === 0) {
            this.add('users', { id: 'u1', name: 'Admin User', role: 'admin', email: 'admin@kensa-unpaper.com' });
            this.add('users', { id: 'u2', name: 'Juan Agente', role: 'agent', email: 'juan@kensa-unpaper.com' });
            this.add('users', { id: 'u3', name: 'Maria Supervisor', role: 'supervisor', email: 'maria@kensa-unpaper.com' });
        }

        // Seed Stages
        if (this.getAll('stages').length === 0) {
            const stages = [
                { id: 's1', name: 'Prospecto', color: 'blue', order: 1 },
                { id: 's2', name: 'Visita Agendada', color: 'indigo', order: 2 },
                { id: 's3', name: 'Oferta Realizada', color: 'yellow', order: 3 },
                { id: 's4', name: 'Promesa Firmada', color: 'orange', order: 4 },
                { id: 's5', name: 'En Notaría', color: 'purple', order: 5 },
                { id: 's6', name: 'Cerrado Ganado', color: 'green', order: 6 },
                { id: 's7', name: 'Cerrado Perdido', color: 'red', order: 7 }
            ];
            this._save('stages', stages);
        }

        // Seed Plans
        if (this.getAll('plans').length === 0) {
            this.add('plans', { id: 'p1', name: 'Pro', price: 29990, status: 'active' });
        }
    }
};

export default Store;
