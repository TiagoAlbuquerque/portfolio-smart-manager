import { formatBRL, formatPct, getTrendVisuals, formatPP } from './utils.js';

export const updateAssetCharts = (fundEl, timeline, currentValue, balancePoints = [], filterType) => {
    const lineCanvas = fundEl.querySelector('.asset-line-canvas');
    if (Chart.getChart(lineCanvas)) Chart.getChart(lineCanvas).destroy();
    const sorted = [...timeline].sort((a, b) => a.date - b.date);
    const points = [];
    const investedPoints = [];
    const now = new Date();

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

    const filteredPoints = filterDataByPeriod(points, filterType);
    const filteredInvestedPoints = filterDataByPeriod(investedPoints, filterType);

    new Chart(lineCanvas, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Patrimônio',
                    data: filteredPoints,
                    borderColor: '#4338ca',
                    backgroundColor: 'rgba(67, 56, 202, 0.05)',
                    fill: true,
                    tension: 0.1,
                    pointRadius: 1,
                    borderWidth: 2
                },
                {
                    label: 'Investido',
                    data: filteredInvestedPoints,
                    borderColor: '#94a3b8',
                    backgroundColor: 'transparent',
                    fill: false,
                    tension: 0,
                    pointRadius: 0,
                    borderWidth: 1,
                    borderDash: [5, 5]
                }
            ]
        },
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
};

export const updateHistoryChart = (equityData, investedData, currentVal, filterType, canvasId = 'historyChart') => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (Chart.getChart(canvas)) Chart.getChart(canvas).destroy();

    const filteredEquityData = filterDataByPeriod(equityData, filterType);
    const filteredInvestedData = filterDataByPeriod(investedData, filterType);

    new Chart(canvas, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Patrimônio Total',
                    data: filteredEquityData,
                    borderColor: '#4338ca',
                    fill: true,
                    tension: 0.1,
                    pointRadius: 1,
                    borderWidth: 3,
                    backgroundColor: 'rgba(67, 56, 202, 0.1)'
                },
                {
                    label: 'Total Investido',
                    data: filteredInvestedData,
                    borderColor: '#9ca3af',
                    fill: false,
                    tension: 0,
                    pointRadius: 0,
                    borderWidth: 2,
                    borderDash: [5, 5]
                }
            ]
        },
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

// Helper for charts
const filterDataByPeriod = (data, filterType) => {
    if (!data || data.length === 0) return data;
    if (filterType === 'MAX') return data;

    if (/^\d{4}$/.test(filterType)) {
        const year = parseInt(filterType);
        return data.filter(point => point.x.getFullYear() === year);
    }

    const now = new Date();
    let cutoffDate = new Date();

    if (filterType === '12M') {
        cutoffDate.setFullYear(now.getFullYear() - 1);
    } else if (filterType === 'YTD') {
        cutoffDate = new Date(now.getFullYear(), 0, 1);
    }

    return data.filter(point => point.x >= cutoffDate);
};
