export const formatBRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const formatPct = (v) => `${(v * 100).toFixed(2)}%`.replace('.', ',');
export const formatPP = (v) => `${(v * 100).toFixed(3)} pp/sem`.replace('.', ',');

export const formatTimeFromWeeks = (weeks) => {
    if (!weeks || weeks <= 0 || !isFinite(weeks)) return "--";
    const years = Math.floor(weeks / 52);
    const months = Math.round((weeks % 52) / 4.33);
    if (years === 0) return `${months}m`;
    if (months === 0) return `${years}a`;
    return `${years}a ${months}m`;
};

export const getTrendVisuals = (val) => {
    if (val > 0) return { color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: '▲' };
    if (val < 0) return { color: 'text-rose-600 bg-rose-50 border-rose-100', icon: '▼' };
    return { color: 'text-gray-500 bg-gray-50 border-gray-100', icon: '-' };
};

export const parseBRL = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    // Remove tudo que não é dígito, vírgula ou sinal de menos
    let clean = value.replace(/[^\d,-]/g, '');
    // Troca vírgula por ponto
    clean = clean.replace(',', '.');
    return parseFloat(clean) || 0;
};

export const formatInputCurrency = (e) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value === "") return;

    value = (parseInt(value) / 100).toFixed(2) + "";
    value = value.replace(".", ",");
    value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");

    e.target.value = value;
};

// Versão que permite valores negativos (para campo de retorno)
export const formatInputCurrencyWithNegative = (e) => {
    const originalValue = e.target.value;
    const isNegative = originalValue.includes('-');

    let value = originalValue.replace(/[^\d]/g, "");

    if (value === "") {
        e.target.value = isNegative ? "-" : "";
        return;
    }

    value = (parseInt(value) / 100).toFixed(2) + "";
    value = value.replace(".", ",");
    value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");

    e.target.value = isNegative ? "-" + value : value;
};

export const formatValueToBRL = (val) => {
    if (!val) return "";
    if (typeof val === 'string') {
        if (val.includes('.') && !val.includes(',')) {
            return parseFloat(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        return val;
    }
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};
