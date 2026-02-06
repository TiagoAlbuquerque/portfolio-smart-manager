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

export const updateAssetCharts = (fundEl, timeline, currentValue, balancePoints = [], filterType, showInvested = true) => {
    const lineCanvas = fundEl.querySelector('.asset-line-canvas');
    if (Chart.getChart(lineCanvas)) Chart.getChart(lineCanvas).destroy();
    const sorted = [...timeline].sort((a, b) => a.date - b.date);
    const points = [];
    const investedPoints = [];
    const now = new Date();

    // Adicionar ponto inicial (0, 0) antes do primeiro aporte
    // para que o cálculo de retorno considere o início real do ativo
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

    const filteredPoints = filterDataByPeriod(points, filterType);
    const filteredInvestedPoints = filterDataByPeriod(investedPoints, filterType);

    // Calculate period return using centralized function
    const { periodReturnPct, periodLabel } = calculatePeriodReturn(filteredPoints, filteredInvestedPoints);

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

    return { periodReturnPct, periodLabel };
};

export const updateHistoryChart = (equityData, investedData, currentVal, filterType, canvasId = 'historyChart', showInvested = true) => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return { periodReturn: null, periodReturnPct: null };
    if (Chart.getChart(canvas)) Chart.getChart(canvas).destroy();

    const filteredEquityData = filterDataByPeriod(equityData, filterType);
    const filteredInvestedData = filterDataByPeriod(investedData, filterType);

    // Calculate period return using centralized function
    const { periodReturnPct, periodReturn, periodLabel } = calculatePeriodReturn(filteredEquityData, filteredInvestedData);

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

    return { periodReturn, periodReturnPct, periodLabel };
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

    // Filtro por ano específico (ex: "2025")
    if (/^\d{4}$/.test(filterType)) {
        const year = parseInt(filterType);
        return data.filter(point => point.x.getFullYear() === year);
    }

    // Período personalizado: CUSTOM:YYYY-MM-DD:YYYY-MM-DD
    if (filterType && filterType.startsWith('CUSTOM:')) {
        const parts = filterType.split(':');
        if (parts.length === 3) {
            const startDate = new Date(parts[1]);
            const endDate = new Date(parts[2]);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            return data.filter(point => point.x >= startDate && point.x <= endDate);
        }
    }

    const now = new Date();
    let cutoffDate = new Date();

    // Filtros por mês: 1M, 2M, 3M, 6M, 12M
    const monthFilters = { '1M': 1, '2M': 2, '3M': 3, '6M': 6, '12M': 12 };
    if (monthFilters[filterType]) {
        cutoffDate.setMonth(now.getMonth() - monthFilters[filterType]);
    } else if (filterType === 'YTD') {
        cutoffDate = new Date(now.getFullYear(), 0, 1);
    }

    return data.filter(point => point.x >= cutoffDate);
};
