import UI from '../ui.js';

const BillingController = {
    init() {
        const btn = document.getElementById('btn-change-plan');
        if (btn) {
            btn.addEventListener('click', () => {
                UI.showToast('Funcionalidad de cambio de plan simulada.', 'info');
            });
        }
    }
};

export default BillingController;
