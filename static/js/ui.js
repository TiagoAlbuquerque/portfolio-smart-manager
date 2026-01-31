import { formatValueToBRL, formatInputCurrency, formatInputCurrencyWithNegative } from './utils.js';

export const addAporteRow = (container, data = {}, callbackOnInput, templateId = 'aporte-row-template') => {
    const template = document.getElementById(templateId);
    if (!template) return;
    const clone = template.content.cloneNode(true);
    const row = clone.querySelector('.aporte-row');
    if (data.value) row.querySelector('.aporte-value').value = formatValueToBRL(data.value);
    if (data.return) row.querySelector('.aporte-return').value = formatValueToBRL(data.return);
    if (data.date) {
        row.querySelector('.aporte-date').value = data.date;
    } else {
        row.querySelector('.aporte-date').value = new Date().toISOString().split('T')[0];
    }

    row.querySelector('.remove-aporte-btn').onclick = () => { row.remove(); if (callbackOnInput) callbackOnInput(); };
    row.querySelectorAll('input').forEach(i => {
        i.oninput = callbackOnInput;
        if (i.classList.contains('aporte-value')) {
            i.addEventListener('input', formatInputCurrency);
        }
        if (i.classList.contains('aporte-return')) {
            i.addEventListener('input', formatInputCurrencyWithNegative);
        }
    });
    container.prepend(clone);
};

export const addBalanceRow = (container, data = {}, callbackOnInput, templateId = 'balance-row-template') => {
    const template = document.getElementById(templateId);
    if (!template) return;
    const clone = template.content.cloneNode(true);
    const row = clone.querySelector('.balance-row');

    if (data.value) row.querySelector('.balance-value').value = formatValueToBRL(data.value);
    if (data.date) {
        row.querySelector('.balance-date').value = data.date;
    } else {
        row.querySelector('.balance-date').value = new Date().toISOString().split('T')[0];
    }

    row.querySelector('.remove-balance-btn').onclick = () => { row.remove(); if (callbackOnInput) callbackOnInput(); };
    row.querySelectorAll('input').forEach(i => {
        i.oninput = callbackOnInput;
        if (i.classList.contains('balance-value')) i.addEventListener('input', formatInputCurrency);
    });
    container.prepend(clone);
};

export const updateYearOptions = (select, availableYears, currentVal) => {
    if (!select) return;
    const savedVal = currentVal || select.value;
    select.innerHTML = '<option value="">Ano</option>';
    availableYears.forEach(y => {
        const opt = document.createElement('option');
        opt.value = y;
        opt.text = y;
        select.appendChild(opt);
    });

    if (availableYears.includes(parseInt(savedVal))) {
        select.value = savedVal;
    } else {
        select.value = "";
    }
};

export const getAppState = () => {
    const funds = [];
    document.querySelectorAll('.fund-item').forEach(fundEl => {
        const aportes = [];
        fundEl.querySelectorAll('.aporte-row').forEach(row => {
            aportes.push({
                value: row.querySelector('.aporte-value').value, // formated string
                return: row.querySelector('.aporte-return').value,
                date: row.querySelector('.aporte-date').value
            });
        });
        const balances = [];
        fundEl.querySelectorAll('.balance-row').forEach(row => {
            balances.push({
                date: row.querySelector('.balance-date').value,
                value: row.querySelector('.balance-value').value
            });
        });
        funds.push({
            name: fundEl.querySelector('.fund-name').value,
            enabled: fundEl.querySelector('.fund-active-toggle').checked,
            target: fundEl.querySelector('.fund-target-pct').value, // formated string
            expanded: fundEl.querySelector('.details-content').classList.contains('expanded'),
            id: fundEl.id,
            aportes,
            balances,
            // Extra metadata for UI state preservation logic if needed
            element: fundEl
        });
    });

    // Global inputs must be accessed via document or passed in. 
    // Assuming this runs in main context or we select them here.
    const capital = document.getElementById('new-capital')?.value || "";
    const cdi = document.getElementById('cdi-rate')?.value || "";
    const strategy = document.getElementById('allocation-strategy')?.value || "target";

    return { funds, capital, cdi, strategy };
};
