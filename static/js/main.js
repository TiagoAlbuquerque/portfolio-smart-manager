import { formatBRL, formatPct, formatPP, formatInputCurrency, formatValueToBRL, debounce, getTrendVisuals, formatTimeFromWeeks } from './utils.js';
import { fetchPortfolioData, saveState } from './api.js';
import { updateAssetCharts, updateHistoryChart, renderPlan, renderEmpty, calculatePeriodReturn } from './charts.js';
import { addAporteRow, addBalanceRow, updateYearOptions, getAppState } from './ui.js';
import { calculateState } from './calculations.js'; // Pure calculation

document.addEventListener('DOMContentLoaded', function () {
    const fundsList = document.getElementById('funds-list');
    const newCapitalInput = document.getElementById('new-capital');
    const cdiRateInput = document.getElementById('cdi-rate');
    const strategySelect = document.getElementById('allocation-strategy');
    const saveStatus = document.getElementById('save-status');
    const importBtn = document.getElementById('import-json');
    const clearBtn = document.getElementById('clear-data');
    const importTrigger = document.getElementById('import-trigger');
    // exportBtn is used via document.getElementById in the code below so it might not need var def if consistently used that way, 
    // but looking at line 353 in previous read, it used 'importBtn' variable. 
    // Let's verify usage in the next read or just define them all to be safe.


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
        // ... add others as needed
    };

    const saveData = () => {
        const state = getAppState();
        saveState(state, saveStatus);
    };

    const triggerCalculate = () => calculate(); // Wrapper
    const debouncedCalculate = debounce(() => calculate(), 300);

    // Quick Navigation: Update navigation badges
    const updateQuickNav = () => {
        //console.log('🔍 updateQuickNav chamado');
        const quickNav = document.getElementById('quick-nav'); // Busca diretamente
        //console.log('quickNav element:', quickNav);
        if (!quickNav) {
            console.warn('⚠️ quickNav element not found!');
            return;
        }

        quickNav.innerHTML = ''; // Clear existing badges

        const funds = Array.from(fundsList.querySelectorAll('.fund-item'));
        //console.log('📊 Fundos encontrados:', funds.length);

        funds.forEach((fundEl, index) => {
            const nameInput = fundEl.querySelector('.fund-name');
            const fundName = nameInput?.value?.trim() || `Ativo ${index + 1}`;
            //console.log(`  - Fundo ${index + 1}: ${fundName}`);

            // Create badge
            const badge = document.createElement('button');
            badge.className = 'px-3 py-1.5 text-[10px] font-bold bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors border border-indigo-200 shadow-sm';
            badge.textContent = fundName.length > 20 ? fundName.substring(0, 20) + '...' : fundName;
            badge.title = fundName;

            // Scroll to fund on click
            badge.addEventListener('click', () => {
                fundEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Optional: add temporary highlight
                fundEl.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.3)';
                setTimeout(() => {
                    fundEl.style.boxShadow = '';
                }, 1000);
            });

            quickNav.appendChild(badge);
        });

        //console.log('✅ Quick nav atualizado com', funds.length, 'badges');
    };

    const addFund = (data = {}, suppressCalc = false) => {
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

        toggleBtn.onclick = () => {
            const isExpanding = !details.classList.contains('expanded');
            details.classList.toggle('expanded'); chevron.classList.toggle('rotated');
            if (isExpanding) { calculate(); } saveData();
        };

        fundEl.querySelector('.move-up-btn').onclick = () => { const prev = fundEl.previousElementSibling; if (prev) { fundsList.insertBefore(fundEl, prev); updateQuickNav(); saveData(); calculate(); } };
        fundEl.querySelector('.move-down-btn').onclick = () => { const next = fundEl.nextElementSibling; if (next) { fundsList.insertBefore(next, fundEl); updateQuickNav(); saveData(); calculate(); } };
        fundEl.querySelector('.fund-active-toggle').onchange = () => calculate();
        fundEl.querySelector('.fund-target-pct').oninput = debouncedCalculate;

        // Asset Filters
        const filterButtons = fundEl.querySelectorAll('.asset-chart-filters .filter-btn');
        const yearSelect = fundEl.querySelector('.asset-year-select');

        filterButtons.forEach(btn => {
            btn.onclick = (e) => {
                filterButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                if (yearSelect) yearSelect.value = "";
                // Clear custom period filter
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

        // Asset Custom Period Selector
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

        // Asset Show Invested Toggle
        const assetShowInvestedToggle = fundEl.querySelector('.asset-show-invested');
        if (assetShowInvestedToggle) {
            assetShowInvestedToggle.onchange = () => calculate();
        }

        fundEl.querySelector('.add-aporte-btn').onclick = () => { addAporteRow(container, {}, debouncedCalculate); calculate(); };
        fundEl.querySelector('.add-balance-btn').onclick = () => { addBalanceRow(balanceContainer, {}, debouncedCalculate); calculate(); };

        fundEl.querySelector('.remove-fund-btn').onclick = () => { fundEl.remove(); updateQuickNav(); calculate(); };
        fundEl.querySelector('.fund-name').oninput = () => { updateQuickNav(); debouncedCalculate(); };

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
        updateQuickNav(); // Update navigation badges
        if (!suppressCalc) calculate();
    };

    const processData = (data) => {
        fundsList.innerHTML = "";
        newCapitalInput.value = formatValueToBRL(data.capital) || "";
        cdiRateInput.value = data.cdi || "";
        if (data.strategy) strategySelect.value = data.strategy;

        // Disable saves during initial load
        if (data.funds) data.funds.forEach(f => addFund(f, true));
        updateQuickNav(); // Update navigation after loading all funds
        setTimeout(() => calculate(), 150);
    };

    const calculate = () => {
        const state = getAppState(); // Get RAW state from UI
        // Use calculations module
        // But note: we need assetFilterType that lives on DOM, not in getAppState result unless we add it.
        // The original logic read DOM inside calculate. We might need to hybridize or pass enriched state.
        // For simplicity reusing the DOM reads inside logic was redundant. 
        // Let's rely on the DOM elements we have access to via IDs or simple selectors outside of the pure calc.

        // Actually, `calculateState` in `calculations.js` is designed to be pure but I pasted the logic that iterates 'funds'. 
        // I need to ensure `getAppState` returns the object structure `calculateState` expects. 
        // `getAppState` returns { funds: [...], ... }. 
        // `calculateState` does `state.funds.map`. Ideally this works.
        // BUT `calculateState` logic I wrote returns the `calculatedAssets` array. It doesn't update the DOM.
        // So I need to take the result of `calculateState` and UPDATE the DOM here in `main.js`.

        let allDatesSet = new Set();
        const results = calculateState(state, allDatesSet);

        // Now Apply Results to DOM
        const { portfolioTotalValue, portfolioTotalInvested, totalTargetPct, calculatedAssets,
            globalTimeline, globalCur_First, globalCur_Last, globalAfter_First, globalAfter_Last,
            allRisks, benchmarkSemanal, capital } = results;

        // Update Global Badges
        elements.targetSumBadge.textContent = `Alvo Total: ${totalTargetPct.toFixed(1)}%`;
        elements.targetSumBadge.className = `px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${Math.abs(totalTargetPct - 100) < 0.1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`;

        elements.totalValueDisplay.textContent = formatBRL(portfolioTotalValue);
        elements.totalInvestedGlobalDisplay.textContent = `Total Investido: ${formatBRL(portfolioTotalInvested)}`;

        // Global Return Badge - using centralized function with synthetic points
        // Start: equity=0, invested=0 | End: equity=portfolioTotalValue, invested=portfolioTotalInvested
        const badgeNow = new Date();
        const badgeStartDate = new Date(badgeNow.getTime() - 1); // 1ms before to ensure 2 distinct points
        const badgeEquityPoints = [{ x: badgeStartDate, y: 0 }, { x: badgeNow, y: portfolioTotalValue }];
        const badgeInvestedPoints = [{ x: badgeStartDate, y: 0 }, { x: badgeNow, y: portfolioTotalInvested }];
        const { periodReturn: grossReturnGlobal, periodReturnPct: globalYield } = calculatePeriodReturn(badgeEquityPoints, badgeInvestedPoints);
        const trendGlobal = getTrendVisuals(grossReturnGlobal || 0);
        elements.totalReturnGlobalDisplay.innerHTML = `${trendGlobal.icon} ${formatBRL(grossReturnGlobal || 0)} <span class="opacity-75 font-normal">(${formatPct(globalYield || 0)})</span>`;
        elements.totalReturnGlobalDisplay.className = `flex justify-center items-center gap-1.5 text-xs font-bold mt-2 px-3 py-1 rounded-full border transition-all ${trendGlobal.color}`;

        // Global Risk
        if (allRisks.length > 0 && portfolioTotalValue > 0) {
            const weightedRisk = allRisks.reduce((acc, curr) => acc + (curr.v * curr.w), 0) / portfolioTotalValue;
            let globalRiskText = "Elevado";
            let globalRiskColor = "text-red-500";
            if (weightedRisk < 0.001) { globalRiskText = "Baixo"; globalRiskColor = "text-green-500"; }
            else if (weightedRisk < 0.003) { globalRiskText = "Moderado"; globalRiskColor = "text-amber-500"; }
            elements.globalRiskMonitor.textContent = `Risco Global: ${globalRiskText} (${formatPP(weightedRisk)})`;
            elements.globalRiskMonitor.className = `text-[9px] font-black uppercase mt-2 tracking-tighter ${globalRiskColor} transition-all`;
        }

        // Update Global Projections
        const updateGlob = (prefix, data) => {
            const el6 = document.getElementById(`${prefix}-6`);
            const el12 = document.getElementById(`${prefix}-12`);
            const el24 = document.getElementById(`${prefix}-24`);
            if (el6) el6.textContent = formatBRL(data[6]);
            if (el12) el12.textContent = formatBRL(data[12]);
            if (el24) el24.textContent = formatBRL(data[24]);
        };
        updateGlob('cur-first', globalCur_First); updateGlob('cur-last', globalCur_Last);
        updateGlob('after-first', globalAfter_First); updateGlob('after-last', globalAfter_Last);

        // Update Global Implied Speeds
        const calcImpliedSpeed = (initial, final, weeks) => weeks <= 0 || initial <= 0 || final <= 0 ? 0 : Math.pow(final / initial, 1 / weeks) - 1;
        const globalHistoricalSpeed = calcImpliedSpeed(portfolioTotalValue, globalCur_First[24], 104);
        const globalRecentSpeed = calcImpliedSpeed(portfolioTotalValue, globalCur_Last[24], 104);

        document.getElementById('global-cur-first-speed').textContent = formatPP(globalHistoricalSpeed);
        document.getElementById('global-cur-last-speed').textContent = formatPP(globalRecentSpeed);
        document.getElementById('global-after-first-speed').textContent = formatPP(calcImpliedSpeed(portfolioTotalValue + capital, globalAfter_First[24], 104));
        document.getElementById('global-after-last-speed').textContent = formatPP(calcImpliedSpeed(portfolioTotalValue + capital, globalAfter_Last[24], 104));

        // Update Global TTM (Time to Million)
        const updateTTM = (id, value, weeklyRate) => {
            const el = document.getElementById(id);
            if (el) {
                if (value >= 1000000) {
                    el.textContent = "Atingido! 🎉";
                } else if (weeklyRate > 0 && value > 0) {
                    const weeks = Math.log(1000000 / value) / Math.log(1 + weeklyRate);
                    el.textContent = formatTimeFromWeeks(weeks);
                } else {
                    el.textContent = "--";
                }
            }
        };

        updateTTM('cur-first-ttm', portfolioTotalValue, globalHistoricalSpeed);
        updateTTM('cur-last-ttm', portfolioTotalValue, globalRecentSpeed);
        updateTTM('after-first-ttm', portfolioTotalValue + capital, calcImpliedSpeed(portfolioTotalValue + capital, globalAfter_First[24], 104));
        updateTTM('after-last-ttm', portfolioTotalValue + capital, calcImpliedSpeed(portfolioTotalValue + capital, globalAfter_Last[24], 104));

        // Update TTM Benchmark (using CDI weekly rate)
        updateTTM('cur-benchmark-ttm', portfolioTotalValue, benchmarkSemanal);
        updateTTM('after-benchmark-ttm', portfolioTotalValue + capital, benchmarkSemanal);

        // Update Year Dropdowns (Global)
        const uniqueYears = Array.from(results.allDatesSet)
            .map(t => new Date(t).getFullYear())
            .filter((value, index, self) => self.indexOf(value) === index)
            .sort((a, b) => b - a);

        const globalYearSelect = document.getElementById('global-year-select');
        const currentGlobalYear = globalYearSelect ? globalYearSelect.value : "";
        if (globalYearSelect) updateYearOptions(globalYearSelect, uniqueYears, currentGlobalYear);

        let globalFilterType = globalYearSelect?.value;
        // Check for custom period filter first
        const globalChartFilters = document.getElementById('global-chart-filters');
        if (globalChartFilters?.dataset.customFilter) {
            globalFilterType = globalChartFilters.dataset.customFilter;
        } else if (!globalFilterType) {
            globalFilterType = document.querySelector('#global-chart-filters .active')?.dataset.filter || 'MAX';
        }

        // Update Global Chart
        // Need to reconstruct global Timeline logic if it wasn't returned perfectly or just use the aggregation logic
        // For now, let's reconstruct the points logic briefly or extract it too.
        // Actually, the previous code aggregated inside the loop. `calculateState` returns `globalTimeline`.
        // But `globalTimeline` in `calculateState` was just all points. 
        // The global chart needs {x, y} points aggregating ALL assets.
        // The `calculateState` I wrote didn't fully replicate the "Aggregate Equity per Date" logic,
        // it just pushed raw points to `globalTimeline`.
        // Let's implement the aggregation here or in charts.js using `calculatedAssets`.

        // Aggregate Global Equity Points (Post-Calculation)
        // Gerar timeline densa (diária) para gráfico suave
        const sortedDates = Array.from(results.allDatesSet).sort((a, b) => a - b);
        const minDate = sortedDates.length > 0 ? new Date(sortedDates[0]) : new Date();
        const maxDate = new Date(); // Hoje

        // Ajustar para início do dia e fim do dia
        minDate.setHours(0, 0, 0, 0);
        maxDate.setHours(23, 59, 59, 999);

        const denseDates = [];
        let curD = new Date(minDate);
        while (curD <= maxDate) {
            // Usar final do dia para garantir que aportes do dia sejam contabilizados
            const d = new Date(curD);
            d.setHours(23, 59, 59, 999);
            denseDates.push(d);
            curD.setDate(curD.getDate() + 1);
        }

        const globalEquityPoints = [];
        const globalInvestedPoints = [];

        // Adicionar ponto inicial (0, 0) um dia antes do primeiro dado
        // para que o cálculo de retorno considere o início real do portfólio
        const dayBeforeMin = new Date(minDate);
        dayBeforeMin.setDate(dayBeforeMin.getDate() - 1);
        dayBeforeMin.setHours(23, 59, 59, 999);
        globalEquityPoints.push({ x: dayBeforeMin, y: 0 });
        globalInvestedPoints.push({ x: dayBeforeMin, y: 0 });

        denseDates.forEach(date => {
            let totalEquityAtDate = 0;
            let totalInvestedAtDate = 0;

            calculatedAssets.forEach(asset => {
                // Invested (acumulado até o fim do dia)
                let assetInvested = 0;
                asset.assetTimeline.forEach(ev => { if (ev.date <= date) assetInvested += ev.value; });
                totalInvestedAtDate += assetInvested;

                // Equity
                let assetEquity = 0;

                // Usar dados expandidos (interpolação diária) OTIMIZADO
                if (asset.balancePointsExpanded && asset.balancePointsExpanded.length > 0) {
                    const expanded = asset.balancePointsExpanded;
                    const firstExpDate = expanded[0].date; // Assumido 00:00:00
                    const lastExpDate = expanded[expanded.length - 1].date;

                    // Otimização O(1): Calcular índice baseado na diferença de dias
                    // date é 23:59:59. firstExpDate é 00:00:00.
                    // Diff = (date - first) = X.99 dias. Math.floor dá o índice correto 0..N
                    if (date >= firstExpDate) {
                        if (date <= lastExpDate || (date - lastExpDate < 86400000)) { // Dentro do range ou no mesmo dia do último
                            const diffTime = date.getTime() - firstExpDate.getTime();
                            const diffDays = Math.floor(diffTime / (1000 * 3600 * 24));

                            if (diffDays >= 0 && diffDays < expanded.length) {
                                assetEquity = expanded[diffDays].value;
                            } else if (diffDays >= expanded.length) {
                                assetEquity = expanded[expanded.length - 1].value;
                            }
                        } else {
                            // Após o último registro (mantém último valor)
                            assetEquity = expanded[expanded.length - 1].value;
                        }
                    }
                    // Antes do primeiro registro = 0
                } else {
                    // Fallback para lógica original (interpolação sparse)
                    const sortedAportes = [...asset.assetTimeline].sort((a, b) => a.date - b.date);
                    sortedAportes.forEach(ev => {
                        if (ev.date > date) return;
                        assetEquity += (ev.value + (ev.slope * (date - ev.date)));
                    });
                }
                totalEquityAtDate += assetEquity;
            });
            globalEquityPoints.push({ x: date, y: totalEquityAtDate });
            globalInvestedPoints.push({ x: date, y: totalInvestedAtDate });
        });

        // Read global show invested toggle state
        const globalShowInvested = document.getElementById('global-show-invested')?.checked ?? true;
        const chartResult = updateHistoryChart(globalEquityPoints, globalInvestedPoints, portfolioTotalValue, globalFilterType, 'historyChart', globalShowInvested);

        // Update period return display
        const periodReturnValueEl = document.getElementById('period-return-value');
        if (periodReturnValueEl && chartResult) {
            if (chartResult.periodReturnPct !== null) {
                const returnPct = chartResult.periodReturnPct;
                const returnBRL = chartResult.periodReturn;
                const periodLabel = chartResult.periodLabel;
                const isPositive = returnPct >= 0;
                const colorClass = isPositive ? 'text-green-600' : 'text-red-600';
                const sign = isPositive ? '+' : '';
                periodReturnValueEl.innerHTML = `<span class="${colorClass}">${sign}${formatPct(returnPct)}</span> <span class="text-gray-400">(${periodLabel})</span>`;
            } else {
                periodReturnValueEl.textContent = '--';
            }
        }

        // Update Individual Assets UI
        calculatedAssets.forEach((asset, index) => {
            // Need the DOM element. `calculatedAssets` maps 1:1 to fundsList children. 
            // Or use the ID if we preserved it in state. `getAppState` preserved it.
            const fundEl = document.getElementById(asset.id);
            if (!fundEl) return;

            // Update badges
            const currentPct = portfolioTotalValue > 0 ? (asset.currentValue / portfolioTotalValue) * 100 : 0;
            fundEl.querySelector('.asset-compliance-pct').textContent = `${currentPct.toFixed(1)}% / ${asset.targetPct.toFixed(1)}%`;
            fundEl.querySelector('.asset-total-equity').textContent = `Património: ${formatBRL(asset.currentValue)}`;
            fundEl.querySelector('.asset-total-equity-big').textContent = `${formatBRL(asset.currentValue)}`;
            fundEl.querySelector('.asset-total-invested').textContent = `Investido: ${formatBRL(asset.sumInvestedTotal)}`;

            const currentBar = fundEl.querySelector('.asset-current-bar');
            const targetMarker = fundEl.querySelector('.target-marker');
            currentBar.style.width = `${Math.min(currentPct, 100)}%`;
            targetMarker.style.left = `${Math.min(asset.targetPct, 100)}%`;

            // Update Deviation Badge
            const devBadge = fundEl.querySelector('.asset-deviation-badge');
            if (asset.targetPct > 0) {
                const devVal = currentPct - asset.targetPct;
                const absDev = Math.abs(devVal);
                const isOver = devVal > 0;
                let judgment, colorClass, barColor;
                if (absDev < 1) { judgment = "Ideal"; colorClass = "text-green-600 bg-green-50"; barColor = "bg-green-500"; }
                else if (absDev < 5) { judgment = "Marginal"; colorClass = "text-emerald-600 bg-emerald-50"; barColor = "bg-emerald-400"; }
                else if (absDev < 10) { judgment = isOver ? "Sobre-exposto" : "Sub-exposto"; colorClass = "text-amber-600 bg-amber-50"; barColor = "bg-amber-400"; }
                else { judgment = "Rebalancear"; colorClass = "text-red-600 bg-red-50"; barColor = "bg-red-600"; }

                devBadge.textContent = `${judgment} (${(isOver ? '+' : '') + devVal.toFixed(1)}%)`;
                devBadge.className = `asset-deviation-badge text-[10px] font-black uppercase px-2 py-0.5 rounded-md inline-block shadow-sm transition-all ${colorClass}`;
                currentBar.className = `asset-current-bar h-full rounded-full transition-all duration-700 ease-out shadow-inner ${barColor}`;
            } else {
                devBadge.textContent = "--";
                devBadge.className = "asset-deviation-badge text-[10px] font-black uppercase px-2 py-0.5 rounded-md inline-block text-gray-400 bg-gray-50 border border-gray-100 shadow-sm";
                currentBar.className = "asset-current-bar h-full rounded-full transition-all duration-700 ease-out shadow-inner bg-indigo-400";
            }

            // Update Return Badge - using centralized function with synthetic points
            const assetBadgeNow = new Date();
            const assetBadgeStart = new Date(assetBadgeNow.getTime() - 1);
            const assetEquityPts = [{ x: assetBadgeStart, y: 0 }, { x: assetBadgeNow, y: asset.currentValue }];
            const assetInvestedPts = [{ x: assetBadgeStart, y: 0 }, { x: assetBadgeNow, y: asset.sumInvestedTotal }];
            const { periodReturn: grossReturn, periodReturnPct: yieldPct } = calculatePeriodReturn(assetEquityPts, assetInvestedPts);
            const trend = getTrendVisuals(grossReturn || 0);
            const returnBadge = fundEl.querySelector('.asset-return-badge');
            returnBadge.innerHTML = `${trend.icon} ${formatBRL(grossReturn || 0)} (${formatPct(yieldPct || 0)})`;
            returnBadge.className = `asset-return-badge text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 shadow-sm transition-colors ${trend.color}`;

            // Update Variability (Risk) Badge
            const varBadge = fundEl.querySelector('.asset-variability-badge');
            const vVal = asset.assetStdDev;
            let riskText = "Nulo";
            let riskColor = "text-gray-400";

            if (asset.assetTimeline.length <= 1) {
                riskText = "Dados Insuf.";
            } else if (vVal > 0) {
                if (vVal < 0.001) { riskText = "Baixo"; riskColor = "text-green-500"; }
                else if (vVal < 0.003) { riskText = "Médio"; riskColor = "text-amber-500"; }
                else { riskText = "Alto"; riskColor = "text-red-500"; }
            }
            // Use formatPP if value exists
            varBadge.textContent = `Risco: ${riskText} ${vVal > 0 ? '(' + formatPP(vVal) + ')' : ''}`;
            varBadge.className = `asset-variability-badge text-[10px] font-black uppercase px-1.5 rounded ${riskColor} bg-white shadow-sm border border-gray-100`;


            // Update Aporte Rows Metrics
            // Assuming order is preserved (it is)
            const aporteRows = fundEl.querySelectorAll('.aporte-row');
            if (asset.enrichedAportes) {
                asset.enrichedAportes.forEach((metrics, idx) => {
                    if (idx < aporteRows.length && metrics.valid) {
                        const row = aporteRows[idx];
                        row.querySelector('.metric-aporte-equity').textContent = `Hoje: ${formatBRL(metrics.totalValue)}`;
                        row.querySelector('.metric-yield').textContent = `Rent: ${formatPct(metrics.rowYield)}`;

                        const weeklyMetricEl = row.querySelector('.metric-weekly');
                        weeklyMetricEl.textContent = `Rate: ${formatPP(metrics.yieldPerWeek)}`;
                        weeklyMetricEl.className = `metric-weekly text-[10px] font-black ${metrics.yieldPerWeek < asset.benchmarkSemanal ? 'text-red-500' : 'text-indigo-600'}`;

                        const benchEl = row.querySelector('.metric-benchmark');
                        benchEl.textContent = `% Bench: ${formatPct(metrics.pctBench)}`;
                        benchEl.className = `metric-benchmark text-[10px] font-bold ${metrics.pctBench >= 1 ? 'text-green-600' : 'text-gray-400'}`;
                    }
                });
            }

            // Update Projections UI
            const proj = asset.projections;
            fundEl.querySelector('.asset-first-speed').textContent = formatPP(asset.rwFirst);
            fundEl.querySelector('.asset-last-speed').textContent = formatPP(asset.rwLast);
            fundEl.querySelector('.proj-6-first').textContent = formatBRL(proj.first[6]);
            fundEl.querySelector('.proj-6-last').textContent = formatBRL(proj.last[6]);
            fundEl.querySelector('.proj-12-first').textContent = formatBRL(proj.first[12]);
            fundEl.querySelector('.proj-12-last').textContent = formatBRL(proj.last[12]);
            fundEl.querySelector('.proj-24-first').textContent = formatBRL(proj.first[24]);
            fundEl.querySelector('.proj-24-last').textContent = formatBRL(proj.last[24]);

            // Update Asset TTM (Time to Million)
            const ttmFirstEl = fundEl.querySelector('.proj-ttm-first');
            const ttmLastEl = fundEl.querySelector('.proj-ttm-last');
            if (ttmFirstEl) {
                if (asset.currentValue >= 1000000) {
                    ttmFirstEl.textContent = "Atingido! 🎉";
                } else if (asset.rwFirst > 0) {
                    const weeks = Math.log(1000000 / asset.currentValue) / Math.log(1 + asset.rwFirst);
                    ttmFirstEl.textContent = formatTimeFromWeeks(weeks);
                } else {
                    ttmFirstEl.textContent = "--";
                }
            }
            if (ttmLastEl) {
                if (asset.currentValue >= 1000000) {
                    ttmLastEl.textContent = "Atingido! 🎉";
                } else if (asset.rwLast > 0) {
                    const weeks = Math.log(1000000 / asset.currentValue) / Math.log(1 + asset.rwLast);
                    ttmLastEl.textContent = formatTimeFromWeeks(weeks);
                } else {
                    ttmLastEl.textContent = "--";
                }
            }

            // Update Dropdown
            const assetSelect = fundEl.querySelector('.asset-year-select');
            if (assetSelect) updateYearOptions(assetSelect, uniqueYears, asset.assetFilterType);

            // Charts
            const assetChartFilters = fundEl.querySelector('.asset-chart-filters');
            let assetFilterType = assetSelect ? assetSelect.value : '';
            // Check for custom period filter first
            if (assetChartFilters?.dataset.customFilter) {
                assetFilterType = assetChartFilters.dataset.customFilter;
            } else if (!assetFilterType) {
                assetFilterType = fundEl.querySelector('.asset-chart-filters .active')?.dataset.filter || 'MAX';
            }

            if (fundEl.querySelector('.details-content').classList.contains('expanded')) {
                // Usar dados expandidos (interpolação diária) para gráficos mais suaves
                const chartBalancePoints = asset.balancePointsExpanded || asset.balancePoints;
                // Read asset show invested toggle state
                const assetShowInvested = fundEl.querySelector('.asset-show-invested')?.checked ?? true;
                const assetChartResult = updateAssetCharts(fundEl, asset.assetTimeline, asset.currentValue, chartBalancePoints, assetFilterType, assetShowInvested);

                // Update asset period return display
                const assetPeriodReturnEl = fundEl.querySelector('.asset-period-return');
                if (assetPeriodReturnEl && assetChartResult) {
                    if (assetChartResult.periodReturnPct !== null) {
                        const returnPct = assetChartResult.periodReturnPct;
                        const periodLabel = assetChartResult.periodLabel;
                        const isPositive = returnPct >= 0;
                        const colorClass = isPositive ? 'text-green-600' : 'text-red-600';
                        const sign = isPositive ? '+' : '';
                        assetPeriodReturnEl.innerHTML = `<span class="${colorClass}">${sign}${formatPct(returnPct)}</span> <span class="text-gray-400">(${periodLabel})</span>`;
                    } else {
                        assetPeriodReturnEl.textContent = '--';
                    }
                }
            }
        });

        // Render Plan & Save
        if (calculatedAssets.length > 0) {
            renderPlan(calculatedAssets, capital, benchmarkSemanal, elements);
            // In the original valid logic, we called saveData() at the end to persist new calc states? 
            // No, usually saveData is explicit. But `calculate()` might have been called by `loadData`.
            // We should only correct `saveData` on user input. 
        } else { renderEmpty(elements); }
    };

    // Initialize
    [newCapitalInput, cdiRateInput].forEach(i => {
        i.oninput = debouncedCalculate;
        if (i.id === 'new-capital') i.addEventListener('input', formatInputCurrency);
    });
    strategySelect.oninput = triggerCalculate;
    document.getElementById('add-fund-btn').onclick = () => addFund();
    document.getElementById('export-json').onclick = () => { const blob = new Blob([JSON.stringify(getAppState(), null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `portfolio-${new Date().toISOString().split('T')[0]}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); };
    document.getElementById('import-trigger').onclick = () => importBtn.click();
    document.getElementById('clear-data').onclick = () => { localStorage.removeItem('portfolio_manager_v25_market'); location.reload(); };
    importBtn.onchange = (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (event) => { processData(JSON.parse(event.target.result)); importBtn.value = ""; }; reader.readAsText(file); };

    // Global Chart Filters
    document.querySelectorAll('#global-chart-filters .filter-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('#global-chart-filters .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('global-year-select').value = ""; // Reset year
            // Clear custom period filter
            document.getElementById('global-chart-filters').dataset.customFilter = '';
            document.getElementById('global-custom-period-inputs').classList.add('hidden');
            triggerCalculate();
        };
    });

    const globalYearSelect = document.getElementById('global-year-select');
    if (globalYearSelect) {
        globalYearSelect.onchange = () => {
            document.querySelectorAll('#global-chart-filters .filter-btn').forEach(b => b.classList.remove('active')); // clear buttons
            document.getElementById('global-chart-filters').dataset.customFilter = ''; // clear custom
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
                // Clear other filters
                document.querySelectorAll('#global-chart-filters .filter-btn').forEach(b => b.classList.remove('active'));
                document.getElementById('global-year-select').value = "";
                // Store custom filter in a data attribute
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

    // Initial Load
    fetchPortfolioData().then(data => {
        if (data) processData(data);
        else addFund();
    });
});
