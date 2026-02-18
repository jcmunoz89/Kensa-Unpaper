import Store from '../store.js';
import UI from '../ui.js';

const AdminController = {
    init() {
        const stages = Store.getAll('stages').sort((a, b) => a.order - b.order);
        const list = document.getElementById('stages-list');
        if (!list) return;

        list.innerHTML = '';
        stages.forEach(stage => {
            const li = document.createElement('li');
            li.style.padding = '8px 12px';
            li.style.backgroundColor = '#F8FAFC';
            li.style.border = '1px solid var(--border)';
            li.style.borderRadius = 'var(--radius-md)';
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';

            const safeOrder = UI.escapeHTML(stage.order);
            const safeName = UI.escapeHTML(stage.name);
            const safeColor = UI.escapeHTML(stage.color);
            li.innerHTML = `
                <span style="font-weight: 500;">${safeOrder}. ${safeName}</span>
                <span class="badge badge-neutral" style="background-color: ${stage.color === 'white' ? '#eee' : stage.color + '20'}; color: ${stage.color}">${safeColor}</span>
            `;
            list.appendChild(li);
        });
    }
};

export default AdminController;
