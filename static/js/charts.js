import { formatBRL, formatPct, getTrendVisuals, formatPP } from './utils.js';

/**
 * Calcula o retorno percentual de um período com base nos dados de patrimônio e investido.
 * 
 * Fórmula única: Retorno = Patrimônio Final / (Patrimônio Início + Aportes no Período) - 1
 * 
 * Esta fórmula é usada em TODOS os contextos de cálculo de retorno na aplicação.
 * 
 * @param {Array} equityData - Array de pontos {x: Date, y: number} do patrimônio
 * @param {Array} investedData - Array de pontos {x: Date, y: number} do investido
 * @returns {Object} { periodReturnPct, periodReturn, periodLabel }
 */
export const calculatePeriodReturn = (equityData, investedData) => {
    const result = { periodReturnPct: null, periodReturn: null, periodLabel: '' };

    if (!equityData || !investedData || equityData.length < 2 || investedData.length < 2) {
        return result;
    }

    const startEquity = equityData[0].y;
    const endEquity = equityData[equityData.length - 1].y;
    const startInvested = investedData[0].y;
    const endInvested = investedData[investedData.length - 1].y;

    // Fórmula única: Retorno = Final / (Início + Aportes) - 1
    const contributionsDuringPeriod = endInvested - startInvested;
    const base = startEquity + contributionsDuringPeriod;

    result.startEquity = startEquity;
    result.endEquity = endEquity;
    result.contributions = contributionsDuringPeriod;

    if (base > 0) {
        result.periodReturnPct = (endEquity / base) - 1;
        result.periodReturn = endEquity - base;
    }

    // Calcula label do período
    const startDate = equityData[0].x;
    const endDate = equityData[equityData.length - 1].x;
    const diffMs = endDate - startDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 31) {
        result.periodLabel = `${diffDays}d`;
    } else if (diffDays <= 365) {
        result.periodLabel = `${Math.round(diffDays / 30)}m`;
    } else {
        result.periodLabel = `${(diffDays / 365).toFixed(1)}a`;
    }

    return result;
};


// HELPER: Get value at a specific date
const getValueAtDate = (data, date, method = 'LINEAR') => {
    if (!data || data.length === 0) return 0;

    // Sort check if needed, but assuming data is sorted by caller
    if (date < data[0].x) return 0;
    if (date >= data[data.length - 1].x) return data[data.length - 1].y;

    for (let i = 0; i < data.length - 1; i++) {
        const p1 = data[i];
        const p2 = data[i + 1];

        // Skip vertical segments (same time points) e.g. in step functions
        if (p2.x.getTime() <= p1.x.getTime()) continue;

        if (date >= p1.x && date < p2.x) {
            if (method === 'STEP') return p1.y;
            // LINEAR
            const tTotal = p2.x.getTime() - p1.x.getTime();
            const tElapsed = date.getTime() - p1.x.getTime();
            return p1.y + (p2.y - p1.y) * (tElapsed / tTotal);
        }
    }
    return data[data.length - 1].y;
};

// HELPER: Filter data and ensure start point exists
const filterAndNormalizeData = (data, filterType, method = 'LINEAR') => {
    if (!data || data.length === 0) return [];
    if (filterType === 'MAX') return data;

    let startDate;
    let endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const now = new Date();

    // Determine Start Date
    if (/^\d{4}$/.test(filterType)) {
        const year = parseInt(filterType);
        startDate = new Date(year, 0, 1);
        endDate = new Date(year, 11, 31, 23, 59, 59);
    } else if (filterType && filterType.startsWith('CUSTOM:')) {
        const parts = filterType.split(':');
        if (parts.length === 3) {
            startDate = new Date(parts[1]);
            endDate = new Date(parts[2]);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
        }
    } else {
        // Relative filters
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0); // Start of that day
        const monthFilters = { '1M': 1, '2M': 2, '3M': 3, '6M': 6, '12M': 12 };
        const dayFilters = { '7D': 7, '14D': 14 };
        if (monthFilters[filterType]) {
            startDate.setMonth(now.getMonth() - monthFilters[filterType]);
        } else if (dayFilters[filterType]) {
            startDate.setDate(now.getDate() - dayFilters[filterType]);
        } else if (filterType === 'YTD') {
            startDate = new Date(now.getFullYear(), 0, 1);
        } else {
            return data; // Should not happen or Fallback
        }
    }

    // 1. Calculate value at exact start
    const valAtStart = getValueAtDate(data, startDate, method);
    const startPoint = { x: new Date(startDate), y: valAtStart };

    // 2. Filter points strictly inside the range
    const insidePoints = data.filter(d => d.x > startDate && d.x <= endDate);

    // 3. Construct new array
    const result = [startPoint, ...insidePoints];

    // Optional: Ensure end point if range extends beyond data? 
    // For now, taking the last inside point or the start point is sufficient for the span.

    return result;
}

export const updateAssetCharts = (fundEl, timeline, currentValue, balancePoints = [], filterType, showInvested = true) => {
    const lineCanvas = fundEl.querySelector('.asset-line-canvas');
    if (Chart.getChart(lineCanvas)) Chart.getChart(lineCanvas).destroy();
    const sorted = [...timeline].sort((a, b) => a.date - b.date);
    const points = [];
    const investedPoints = [];
    const now = new Date();

    // Adicionar ponto inicial (0, 0) antes do primeiro aporte
    if (sorted.length > 0) {
        const dayBeforeFirst = new Date(sorted[0].date);
        dayBeforeFirst.setDate(dayBeforeFirst.getDate() - 1);
        dayBeforeFirst.setHours(23, 59, 59, 999);
        points.push({ x: dayBeforeFirst, y: 0 });
        investedPoints.push({ x: dayBeforeFirst, y: 0 });
    }

    // Build Invested Line (Step Function)
    sorted.forEach((event, index) => {
        let investedAtT_Before = 0;
        for (let k = 0; k < index; k++) investedAtT_Before += sorted[k].value;
        let investedAtT_After = investedAtT_Before + event.value;

        if (index > 0) {
            investedPoints.push({ x: event.date, y: investedAtT_Before });
        }
        investedPoints.push({ x: event.date, y: investedAtT_After });
    });
    if (investedPoints.length > 0) {
        let totalInvestedNow = sorted.reduce((acc, curr) => acc + curr.value, 0);
        investedPoints.push({ x: now, y: totalInvestedNow });
    }

    // Build Equity Line
    if (balancePoints.length > 0) {
        if (sorted.length > 0 && sorted[0].date < balancePoints[0].date) {
            points.push({ x: sorted[0].date, y: sorted[0].value });
        }
        const sortedBalances = [...balancePoints].sort((a, b) => a.date - b.date);
        sortedBalances.forEach(p => points.push({ x: p.date, y: p.value }));
        points.push({ x: now, y: currentValue });
    } else {
        sorted.forEach((event, index) => {
            let totalAtT_Before = 0; let totalAtT_After = 0;
            for (let i = 0; i <= index; i++) {
                const pastAporte = sorted[i];
                const timeElapsed = event.date - pastAporte.date;
                const accruedReturn = pastAporte.slope * timeElapsed;
                if (i < index) totalAtT_Before += pastAporte.value + accruedReturn;
                totalAtT_After += pastAporte.value + accruedReturn;
            }
            if (index > 0) points.push({ x: event.date, y: totalAtT_Before });
            points.push({ x: event.date, y: totalAtT_After });
        });
        if (points.length > 0) points.push({ x: now, y: currentValue });
    }

    // Use NEW filtering logic
    const filteredPoints = filterAndNormalizeData(points, filterType, 'LINEAR');
    const filteredInvestedPoints = filterAndNormalizeData(investedPoints, filterType, 'STEP');

    // Calculate period return using centralized function
    const periodResult = calculatePeriodReturn(filteredPoints, filteredInvestedPoints);
    const { periodReturnPct, periodLabel } = periodResult;

    // Build datasets array conditionally
    const datasets = [
        {
            label: 'Patrimônio',
            data: filteredPoints,
            borderColor: '#4338ca',
            backgroundColor: 'rgba(67, 56, 202, 0.05)',
            fill: true,
            tension: 0.5,
            pointRadius: 0.8,
            borderWidth: 0.9
        }
    ];

    if (showInvested) {
        datasets.push({
            label: 'Investido',
            data: filteredInvestedPoints,
            borderColor: '#94a3b8',
            backgroundColor: 'transparent',
            fill: false,
            tension: 0,
            pointRadius: 0,
            borderWidth: 0.5,
            borderDash: [5, 5]
        });
    }

    new Chart(lineCanvas, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { type: 'time', display: true, ticks: { font: { size: 7 } } },
                y: { display: true, ticks: { font: { size: 7 } } }
            },
            plugins: {
                legend: { display: true, labels: { font: { size: 9 }, boxWidth: 8, usePointStyle: true } }
            }
        }
    });

    return periodResult;
};

export const updateHistoryChart = (equityData, investedData, currentVal, filterType, canvasId = 'historyChart', showInvested = true) => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return { periodReturn: null, periodReturnPct: null };
    if (Chart.getChart(canvas)) Chart.getChart(canvas).destroy();

    // Use NEW filtering logic
    const filteredEquityData = filterAndNormalizeData(equityData, filterType, 'LINEAR');
    const filteredInvestedData = filterAndNormalizeData(investedData, filterType, 'STEP');

    // Calculate period return using centralized function
    const periodResult = calculatePeriodReturn(filteredEquityData, filteredInvestedData);
    const { periodReturnPct, periodReturn, periodLabel } = periodResult;

    // Build datasets array conditionally
    const datasets = [
        {
            label: 'Patrimônio Total',
            data: filteredEquityData,
            borderColor: '#4338ca',
            fill: true,
            tension: 0.5,
            pointRadius: 0.8,
            borderWidth: 0.9,
            backgroundColor: 'rgba(67, 56, 202, 0.1)'
        }
    ];

    if (showInvested) {
        datasets.push({
            label: 'Total Investido',
            data: filteredInvestedData,
            borderColor: '#9ca3af',
            fill: false,
            tension: 0,
            pointRadius: 0,
            borderWidth: 0.5,
            borderDash: [5, 5]
        });
    }

    new Chart(canvas, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { type: 'time', display: true, ticks: { font: { size: 9 } } },
                y: { display: true, ticks: { font: { size: 9 } } }
            },
            plugins: {
                legend: { display: true, labels: { font: { size: 9 }, usePointStyle: true } }
            }
        }
    });

    return periodResult;
};

export const renderAllocationChart = (canvasId, labels, values) => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (Chart.getChart(canvas)) Chart.getChart(canvas).destroy();

    new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: ['#4f46e5', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'],
                borderWidth: 4,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            cutout: '80%'
        }
    });
};

export const renderPlan = (data, capital, benchmarkSemanal, elements) => {
    let htmlPlan = '<h4 class="text-[10px] font-black text-gray-400 uppercase mb-3 text-center tracking-widest italic underline">Plano de Execução</h4>';
    const labels = [], values = [];
    data.forEach(f => {
        labels.push(f.name); values.push(f.currentValue);
        if (f.enabled) {
            htmlPlan += `
            <div class="flex justify-between items-center p-3 rounded-2xl bg-white border border-gray-100 shadow-sm mb-2">
                <div class="flex-1 truncate pr-2">
                    <div class="text-xs font-bold text-gray-800">${f.name}</div>
                    <div class="text-[9px] font-black text-gray-400 uppercase">${f.movementReason || 'Aguardando cálculo...'}</div>
                </div>
                <div class="text-right">
                    <div class="text-[9px] font-black uppercase text-indigo-400">Novo Aporte</div>
                    <div class="text-sm font-black text-indigo-600">${formatBRL(f.movement)}</div>
                </div>
            </div>`;
        }
    });

    if (elements.actionPlan) elements.actionPlan.innerHTML = htmlPlan;

    if (elements.resultsSummary) {
        elements.resultsSummary.innerHTML = `<div class="bg-indigo-700 p-4 rounded-2xl text-white shadow-lg mb-6"><div class="flex justify-between items-center opacity-70 text-[10px] font-black uppercase mb-1"><span>Target Benchmark Semanal</span></div><div class="text-2xl font-black">${formatPP(benchmarkSemanal)}</div><div class="mt-2 pt-2 border-t border-indigo-600 flex justify-between items-center"><span class="text-[10px] font-black uppercase opacity-70">Aporte Disponível</span><span class="text-sm font-black">${formatBRL(capital)}</span></div></div>`;
    }

    renderAllocationChart('allocationChart', labels, values);
};

export const renderEmpty = (elements) => {
    if (elements.actionPlan) elements.actionPlan.innerHTML = "";
    if (elements.resultsSummary) elements.resultsSummary.innerHTML = `<div class="p-8 text-center text-gray-300 text-xs italic">Aguardando dados...</div>`;
};
