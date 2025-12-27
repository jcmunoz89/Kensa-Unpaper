import Store from '../store.js';
import UI from '../ui.js';

const DashboardController = {
    init() {
        const deals = Store.getAll('deals');
        const tasks = Store.getAll('tasks');
        const signatures = Store.getAll('signatures');

        const kpiDeals = document.getElementById('kpi-deals');
        if (kpiDeals) {
            kpiDeals.innerText = deals.length;
            if (deals.length === 0) {
                // Mock initial state if empty
                document.getElementById('kpi-deals').innerText = "0";
                document.getElementById('kpi-tasks').innerText = "0";
                document.getElementById('kpi-signatures').innerText = "0";
                document.getElementById('kpi-amount').innerText = UI.formatCurrency(0);
            } else {
                // Calculate real totals
                const totalValue = deals.reduce((acc, d) => acc + Number(d.value), 0);
                document.getElementById('kpi-amount').innerText = UI.formatCurrency(totalValue);
                document.getElementById('kpi-tasks').innerText = "3"; // Mock
                document.getElementById('kpi-signatures').innerText = signatures.length;
            }
        }
    }
};

export default DashboardController;
