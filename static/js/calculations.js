import { parseBRL, formatBRL, formatPct, formatPP, getTrendVisuals } from './utils.js';

// ============================================================================
// FUNÇÕES DE INTERPOLAÇÃO DE SALDOS
// ============================================================================

/**
 * Encontra o saldo interpolado em uma data específica
 * Usa interpolação linear entre os dois pontos mais próximos
 * @param {Array} balancePoints - Array de {date: Date, value: number}
 * @param {Date} targetDate - Data para buscar o saldo
 * @returns {number|null} - Valor interpolado ou null se não há dados
 */
const getBalanceAtDate = (balancePoints, targetDate) => {
    if (!balancePoints || balancePoints.length === 0) return null;

    const sorted = [...balancePoints].sort((a, b) => a.date - b.date);
    const targetTime = targetDate.getTime();

    // Se a data é antes do primeiro registro, não temos dados
    if (targetTime < sorted[0].date.getTime()) return null;

    // Se a data é após ou igual ao último registro, retorna o último valor
    if (targetTime >= sorted[sorted.length - 1].date.getTime()) {
        return sorted[sorted.length - 1].value;
    }

    // Encontra os dois pontos para interpolação
    for (let i = 0; i < sorted.length - 1; i++) {
        const p1 = sorted[i];
        const p2 = sorted[i + 1];
        const t1 = p1.date.getTime();
        const t2 = p2.date.getTime();

        if (targetTime >= t1 && targetTime <= t2) {
            // Interpolação linear: valor = v1 + (v2 - v1) * (t - t1) / (t2 - t1)
            if (t2 === t1) return p2.value;
            const ratio = (targetTime - t1) / (t2 - t1);
            return p1.value + (p2.value - p1.value) * ratio;
        }
    }

    return null;
};

/**
 * Expande balancePoints para incluir valores interpolados diários
 * Gera um ponto para cada dia desde o primeiro registro até hoje
 * LIMITE: máximo 730 dias (2 anos) para evitar problemas de performance
 * Dados NÃO são salvos, apenas usados em memória
 * @param {Array} balancePoints - Array original de {date: Date, value: number}
 * @param {Date} endDate - Data final (default: hoje)
 * @returns {Array} - Array expandido com valores diários
 */
const expandBalancePointsDaily = (balancePoints, endDate = new Date()) => {
    if (!balancePoints || balancePoints.length === 0) return [];

    const sorted = [...balancePoints].sort((a, b) => a.date - b.date);
    const startDate = new Date(sorted[0].date);
    startDate.setHours(0, 0, 0, 0);

    const finalDate = new Date(endDate);
    finalDate.setHours(23, 59, 59, 999);

    const expanded = [];
    const current = new Date(startDate);

    // Limite de segurança: máximo 10000 dias (aprox 27 anos)
    const MAX_DAYS = 10000;
    let dayCount = 0;

    while (current <= finalDate && dayCount < MAX_DAYS) {
        const value = getBalanceAtDate(sorted, current);
        if (value !== null) {
            expanded.push({
                date: new Date(current),
                value: value
            });
        }
        current.setDate(current.getDate() + 1);
        dayCount++;
    }

    return expanded;
};

// ============================================================================

export const calculateState = (state, allDatesSet) => {
    const capital = parseBRL(state.capital);
    const benchmarkAnual = (parseFloat(state.cdi.replace(',', '.').replace('%', '')) || 0) / 100;
    const benchmarkSemanal = Math.pow(1 + benchmarkAnual, 1 / 52) - 1;
    const allocationStrategy = state.strategy;
    const today = new Date(); // Use passed today or new Date? Context is important.

    let portfolioTotalValue = 0;
    let portfolioTotalInvested = 0;
    let totalTargetPct = 0;
    let globalTimeline = [];
    let assetsAnalysis = [];
    let allRisks = [];
    let navItems = [];

    // Global Projections
    let globalCur_First = { 6: 0, 12: 0, 24: 0 };
    let globalCur_Last = { 6: 0, 12: 0, 24: 0 };
    let globalAfter_First = { 6: 0, 12: 0, 24: 0 };
    let globalAfter_Last = { 6: 0, 12: 0, 24: 0 };

    if (!allDatesSet) allDatesSet = new Set();
    allDatesSet.add(today.getTime());

    // Process Funds (Logic extracted from calculate loop)
    // IMPORTANT: The original code manipulated DOM elements inside the loop. 
    // We need to Separate DOM updates from Calculation.
    // Ideally, this function should return a pure state object to be rendered.
    // For now, to minimize risk of big refactor, we will keep DOM references passed in the 'state.funds' if possible
    // OR we iterate over the DOM elements in the UI layer and pass data here. 

    // To cleanly separate, `calculateState` should take pure data objects and return calculated results.
    // However, the original code reads DOM inputs directly.
    // Let's assume the calling code gathers the data first (getAppState logic) and passes it here.

    // Actually, `getAppState` returns the pure data structure.
    // Let's work with that.

    const calculatedAssets = state.funds.map(fund => {
        let sumInvestedTotal = 0, sumReturnTotal = 0, assetTimeline = [];
        let lastAporteData = null;
        let firstAporteData = null;
        let assetSpeeds = [];

        const targetPct = parseBRL(fund.target) || 0;
        totalTargetPct += targetPct;

        const enrichedAportes = [];
        // Process Aportes
        fund.aportes.forEach(currAporte => {
            const val = parseBRL(currAporte.value);
            const ret = parseBRL(currAporte.return);
            const dateStr = currAporte.date;

            let rowMetrics = { val, ret, dateStr, valid: false };

            if (val > 0 && dateStr) {
                const d = new Date(dateStr);
                allDatesSet.add(d.getTime());

                const daysElapsed = Math.max((today - d) / (1000 * 60 * 60 * 24), 1);
                const rowYield = ret / val;
                const weeksInPeriod = daysElapsed / 7;
                let yieldPerWeek = Math.pow(1 + rowYield, 1 / weeksInPeriod) - 1;
                if (isNaN(yieldPerWeek)) yieldPerWeek = 0;

                const periodBenchmark = Math.pow(1 + benchmarkAnual, daysElapsed / 365) - 1;
                let pctBench = 0;
                if (Math.abs(periodBenchmark) > 0) {
                    pctBench = rowYield / periodBenchmark;
                }

                // Keep track for stats
                sumInvestedTotal += val; sumReturnTotal += ret;
                assetSpeeds.push(yieldPerWeek);

                const slope = ret / (today - d);
                assetTimeline.push({ date: d, value: val, ret: ret, slope: slope });
                globalTimeline.push({ date: d, value: val });

                if (!lastAporteData || d > lastAporteData.date) {
                    lastAporteData = { date: d, yieldPerWeek, value: val, ret: ret };
                }
                if (!firstAporteData || d < firstAporteData.date) {
                    firstAporteData = { date: d, yieldPerWeek, value: val }; // Incluindo value
                }

                rowMetrics = {
                    valid: true,
                    val, ret, dateStr,
                    totalValue: val + ret,
                    rowYield,
                    yieldPerWeek,
                    pctBench
                };
            }
            enrichedAportes.push(rowMetrics);
        });

        // Process Balances
        let balancePoints = [];
        fund.balances.forEach(b => {
            const val = parseBRL(b.value);
            const dateStr = b.date;
            if (val > 0 && dateStr) {
                const d = new Date(dateStr);
                allDatesSet.add(d.getTime());
                balancePoints.push({ date: d, value: val });
            }
        });

        // Criar pontos para expansão (copiando originais)
        let pointsForExpansion = [...balancePoints];

        // Se houver aportes mas os saldos começarem depois, usar o primeiro aporte como ponto inicial
        if (firstAporteData) {
            // Ordenar por data para garantir verificação correta
            pointsForExpansion.sort((a, b) => a.date - b.date);

            // Se não houver pontos de saldo OU o primeiro saldo for POSTERIOR ao primeiro aporte
            if (pointsForExpansion.length === 0 || pointsForExpansion[0].date > firstAporteData.date) {
                // Adicionar ponto virtual na data do primeiro aporte com o valor investido
                // Isso garante que o gráfico comece no aporte e não apenas no primeiro saldo manual
                pointsForExpansion.unshift({
                    date: firstAporteData.date,
                    value: firstAporteData.value
                });
            }
        }

        // Criar versão expandida com interpolação diária (para gráficos e cálculos)
        // Estes dados NÃO são salvos, apenas usados em memória
        const balancePointsExpanded = expandBalancePointsDaily(pointsForExpansion, today);

        let rwFirst = firstAporteData ? firstAporteData.yieldPerWeek : 0;
        let rwLast = lastAporteData ? lastAporteData.yieldPerWeek : 0;

        let assetStdDev = 0;
        if (assetSpeeds.length > 1) {
            const avgS = assetSpeeds.reduce((a, b) => a + b, 0) / assetSpeeds.length;
            const variance = assetSpeeds.reduce((a, b) => a + Math.pow(b - avgS, 2), 0) / assetSpeeds.length;
            assetStdDev = Math.sqrt(variance);
        }

        let currentValue = sumInvestedTotal + sumReturnTotal;
        if (balancePoints.length > 0) {
            const sortedBalances = [...balancePoints].sort((a, b) => a.date - b.date);
            currentValue = sortedBalances[sortedBalances.length - 1].value;
            sumReturnTotal = currentValue - sumInvestedTotal;
        }

        portfolioTotalValue += currentValue;
        portfolioTotalInvested += sumInvestedTotal;

        // Return enriched object
        return {
            ...fund,
            currentValue,
            sumInvestedTotal,
            sumReturnTotal,
            assetTimeline,
            balancePoints,            // Original (para exportação)
            balancePointsExpanded,    // Expandido com interpolação (para gráficos)
            rwFirst,
            rwLast,
            lastAporteData,
            assetStdDev,
            targetPct, // parsed
            benchmarkSemanal,
            enrichedAportes // NEW
        };
    });

    // Score Calculation for Allocation (Need total value first)
    let totalScore = 0;
    calculatedAssets.forEach(a => {
        if (a.enabled) {
            if (allocationStrategy === 'momentum') {
                if (a.lastAporteData) totalScore += Math.max(0, a.lastAporteData.rwLast || a.lastAporteData.yieldPerWeek);
            } else {
                const idealValue = (portfolioTotalValue + capital) * (a.targetPct / 100);
                const deficit = Math.max(0, idealValue - a.currentValue);
                a.deficit = deficit;
                totalScore += deficit;
            }
        }
    });

    // Final movements and projections
    calculatedAssets.forEach(asset => {
        let movement = 0;
        let movementReason = "";

        if (asset.enabled && totalScore > 0) {
            if (allocationStrategy === 'momentum' && asset.lastAporteData) {
                const score = Math.max(0, asset.lastAporteData.yieldPerWeek);
                movement = (score / totalScore) * capital;
                movementReason = `Momentum: ${formatPP(asset.lastAporteData.yieldPerWeek)}`;
            } else if (allocationStrategy === 'target' && asset.deficit > 0) {
                movement = (asset.deficit / totalScore) * capital;
                movementReason = `Défice Alvo: ${formatBRL(asset.deficit)}`;
            }
        }
        asset.movement = movement;
        asset.movementReason = movementReason;

        // Projections
        const proj = (val, rate, w) => val * Math.pow(1 + rate, w);
        const { rwFirst, rwLast, currentValue } = asset;

        asset.projections = {
            first: {
                6: proj(currentValue, rwFirst, 26),
                12: proj(currentValue, rwFirst, 52),
                24: proj(currentValue, rwFirst, 104)
            },
            last: {
                6: proj(currentValue, rwLast, 26),
                12: proj(currentValue, rwLast, 52),
                24: proj(currentValue, rwLast, 104)
            }
        };

        // Add to globals
        globalCur_First[6] += asset.projections.first[6];
        globalCur_First[12] += asset.projections.first[12];
        globalCur_First[24] += asset.projections.first[24];

        globalCur_Last[6] += asset.projections.last[6];
        globalCur_Last[12] += asset.projections.last[12];
        globalCur_Last[24] += asset.projections.last[24];

        globalAfter_First[6] += proj(currentValue + movement, rwFirst, 26);
        globalAfter_First[12] += proj(currentValue + movement, rwFirst, 52);
        globalAfter_First[24] += proj(currentValue + movement, rwFirst, 104);

        globalAfter_Last[6] += proj(currentValue + movement, rwLast, 26);
        globalAfter_Last[12] += proj(currentValue + movement, rwLast, 52);
        globalAfter_Last[24] += proj(currentValue + movement, rwLast, 104);

        // Risk
        const vVal = asset.assetStdDev;
        if (vVal > 0) {
            allRisks.push({ v: vVal, w: currentValue });
        }

        assetsAnalysis.push(asset);
    });

    return {
        portfolioTotalValue,
        portfolioTotalInvested,
        totalTargetPct,
        calculatedAssets,
        globalTimeline,
        allDatesSet,
        globalCur_First,
        globalCur_Last,
        globalAfter_First,
        globalAfter_Last,
        allRisks,
        benchmarkSemanal,
        capital
    };
};
