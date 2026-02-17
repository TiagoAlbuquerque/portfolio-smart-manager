/**
 * fund-manager.js — Gestão de fundos e navegação rápida
 *
 * Responsabilidade: criação de cards de fundos (addFund) e navegação lateral (updateQuickNav).
 * Callbacks são injetadas por main.js para evitar dependência circular.
 */

import { formatValueToBRL, formatInputCurrency } from './utils.js';
import { addAporteRow, addBalanceRow } from './ui.js';

// ─── Quick Navigation ───────────────────────────────────────────────────────

export const updateQuickNav = (fundsList) => {
    const quickNav = document.getElementById('quick-nav');
    if (!quickNav) return;

    quickNav.innerHTML = '';

    const funds = Array.from(fundsList.querySelectorAll('.fund-item'));
    funds.forEach((fundEl, index) => {
        const nameInput = fundEl.querySelector('.fund-name');
        const fundName = nameInput?.value?.trim() || `Ativo ${index + 1}`;

        const badge = document.createElement('button');
        badge.className = 'px-3 py-1.5 text-[10px] font-bold bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors border border-indigo-200 shadow-sm';
        badge.textContent = fundName.length > 20 ? fundName.substring(0, 20) + '...' : fundName;
        badge.title = fundName;

        badge.addEventListener('click', () => {
            fundEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            fundEl.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.3)';
            setTimeout(() => { fundEl.style.boxShadow = ''; }, 1000);
        });

        quickNav.appendChild(badge);
    });
};

// ─── Add Fund ───────────────────────────────────────────────────────────────

/**
 * @param {Object} data - Fund data from portfolio JSON
 * @param {boolean} suppressCalc - If true, skip calculate() after adding
 * @param {Object} callbacks - { calculate, debouncedCalculate, saveData, updateQuickNavFn, fundsList }
 */
export const addFund = (data = {}, suppressCalc = false, callbacks) => {
    const { calculate, debouncedCalculate, saveData, updateQuickNavFn, fundsList } = callbacks;

    const template = document.getElementById('fund-template');
    const clone = template.content.cloneNode(true);
    const fundEl = clone.querySelector('.fund-item');

    if (data.id) {
        fundEl.id = data.id;
    } else {
        fundEl.id = 'fund-' + Math.random().toString(36).substr(2, 9);
    }

    const container = fundEl.querySelector('.aportes-container');
    const balanceContainer = fundEl.querySelector('.balance-container');
    const details = fundEl.querySelector('.details-content');
    const toggleBtn = fundEl.querySelector('.toggle-details-btn');
    const chevron = fundEl.querySelector('.chevron-icon');

    if (data.name) fundEl.querySelector('.fund-name').value = data.name;
    if (data.target) fundEl.querySelector('.fund-target-pct').value = formatValueToBRL(data.target);
    if (data.enabled !== undefined) fundEl.querySelector('.fund-active-toggle').checked = data.enabled;
    if (data.expanded) { details.classList.add('expanded'); chevron.classList.add('rotated'); }

    // ── Event wiring ──
    toggleBtn.onclick = () => {
        const isExpanding = !details.classList.contains('expanded');
        details.classList.toggle('expanded'); chevron.classList.toggle('rotated');
        if (isExpanding) { calculate(); } saveData();
    };

    fundEl.querySelector('.move-up-btn').onclick = () => { const prev = fundEl.previousElementSibling; if (prev) { fundsList.insertBefore(fundEl, prev); updateQuickNavFn(); saveData(); calculate(); } };
    fundEl.querySelector('.move-down-btn').onclick = () => { const next = fundEl.nextElementSibling; if (next) { fundsList.insertBefore(next, fundEl); updateQuickNavFn(); saveData(); calculate(); } };
    fundEl.querySelector('.fund-active-toggle').onchange = () => { calculate(); saveData(); };
    fundEl.querySelector('.fund-target-pct').oninput = debouncedCalculate;

    // Asset filter buttons
    const filterButtons = fundEl.querySelectorAll('.asset-chart-filters .filter-btn');
    const yearSelect = fundEl.querySelector('.asset-year-select');

    filterButtons.forEach(btn => {
        btn.onclick = (e) => {
            filterButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            if (yearSelect) yearSelect.value = "";
            fundEl.querySelector('.asset-chart-filters').dataset.customFilter = '';
            fundEl.querySelector('.asset-custom-period-inputs').classList.add('hidden');
            calculate();
        }
    });
    if (yearSelect) {
        yearSelect.onchange = () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            fundEl.querySelector('.asset-custom-period-inputs').classList.add('hidden');
            fundEl.querySelector('.asset-chart-filters').dataset.customFilter = '';
            calculate();
        }
    }

    // Asset custom period selector
    const assetCustomPeriodBtn = fundEl.querySelector('.asset-custom-period-btn');
    const assetCustomPeriodInputs = fundEl.querySelector('.asset-custom-period-inputs');
    const assetApplyCustomPeriod = fundEl.querySelector('.asset-apply-custom-period');

    if (assetCustomPeriodBtn && assetCustomPeriodInputs) {
        assetCustomPeriodBtn.onclick = () => {
            assetCustomPeriodInputs.classList.toggle('hidden');
        };
    }

    if (assetApplyCustomPeriod) {
        assetApplyCustomPeriod.onclick = () => {
            const startDate = fundEl.querySelector('.asset-period-start').value;
            const endDate = fundEl.querySelector('.asset-period-end').value;
            if (startDate && endDate) {
                filterButtons.forEach(b => b.classList.remove('active'));
                if (yearSelect) yearSelect.value = "";
                fundEl.querySelector('.asset-chart-filters').dataset.customFilter = `CUSTOM:${startDate}:${endDate}`;
                assetCustomPeriodInputs.classList.add('hidden');
                calculate();
            }
        };
    }

    // Asset show invested toggle
    const assetShowInvestedToggle = fundEl.querySelector('.asset-show-invested');
    if (assetShowInvestedToggle) {
        assetShowInvestedToggle.onchange = () => calculate();
    }

    fundEl.querySelector('.add-aporte-btn').onclick = () => { addAporteRow(container, {}, debouncedCalculate); calculate(); };
    fundEl.querySelector('.add-balance-btn').onclick = () => { addBalanceRow(balanceContainer, {}, debouncedCalculate); calculate(); };

    fundEl.querySelector('.remove-fund-btn').onclick = () => { fundEl.remove(); updateQuickNavFn(); calculate(); };
    fundEl.querySelector('.fund-name').oninput = () => { updateQuickNavFn(); debouncedCalculate(); };

    // Populate aportes and balances
    if (data.aportes && data.aportes.length > 0) {
        const sortedAportes = [...data.aportes].sort((a, b) => new Date(a.date) - new Date(b.date));
        sortedAportes.forEach(a => addAporteRow(container, a, debouncedCalculate));
    } else {
        addAporteRow(container, {}, debouncedCalculate);
    }

    if (data.balances && data.balances.length > 0) {
        const sortedBalances = [...data.balances].sort((a, b) => new Date(a.date) - new Date(b.date));
        sortedBalances.forEach(b => addBalanceRow(balanceContainer, b, debouncedCalculate));
    }

    fundsList.appendChild(fundEl);
    updateQuickNavFn();
    if (!suppressCalc) calculate();
};
