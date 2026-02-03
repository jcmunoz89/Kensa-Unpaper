import Storage from '../storage.js';
import Auth from '../auth.js';
import UI from '../ui.js';

const roleLabels = {
    admin: 'Administrador',
    broker: 'Broker'
};

const roleBadges = {
    admin: 'danger',
    broker: 'info'
};

const UsersController = {
    init() {
        this.tenantId = Auth.getTenantId();
        const topActions = document.getElementById('top-actions');
        const localActions = document.querySelector('.top-actions-teleport');
        topActions.innerHTML = '';
        if (localActions) {
            Array.from(localActions.children).forEach(child => topActions.appendChild(child));
        }

        this.renderUsers();

        const searchInput = document.getElementById('user-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.renderUsers());
        }

        const modal = document.getElementById('user-modal');
        const btnNew = document.getElementById('btn-new-user');
        const btnClose = document.getElementById('btn-close-user-modal');
        const form = document.getElementById('user-form');

        if (btnNew) {
            btnNew.addEventListener('click', () => {
                this.openModal();
            });
        }

        if (btnClose) {
            btnClose.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();

                const membershipId = document.getElementById('user-id').value;
                const name = document.getElementById('user-name').value.trim();
                const email = document.getElementById('user-email').value.trim();
                const role = document.getElementById('user-role').value;

                if (!this.tenantId) return;

                const membershipScope = Storage.tenantScope(this.tenantId);

                if (membershipId) {
                    const membership = Storage.findById(membershipScope, 'memberships', membershipId);
                    if (membership) {
                        Storage.update('global', 'users', membership.uid, { displayName: name, email });
                        Storage.update(membershipScope, 'memberships', membershipId, { role });
                        UI.showToast('Usuario actualizado correctamente', 'success');
                    }
                } else {
                    const uid = `u_${crypto.randomUUID()}`;
                    Storage.add('global', 'users', {
                        id: uid,
                        uid,
                        displayName: name,
                        email,
                        role
                    });
                    Storage.add(membershipScope, 'memberships', {
                        uid,
                        role,
                        status: 'active'
                    });
                    UI.showToast('Usuario creado correctamente', 'success');
                }

                modal.style.display = 'none';
                this.renderUsers();
            });
        }
    },

    openModal(record = null) {
        const modal = document.getElementById('user-modal');
        const form = document.getElementById('user-form');
        if (!modal || !form) return;

        form.reset();
        document.getElementById('user-id').value = record ? record.membershipId : '';
        document.getElementById('user-name').value = record ? record.displayName : '';
        document.getElementById('user-email').value = record ? record.email : '';
        document.getElementById('user-role').value = record ? record.role : 'broker';
        document.getElementById('user-modal-title').innerText = record ? 'Editar Usuario' : 'Nuevo Usuario';

        modal.style.display = 'flex';
    },

    renderUsers() {
        if (!this.tenantId) return;
        const users = Storage.list('global', 'users');
        const membershipScope = Storage.tenantScope(this.tenantId);
        const memberships = Storage.list(membershipScope, 'memberships');
        const tbody = document.getElementById('users-list');
        const empty = document.getElementById('users-empty');
        const searchInput = document.getElementById('user-search');
        const search = searchInput ? searchInput.value.toLowerCase() : '';

        if (!tbody) return;
        tbody.innerHTML = '';

        const records = memberships.map(m => {
            const user = users.find(u => u.uid === m.uid);
            return {
                membershipId: m.id,
                uid: m.uid,
                role: m.role,
                status: m.status,
                displayName: user ? user.displayName : 'Sin nombre',
                email: user ? user.email : '-'
            };
        });

        const filtered = records
            .filter(u => {
                const name = (u.displayName || '').toLowerCase();
                const email = (u.email || '').toLowerCase();
                const role = (u.role || '').toLowerCase();
                return name.includes(search) || email.includes(search) || role.includes(search);
            })
            .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));

        if (filtered.length === 0) {
            tbody.parentElement.style.display = 'none';
            empty.style.display = 'block';
            empty.innerHTML = UI.createEmptyState('No se encontraron usuarios.', '🧑‍💼');
            return;
        }

        tbody.parentElement.style.display = 'table';
        empty.style.display = 'none';

        const session = Auth.getSession();

        filtered.forEach(user => {
            const tr = document.createElement('tr');
            const roleLabel = roleLabels[user.role] || user.role || 'Sin rol';
            const badgeClass = roleBadges[user.role] || 'neutral';
            const isCurrent = session && session.uid === user.uid;

            tr.innerHTML = `
                <td data-label="Nombre"><strong>${user.displayName || '-'}</strong></td>
                <td data-label="Email">${user.email || '-'}</td>
                <td data-label="Rol"><span class="badge badge-${badgeClass}">${roleLabel}</span></td>
                <td data-label="Acciones">
                    <button class="btn btn-sm btn-secondary" data-action="edit">Editar</button>
                    <button class="btn btn-sm btn-danger" data-action="delete" ${isCurrent ? 'disabled title="No se puede eliminar el usuario activo"' : ''}>Eliminar</button>
                </td>
            `;

            const editBtn = tr.querySelector('[data-action="edit"]');
            editBtn.addEventListener('click', () => this.openModal(user));

            const deleteBtn = tr.querySelector('[data-action="delete"]');
            deleteBtn.addEventListener('click', () => {
                if (isCurrent) return;
                const confirmed = window.confirm(`¿Eliminar a ${user.displayName || 'este usuario'} del tenant?`);
                if (!confirmed) return;
                Storage.remove(membershipScope, 'memberships', user.membershipId);
                UI.showToast('Usuario eliminado del tenant', 'success');
                this.renderUsers();
            });

            tbody.appendChild(tr);
        });
    }
};

export default UsersController;
