const Storage = {
    buildKey(scope, entity) {
        return `KensaUnpaper:${scope}:${entity}`;
    },

    get(scope, entity, fallback = null) {
        const key = this.buildKey(scope, entity);
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        try {
            return JSON.parse(raw);
        } catch (err) {
            console.warn('Storage parse error', key, err);
            return fallback;
        }
    },

    set(scope, entity, value) {
        const key = this.buildKey(scope, entity);
        localStorage.setItem(key, JSON.stringify(value));
    },

    list(scope, entity) {
        return this.get(scope, entity, []);
    },

    findById(scope, entity, id) {
        return this.list(scope, entity).find(item => item.id === id);
    },

    add(scope, entity, item) {
        const list = this.list(scope, entity);
        const now = new Date().toISOString();
        const record = {
            id: item.id || crypto.randomUUID(),
            createdAt: item.createdAt || now,
            updatedAt: item.updatedAt || now,
            ...item
        };
        list.push(record);
        this.set(scope, entity, list);
        return record;
    },

    update(scope, entity, id, updates) {
        const list = this.list(scope, entity);
        const index = list.findIndex(item => item.id === id);
        if (index === -1) return null;
        const now = new Date().toISOString();
        list[index] = {
            ...list[index],
            ...updates,
            updatedAt: now
        };
        this.set(scope, entity, list);
        return list[index];
    },

    remove(scope, entity, id) {
        const list = this.list(scope, entity);
        const filtered = list.filter(item => item.id !== id);
        this.set(scope, entity, filtered);
    },

    upsert(scope, entity, record, matcher = (item) => item.id === record.id) {
        const list = this.list(scope, entity);
        const index = list.findIndex(matcher);
        const now = new Date().toISOString();
        if (index === -1) {
            const created = {
                id: record.id || crypto.randomUUID(),
                createdAt: record.createdAt || now,
                updatedAt: record.updatedAt || now,
                ...record
            };
            list.push(created);
            this.set(scope, entity, list);
            return created;
        }
        list[index] = { ...list[index], ...record, updatedAt: now };
        this.set(scope, entity, list);
        return list[index];
    },

    append(scope, entity, record) {
        const list = this.list(scope, entity);
        const now = new Date().toISOString();
        const entry = {
            id: record.id || crypto.randomUUID(),
            createdAt: record.createdAt || now,
            ...record
        };
        list.push(entry);
        this.set(scope, entity, list);
        return entry;
    },

    tenantScope(tenantId) {
        return `tenant:${tenantId}`;
    }
};

export default Storage;
