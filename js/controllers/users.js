import Store from '../store.js';
import UI from '../ui.js';

const roleLabels = {
    admin: 'Administrador',
    supervisor: 'Supervisor',
    agent: 'Agente'
};

const roleBadges = {
    admin: 'danger',
    supervisor: 'info',
    agent: 'neutral'
};

const UsersController = {
    init() {
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

                const id = document.getElementById('user-id').value;
                const data = {
                    name: document.getElementById('user-name').value.trim(),
                    email: document.getElementById('user-email').value.trim(),
                    role: document.getElementById('user-role').value
                };

                if (id) {
                    Store.update('users', id, data);
                    UI.showToast('Usuario actualizado correctamente', 'success');
                } else {
                    Store.add('users', data);
                    UI.showToast('Usuario creado correctamente', 'success');
                }

                modal.style.display = 'none';
                this.renderUsers();
            });
        }
    },

    openModal(user = null) {
        const modal = document.getElementById('user-modal');
        const form = document.getElementById('user-form');
        if (!modal || !form) return;

        form.reset();
        document.getElementById('user-id').value = user ? user.id : '';
        document.getElementById('user-name').value = user ? user.name : '';
        document.getElementById('user-email').value = user ? user.email : '';
        document.getElementById('user-role').value = user ? user.role : 'agent';
        document.getElementById('user-modal-title').innerText = user ? 'Editar Usuario' : 'Nuevo Usuario';

        modal.style.display = 'flex';
    },

    renderUsers() {
        const users = Store.getAll('users');
        const tbody = document.getElementById('users-list');
        const empty = document.getElementById('users-empty');
        const searchInput = document.getElementById('user-search');
        const search = searchInput ? searchInput.value.toLowerCase() : '';

        if (!tbody) return;
        tbody.innerHTML = '';

        const filtered = users
            .filter(user => {
                const name = (user.name || '').toLowerCase();
                const email = (user.email || '').toLowerCase();
                const role = (user.role || '').toLowerCase();
                return name.includes(search) || email.includes(search) || role.includes(search);
            })
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        if (filtered.length === 0) {
            tbody.parentElement.style.display = 'none';
            empty.style.display = 'block';
            empty.innerHTML = UI.createEmptyState('No se encontraron usuarios.', '🧑‍💼');
            return;
        }

        tbody.parentElement.style.display = 'table';
        empty.style.display = 'none';

        const currentUser = Store.getUser();

        filtered.forEach(user => {
            const tr = document.createElement('tr');
            const roleLabel = roleLabels[user.role] || user.role || 'Sin rol';
            const badgeClass = roleBadges[user.role] || 'neutral';
            const isCurrent = currentUser && currentUser.id === user.id;

            tr.innerHTML = `
                <td data-label="Nombre"><strong>${user.name || '-'}</strong></td>
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
                const confirmed = window.confirm(`¿Eliminar a ${user.name || 'este usuario'}?`);
                if (!confirmed) return;
                Store.remove('users', user.id);
                UI.showToast('Usuario eliminado', 'success');
                this.renderUsers();
            });

            tbody.appendChild(tr);
        });
    }
};

export default UsersController;
