import { formatBRL, formatPct, formatPP, formatInputCurrency, formatValueToBRL, debounce, getTrendVisuals, formatTimeFromWeeks } from './utils.js';
import { fetchPortfolioData, saveState } from './api.js';
import { updateHistoryChart, renderPlan, renderEmpty, calculatePeriodReturn } from './charts.js';
import { addAporteRow, addBalanceRow, updateYearOptions, getAppState } from './ui.js';
import { calculateState } from './calculations.js';
import { updateGlobalSummary, updateGlobalProjections, aggregateGlobalEquityPoints, updateGlobalChartAndPeriodReturn, updateAssetDOM } from './dom-updater.js';
import { addFund as addFundCore, updateQuickNav as updateQuickNavCore } from './fund-manager.js';

document.addEventListener('DOMContentLoaded', function () {
    const fundsList = document.getElementById('funds-list');
    const newCapitalInput = document.getElementById('new-capital');
    const cdiRateInput = document.getElementById('cdi-rate');
    const strategySelect = document.getElementById('allocation-strategy');
    const saveStatus = document.getElementById('save-status');
    const importBtn = document.getElementById('import-json');

    // Global UI Elements
    const elements = {
        actionPlan: document.getElementById('action-plan'),
        resultsSummary: document.getElementById('results-summary'),
        totalValueDisplay: document.getElementById('total-value'),
        totalInvestedGlobalDisplay: document.getElementById('total-invested-global'),
        totalReturnGlobalDisplay: document.getElementById('total-return-global'),
        targetSumBadge: document.getElementById('target-sum-badge'),
        globalRiskMonitor: document.getElementById('global-risk-monitor'),
        quickNav: document.getElementById('quick-nav'),
    };

    // ── Core Actions ────────────────────────────────────────────────────────

    const saveData = () => {
        const state = getAppState();
        saveState(state, saveStatus);
    };

    const triggerCalculate = () => calculate();
    const debouncedCalculate = debounce(() => calculate(), 300);

    const updateQuickNav = () => updateQuickNavCore(fundsList);

    const addFund = (data = {}, suppressCalc = false) => addFundCore(data, suppressCalc, {
        calculate, debouncedCalculate, saveData, updateQuickNavFn: updateQuickNav, fundsList
    });

    // ── Calculate (Orchestrator) ────────────────────────────────────────────

    const calculate = () => {
        const state = getAppState();
        let allDatesSet = new Set();
        const results = calculateState(state, allDatesSet);

        const { calculatedAssets, capital, benchmarkSemanal } = results;

        // 1. Update global summary (patrimônio, retorno, risco)
        updateGlobalSummary(results, elements);

        // 2. Update global projections, speeds & TTM
        updateGlobalProjections(results);

        // 3. Compute unique years for dropdowns
        const uniqueYears = Array.from(results.allDatesSet)
            .map(t => new Date(t).getFullYear())
            .filter((value, index, self) => self.indexOf(value) === index)
            .sort((a, b) => b - a);

        const globalYearSelect = document.getElementById('global-year-select');
        const currentGlobalYear = globalYearSelect ? globalYearSelect.value : "";
        if (globalYearSelect) updateYearOptions(globalYearSelect, uniqueYears, currentGlobalYear);

        // 4. Determine global chart filter type
        let globalFilterType = globalYearSelect?.value;
        const globalChartFilters = document.getElementById('global-chart-filters');
        if (globalChartFilters?.dataset.customFilter) {
            globalFilterType = globalChartFilters.dataset.customFilter;
        } else if (!globalFilterType) {
            globalFilterType = document.querySelector('#global-chart-filters .active')?.dataset.filter || 'MAX';
        }

        // 5. Aggregate global equity points and render global chart
        const { globalEquityPoints, globalInvestedPoints } = aggregateGlobalEquityPoints(results);
        updateGlobalChartAndPeriodReturn(globalEquityPoints, globalInvestedPoints, results.portfolioTotalValue, globalFilterType);

        // 6. Update individual assets
        calculatedAssets.forEach(asset => {
            updateAssetDOM(asset, results.portfolioTotalValue, uniqueYears);
        });

        // 7. Render plan & save
        if (calculatedAssets.length > 0) {
            renderPlan(calculatedAssets, capital, benchmarkSemanal, elements);
        } else {
            renderEmpty(elements);
        }
    };

    // ── Process Loaded Data ─────────────────────────────────────────────────

    const processData = (data) => {
        fundsList.innerHTML = "";
        newCapitalInput.value = formatValueToBRL(data.capital) || "";
        cdiRateInput.value = data.cdi || "";
        if (data.strategy) strategySelect.value = data.strategy;

        if (data.funds) data.funds.forEach(f => addFund(f, true));
        updateQuickNav();
        setTimeout(() => calculate(), 150);
    };

    // ── Event Listeners ─────────────────────────────────────────────────────

    [newCapitalInput, cdiRateInput].forEach(i => {
        i.oninput = debouncedCalculate;
        if (i.id === 'new-capital') i.addEventListener('input', formatInputCurrency);
    });
    strategySelect.oninput = triggerCalculate;
    document.getElementById('add-fund-btn').onclick = () => addFund();
    document.getElementById('export-json').onclick = () => {
        const blob = new Blob([JSON.stringify(getAppState(), null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `portfolio-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };
    document.getElementById('import-trigger').onclick = () => importBtn.click();
    document.getElementById('clear-data').onclick = () => { localStorage.removeItem('portfolio_manager_v25_market'); location.reload(); };
    importBtn.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => { processData(JSON.parse(event.target.result)); importBtn.value = ""; };
        reader.readAsText(file);
    };

    // Global Chart Filters
    document.querySelectorAll('#global-chart-filters .filter-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('#global-chart-filters .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('global-year-select').value = "";
            document.getElementById('global-chart-filters').dataset.customFilter = '';
            document.getElementById('global-custom-period-inputs').classList.add('hidden');
            triggerCalculate();
        };
    });

    const globalYearSelectEl = document.getElementById('global-year-select');
    if (globalYearSelectEl) {
        globalYearSelectEl.onchange = () => {
            document.querySelectorAll('#global-chart-filters .filter-btn').forEach(b => b.classList.remove('active'));
            document.getElementById('global-chart-filters').dataset.customFilter = '';
            document.getElementById('global-custom-period-inputs').classList.add('hidden');
            triggerCalculate();
        };
    }

    // Global Custom Period Selector
    const globalCustomPeriodBtn = document.getElementById('global-custom-period-btn');
    const globalCustomPeriodInputs = document.getElementById('global-custom-period-inputs');
    const globalApplyCustomPeriod = document.getElementById('global-apply-custom-period');

    if (globalCustomPeriodBtn && globalCustomPeriodInputs) {
        globalCustomPeriodBtn.onclick = () => {
            globalCustomPeriodInputs.classList.toggle('hidden');
        };
    }

    if (globalApplyCustomPeriod) {
        globalApplyCustomPeriod.onclick = () => {
            const startDate = document.getElementById('global-period-start').value;
            const endDate = document.getElementById('global-period-end').value;
            if (startDate && endDate) {
                document.querySelectorAll('#global-chart-filters .filter-btn').forEach(b => b.classList.remove('active'));
                document.getElementById('global-year-select').value = "";
                document.getElementById('global-chart-filters').dataset.customFilter = `CUSTOM:${startDate}:${endDate}`;
                globalCustomPeriodInputs.classList.add('hidden');
                triggerCalculate();
            }
        };
    }

    // Global Show Invested Toggle
    const globalShowInvestedToggle = document.getElementById('global-show-invested');
    if (globalShowInvestedToggle) {
        globalShowInvestedToggle.onchange = () => triggerCalculate();
    }

    // ── Initial Load ────────────────────────────────────────────────────────

    fetchPortfolioData().then(data => {
        if (data) processData(data);
        else addFund();
    });
});
