const STORAGE_KEY = 'portfolio_manager_v25_market';
const COOKIE_NAME = 'portfolio_manager_v25_cookie';

export const setCookie = (name, value, days = 365) => {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${date.toUTCString()}; path=/; SameSite=Strict`;
};

export const getCookie = (name) => {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }
    return null;
};

export const saveState = (state, saveStatusElement) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setCookie(COOKIE_NAME, JSON.stringify(state));

    fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
    }).then(res => {
        if (res.ok) {
            if (saveStatusElement) {
                saveStatusElement.innerHTML = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Salvo';
                saveStatusElement.className = "flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-50 text-green-600 text-[9px] font-bold uppercase tracking-tighter border border-green-100";
            }
        } else {
            if (saveStatusElement) {
                saveStatusElement.textContent = 'Erro ao Salvar';
                saveStatusElement.className = "flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-50 text-red-600 text-[9px] font-bold uppercase tracking-tighter border border-red-100";
            }
        }
    }).catch(err => {
        console.error('Save failed', err);
        if (saveStatusElement) {
            saveStatusElement.textContent = 'Erro Conexão';
            saveStatusElement.className = "flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-50 text-red-600 text-[9px] font-bold uppercase tracking-tighter border border-red-100";
        }
    });
};

export const fetchPortfolioData = async () => {
    try {
        const response = await fetch('/api/portfolio');
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (error) {
        console.error('Failed to load data from API:', error);
        const saved = getCookie(COOKIE_NAME) || localStorage.getItem(STORAGE_KEY);
        if (saved) {
            return typeof saved === 'string' ? JSON.parse(saved) : saved;
        }
        return null;
    }
};
