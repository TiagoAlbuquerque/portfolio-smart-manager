/**
 * dom-updater.js — Atualização do DOM global e por ativo
 *
 * Responsabilidade: receber resultados de cálculos e atualizar elementos do DOM.
 * NÃO contém cálculos financeiros nem lógica de orquestração.
 */

import { formatBRL, formatPct, formatPP, getTrendVisuals, formatTimeFromWeeks } from './utils.js';
import { updateAssetCharts, updateHistoryChart, calculatePeriodReturn } from './charts.js';
import { updateYearOptions } from './ui.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

const calcImpliedSpeed = (initial, final, weeks) =>
    weeks <= 0 || initial <= 0 || final <= 0 ? 0 : Math.pow(final / initial, 1 / weeks) - 1;

const updateTTM = (id, value, weeklyRate) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (value >= 1000000) {
        el.textContent = "Atingido! 🎉";
    } else if (weeklyRate > 0 && value > 0) {
        const weeks = Math.log(1000000 / value) / Math.log(1 + weeklyRate);
        el.textContent = formatTimeFromWeeks(weeks);
    } else {
        el.textContent = "--";
    }
};

// ─── Global Summary (patrimônio, retorno, risco) ────────────────────────────

export const updateGlobalSummary = (results, elements) => {
    const { portfolioTotalValue, portfolioTotalInvested, totalTargetPct, allRisks } = results;

    // Target badge
    elements.targetSumBadge.textContent = `Alvo Total: ${totalTargetPct.toFixed(1)}%`;
    elements.targetSumBadge.className = `px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${Math.abs(totalTargetPct - 100) < 0.1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`;

    // Patrimônio e investido
    elements.totalValueDisplay.textContent = formatBRL(portfolioTotalValue);
    elements.totalInvestedGlobalDisplay.textContent = `Total Investido: ${formatBRL(portfolioTotalInvested)}`;

    // Global return badge
    const badgeNow = new Date();
    const badgeStartDate = new Date(badgeNow.getTime() - 1);
    const badgeEquityPoints = [{ x: badgeStartDate, y: 0 }, { x: badgeNow, y: portfolioTotalValue }];
    const badgeInvestedPoints = [{ x: badgeStartDate, y: 0 }, { x: badgeNow, y: portfolioTotalInvested }];
    const { periodReturn: grossReturnGlobal, periodReturnPct: globalYield } = calculatePeriodReturn(badgeEquityPoints, badgeInvestedPoints);
    const trendGlobal = getTrendVisuals(grossReturnGlobal || 0);
    elements.totalReturnGlobalDisplay.innerHTML = `${trendGlobal.icon} ${formatBRL(grossReturnGlobal || 0)} <span class="opacity-75 font-normal">(${formatPct(globalYield || 0)})</span>`;
    elements.totalReturnGlobalDisplay.className = `flex justify-center items-center gap-1.5 text-xs font-bold mt-2 px-3 py-1 rounded-full border transition-all ${trendGlobal.color}`;

    // Global risk
    if (allRisks.length > 0 && portfolioTotalValue > 0) {
        const weightedRisk = allRisks.reduce((acc, curr) => acc + (curr.v * curr.w), 0) / portfolioTotalValue;
        let globalRiskText = "Elevado";
        let globalRiskColor = "text-red-500";
        if (weightedRisk < 0.001) { globalRiskText = "Baixo"; globalRiskColor = "text-green-500"; }
        else if (weightedRisk < 0.003) { globalRiskText = "Moderado"; globalRiskColor = "text-amber-500"; }
        elements.globalRiskMonitor.textContent = `Risco Global: ${globalRiskText} (${formatPP(weightedRisk)})`;
        elements.globalRiskMonitor.className = `text-[9px] font-black uppercase mt-2 tracking-tighter ${globalRiskColor} transition-all`;
    }
};

// ─── Global Projections, Speeds & TTM ───────────────────────────────────────

export const updateGlobalProjections = (results) => {
    const { portfolioTotalValue, globalCur_First, globalCur_Last, globalAfter_First, globalAfter_Last, benchmarkSemanal, capital } = results;

    // Projection values (6, 12, 24 months)
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

    // Implied speeds (based on 24-month projection)
    const globalHistoricalSpeed = calcImpliedSpeed(portfolioTotalValue, globalCur_First[24], 104);
    const globalRecentSpeed = calcImpliedSpeed(portfolioTotalValue, globalCur_Last[24], 104);

    document.getElementById('global-cur-first-speed').textContent = formatPP(globalHistoricalSpeed);
    document.getElementById('global-cur-last-speed').textContent = formatPP(globalRecentSpeed);
    document.getElementById('global-after-first-speed').textContent = formatPP(calcImpliedSpeed(portfolioTotalValue + capital, globalAfter_First[24], 104));
    document.getElementById('global-after-last-speed').textContent = formatPP(calcImpliedSpeed(portfolioTotalValue + capital, globalAfter_Last[24], 104));

    // TTM (Time to Million) — current
    updateTTM('cur-first-ttm', portfolioTotalValue, globalHistoricalSpeed);
    updateTTM('cur-last-ttm', portfolioTotalValue, globalRecentSpeed);

    // TTM — after contribution
    updateTTM('after-first-ttm', portfolioTotalValue + capital, calcImpliedSpeed(portfolioTotalValue + capital, globalAfter_First[24], 104));
    updateTTM('after-last-ttm', portfolioTotalValue + capital, calcImpliedSpeed(portfolioTotalValue + capital, globalAfter_Last[24], 104));

    // TTM benchmark (CDI)
    updateTTM('cur-benchmark-ttm', portfolioTotalValue, benchmarkSemanal);
    updateTTM('after-benchmark-ttm', portfolioTotalValue + capital, benchmarkSemanal);
};

// ─── Global Equity Aggregation (data for chart) ─────────────────────────────

export const aggregateGlobalEquityPoints = (results) => {
    const { calculatedAssets } = results;
    const sortedDates = Array.from(results.allDatesSet).sort((a, b) => a - b);
    const minDate = sortedDates.length > 0 ? new Date(sortedDates[0]) : new Date();
    const maxDate = new Date();

    minDate.setHours(0, 0, 0, 0);
    maxDate.setHours(23, 59, 59, 999);

    const denseDates = [];
    let curD = new Date(minDate);
    while (curD <= maxDate) {
        const d = new Date(curD);
        d.setHours(23, 59, 59, 999);
        denseDates.push(d);
        curD.setDate(curD.getDate() + 1);
    }

    const globalEquityPoints = [];
    const globalInvestedPoints = [];

    // Initial point (0,0) one day before first data
    const dayBeforeMin = new Date(minDate);
    dayBeforeMin.setDate(dayBeforeMin.getDate() - 1);
    dayBeforeMin.setHours(23, 59, 59, 999);
    globalEquityPoints.push({ x: dayBeforeMin, y: 0 });
    globalInvestedPoints.push({ x: dayBeforeMin, y: 0 });

    denseDates.forEach(date => {
        let totalEquityAtDate = 0;
        let totalInvestedAtDate = 0;

        calculatedAssets.forEach(asset => {
            // Invested (accumulated up to end of day)
            let assetInvested = 0;
            asset.assetTimeline.forEach(ev => { if (ev.date <= date) assetInvested += ev.value; });
            totalInvestedAtDate += assetInvested;

            // Equity
            let assetEquity = 0;
            if (asset.balancePointsExpanded && asset.balancePointsExpanded.length > 0) {
                const expanded = asset.balancePointsExpanded;
                const firstExpDate = expanded[0].date;
                const lastExpDate = expanded[expanded.length - 1].date;

                // O(1) index calculation based on day difference
                if (date >= firstExpDate) {
                    if (date <= lastExpDate || (date - lastExpDate < 86400000)) {
                        const diffTime = date.getTime() - firstExpDate.getTime();
                        const diffDays = Math.floor(diffTime / (1000 * 3600 * 24));
                        if (diffDays >= 0 && diffDays < expanded.length) {
                            assetEquity = expanded[diffDays].value;
                        } else if (diffDays >= expanded.length) {
                            assetEquity = expanded[expanded.length - 1].value;
                        }
                    } else {
                        assetEquity = expanded[expanded.length - 1].value;
                    }
                }
            } else {
                // Fallback: sparse interpolation
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

    return { globalEquityPoints, globalInvestedPoints };
};

// ─── Global Chart + Period Return Display ───────────────────────────────────

export const updateGlobalChartAndPeriodReturn = (globalEquityPoints, globalInvestedPoints, portfolioTotalValue, globalFilterType) => {
    const globalShowInvested = document.getElementById('global-show-invested')?.checked ?? true;
    const chartResult = updateHistoryChart(globalEquityPoints, globalInvestedPoints, portfolioTotalValue, globalFilterType, 'historyChart', globalShowInvested);

    // Update period return display
    const periodReturnValueEl = document.getElementById('period-return-value');
    const periodStartEquityEl = document.getElementById('period-start-equity');
    const periodContributionsEl = document.getElementById('period-contributions');
    const periodEndEquityEl = document.getElementById('period-end-equity');

    if (periodReturnValueEl && chartResult) {
        if (chartResult.periodReturnPct !== null) {
            const returnPct = chartResult.periodReturnPct;
            const periodLabel = chartResult.periodLabel;
            const isPositive = returnPct >= 0;
            const colorClass = isPositive ? 'text-green-600' : 'text-red-600';
            const sign = isPositive ? '+' : '';
            periodReturnValueEl.innerHTML = `<span class="${colorClass}">${sign}${formatPct(returnPct)}</span> <span class="text-gray-400">(${periodLabel})</span>`;
            if (periodStartEquityEl) periodStartEquityEl.textContent = formatBRL(chartResult.startEquity);
            if (periodContributionsEl) periodContributionsEl.textContent = formatBRL(chartResult.contributions);
            if (periodEndEquityEl) periodEndEquityEl.textContent = formatBRL(chartResult.endEquity);
        } else {
            periodReturnValueEl.textContent = '--';
            if (periodStartEquityEl) periodStartEquityEl.textContent = '--';
            if (periodContributionsEl) periodContributionsEl.textContent = '--';
            if (periodEndEquityEl) periodEndEquityEl.textContent = '--';
        }
    }
};

// ─── Per-Asset DOM Update ───────────────────────────────────────────────────

export const updateAssetDOM = (asset, portfolioTotalValue, uniqueYears) => {
    const fundEl = document.getElementById(asset.id);
    if (!fundEl) return;

    // ── Compliance badges ──
    const currentPct = portfolioTotalValue > 0 ? (asset.currentValue / portfolioTotalValue) * 100 : 0;
    fundEl.querySelector('.asset-compliance-pct').textContent = `${currentPct.toFixed(1)}% / ${asset.targetPct.toFixed(1)}%`;
    fundEl.querySelector('.asset-total-equity').textContent = `Património: ${formatBRL(asset.currentValue)}`;
    fundEl.querySelector('.asset-total-equity-big').textContent = `${formatBRL(asset.currentValue)}`;
    fundEl.querySelector('.asset-total-invested').textContent = `Investido: ${formatBRL(asset.sumInvestedTotal)}`;

    const currentBar = fundEl.querySelector('.asset-current-bar');
    const targetMarker = fundEl.querySelector('.target-marker');
    currentBar.style.width = `${Math.min(currentPct, 100)}%`;
    targetMarker.style.left = `${Math.min(asset.targetPct, 100)}%`;

    // ── Deviation badge ──
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

    // ── Return badge ──
    const assetBadgeNow = new Date();
    const assetBadgeStart = new Date(assetBadgeNow.getTime() - 1);
    const assetEquityPts = [{ x: assetBadgeStart, y: 0 }, { x: assetBadgeNow, y: asset.currentValue }];
    const assetInvestedPts = [{ x: assetBadgeStart, y: 0 }, { x: assetBadgeNow, y: asset.sumInvestedTotal }];
    const { periodReturn: grossReturn, periodReturnPct: yieldPct } = calculatePeriodReturn(assetEquityPts, assetInvestedPts);
    const trend = getTrendVisuals(grossReturn || 0);
    const returnBadge = fundEl.querySelector('.asset-return-badge');
    returnBadge.innerHTML = `${trend.icon} ${formatBRL(grossReturn || 0)} (${formatPct(yieldPct || 0)})`;
    returnBadge.className = `asset-return-badge text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 shadow-sm transition-colors ${trend.color}`;

    // ── Risk badge ──
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
    varBadge.textContent = `Risco: ${riskText} ${vVal > 0 ? '(' + formatPP(vVal) + ')' : ''}`;
    varBadge.className = `asset-variability-badge text-[10px] font-black uppercase px-1.5 rounded ${riskColor} bg-white shadow-sm border border-gray-100`;

    // ── Aporte rows metrics ──
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

    // ── Projections ──
    const proj = asset.projections;
    fundEl.querySelector('.asset-first-speed').textContent = formatPP(asset.rwFirst);
    fundEl.querySelector('.asset-last-speed').textContent = formatPP(asset.rwLast);
    fundEl.querySelector('.proj-6-first').textContent = formatBRL(proj.first[6]);
    fundEl.querySelector('.proj-6-last').textContent = formatBRL(proj.last[6]);
    fundEl.querySelector('.proj-12-first').textContent = formatBRL(proj.first[12]);
    fundEl.querySelector('.proj-12-last').textContent = formatBRL(proj.last[12]);
    fundEl.querySelector('.proj-24-first').textContent = formatBRL(proj.first[24]);
    fundEl.querySelector('.proj-24-last').textContent = formatBRL(proj.last[24]);

    // ── Asset TTM ──
    const ttmFirstEl = fundEl.querySelector('.proj-ttm-first');
    const ttmLastEl = fundEl.querySelector('.proj-ttm-last');
    if (ttmFirstEl) {
        if (asset.currentValue >= 1000000) { ttmFirstEl.textContent = "Atingido! 🎉"; }
        else if (asset.rwFirst > 0) {
            const weeks = Math.log(1000000 / asset.currentValue) / Math.log(1 + asset.rwFirst);
            ttmFirstEl.textContent = formatTimeFromWeeks(weeks);
        } else { ttmFirstEl.textContent = "--"; }
    }
    if (ttmLastEl) {
        if (asset.currentValue >= 1000000) { ttmLastEl.textContent = "Atingido! 🎉"; }
        else if (asset.rwLast > 0) {
            const weeks = Math.log(1000000 / asset.currentValue) / Math.log(1 + asset.rwLast);
            ttmLastEl.textContent = formatTimeFromWeeks(weeks);
        } else { ttmLastEl.textContent = "--"; }
    }

    // ── Year dropdown ──
    const assetSelect = fundEl.querySelector('.asset-year-select');
    if (assetSelect) updateYearOptions(assetSelect, uniqueYears, asset.assetFilterType);

    // ── Chart (only if expanded) ──
    const assetChartFilters = fundEl.querySelector('.asset-chart-filters');
    let assetFilterType = assetSelect ? assetSelect.value : '';
    if (assetChartFilters?.dataset.customFilter) {
        assetFilterType = assetChartFilters.dataset.customFilter;
    } else if (!assetFilterType) {
        assetFilterType = fundEl.querySelector('.asset-chart-filters .active')?.dataset.filter || 'MAX';
    }

    if (fundEl.querySelector('.details-content').classList.contains('expanded')) {
        const chartBalancePoints = asset.balancePointsExpanded || asset.balancePoints;
        const assetShowInvested = fundEl.querySelector('.asset-show-invested')?.checked ?? true;
        const assetChartResult = updateAssetCharts(fundEl, asset.assetTimeline, asset.currentValue, chartBalancePoints, assetFilterType, assetShowInvested);

        // Update asset period return display
        const assetPeriodReturnEl = fundEl.querySelector('.asset-period-return');
        const assetStartEquityEl = fundEl.querySelector('.asset-period-start-equity');
        const assetContributionsEl = fundEl.querySelector('.asset-period-contributions');
        const assetEndEquityEl = fundEl.querySelector('.asset-period-end-equity');
        if (assetPeriodReturnEl && assetChartResult) {
            if (assetChartResult.periodReturnPct !== null) {
                const returnPct = assetChartResult.periodReturnPct;
                const periodLabel = assetChartResult.periodLabel;
                const isPositive = returnPct >= 0;
                const colorClass = isPositive ? 'text-green-600' : 'text-red-600';
                const sign = isPositive ? '+' : '';
                assetPeriodReturnEl.innerHTML = `<span class="${colorClass}">${sign}${formatPct(returnPct)}</span> <span class="text-gray-400">(${periodLabel})</span>`;
                if (assetStartEquityEl) assetStartEquityEl.textContent = formatBRL(assetChartResult.startEquity);
                if (assetContributionsEl) assetContributionsEl.textContent = formatBRL(assetChartResult.contributions);
                if (assetEndEquityEl) assetEndEquityEl.textContent = formatBRL(assetChartResult.endEquity);
            } else {
                assetPeriodReturnEl.textContent = '--';
                if (assetStartEquityEl) assetStartEquityEl.textContent = '--';
                if (assetContributionsEl) assetContributionsEl.textContent = '--';
                if (assetEndEquityEl) assetEndEquityEl.textContent = '--';
            }
        }
    }
};
