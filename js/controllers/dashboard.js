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
                document.getElementById('kpi-amount').innerText = UI.formatMoney(0, 'UF');
            } else {
                // Calculate real totals
                const totalUf = deals
                    .filter((d) => (d.currency || 'UF') === 'UF')
                    .reduce((acc, d) => acc + (Number(d.value) || 0), 0);
                const totalClp = deals
                    .filter((d) => d.currency === 'CLP')
                    .reduce((acc, d) => acc + (Number(d.value) || 0), 0);

                let amountLabel = UI.formatMoney(totalUf, 'UF');
                if (totalClp > 0) {
                    amountLabel += ` + ${UI.formatMoney(totalClp, 'CLP')}`;
                }
                document.getElementById('kpi-amount').innerText = amountLabel;
                document.getElementById('kpi-tasks').innerText = "3"; // Mock
                document.getElementById('kpi-signatures').innerText = signatures.length;
            }
        }
    }
};

export default DashboardController;
