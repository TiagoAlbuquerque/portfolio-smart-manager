# LLM_README — Portfólio Smart Manager

> **Objetivo deste documento:** Fornecer a qualquer LLM (ou desenvolvedor) um entendimento rápido e completo do sistema, suas regras de negócio, arquitetura e convenções. Leia **inteiro** antes de propor alterações.

---

## 1. Visão Geral do Projeto

**Portfólio Smart Manager** é uma aplicação web **single-page** para gestão e rebalanceamento de carteiras de investimentos.

| Aspecto | Detalhe |
|---|---|
| **Linguagem** do Backend | Go (Golang) — `net/http` padrão, sem frameworks |
| **Linguagem** do Frontend | Vanilla JavaScript (ES6 Modules), **sem frameworks JS** |
| **Estilos** | Tailwind CSS via CDN + CSS customizado em `static/css/styles.css` |
| **Gráficos** | Chart.js + adapter date-fns |
| **Fonte** | Inter (Google Fonts) |
| **Persistência** | Arquivo JSON local (`portfolio-current.json`) |
| **Porta padrão** | `localhost:8080` |

> **Importante:** Não existe banco de dados. O JSON é a **fonte da verdade** e é lido/escrito diretamente pelo backend.

---

## 2. Estrutura de Arquivos

```
/
├── main.go                     # Ponto de entrada — servidor HTTP, parse de templates
├── handlers.go                 # API handler: GET/POST /api/portfolio
├── models.go                   # Structs Go: PortfolioData, Fund, Aporte, Balance
├── portfolio-current.json      # Dados persistidos (fonte da verdade)
├── go.mod                      # Módulo Go
│
├── static/
│   ├── css/styles.css          # Estilos customizados (complementa Tailwind)
│   ├── icons.svg               # Ícones SVG inline
│   ├── img/                    # Imagens (logo, favicon)
│   └── js/
│       ├── main.js             # ★ ORQUESTRADOR — listeners, calculate(), processData
│       ├── dom-updater.js      # Atualização do DOM global e por ativo
│       ├── fund-manager.js     # Gestão de fundos: addFund(), updateQuickNav()
│       ├── calculations.js     # Motor de cálculos financeiros (calculateState)
│       ├── charts.js           # Renderização de gráficos (Chart.js)
│       ├── ui.js               # Componentes DOM (addAporteRow, addBalanceRow, getAppState)
│       ├── api.js              # Comunicação com backend + persistência local
│       └── utils.js            # Formatadores BRL, parsers, debounce
│
├── templates/
│   ├── base.html               # Layout raiz — carrega CDNs, define grid principal
│   ├── components/             # Templates reutilizáveis (ex: modais)
│   └── partials/
│       ├── header.html         # Cabeçalho da aplicação
│       ├── config.html         # Painel de configuração (capital, CDI, estratégia)
│       ├── portfolio.html      # Container da lista de fundos
│       ├── consolidated.html   # ★ Painel consolidado (métricas, gráficos globais, plano)
│
└── data/                       # Diretório reservado (atualmente vazio)
```

---

## 3. Arquitetura e Fluxo de Dados

### 3.1 Fluxo Principal

```
┌─────────────────────────────────────────────────────────────────────┐
│  BROWSER (Frontend)                                                 │
│                                                                     │
│  1. DOMContentLoaded → fetchPortfolioData() → GET /api/portfolio    │
│  2. processData(data) → addFund() para cada ativo                   │
│  3. calculate() — recalcula TUDO a cada mudança                     │
│  4. saveData() → saveState() → POST /api/portfolio                  │
│                                                                     │
│  ┌──────────┐    ┌──────────────┐    ┌──────────┐    ┌───────────┐  │
│  │ api.js   │───▶│ main.js      │───▶│ calc.js  │───▶│ charts.js │  │
│  │ (fetch)  │    │ (orchestrate)│    │ (engine) │    │ (render)  │  │
│  └──────────┘    └──────────────┘    └──────────┘    └───────────┘  │
│       │                │                                  │         │
│       │           ┌────▼─────┐                            │         │
│       │           │  ui.js   │                            │         │
│       │           │  (DOM)   │                            │         │
│       │           └──────────┘                            │         │
│       │                                                   │         │
│       ▼                                                   ▼         │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  utils.js — formatBRL, parseBRL, debounce, etc.             │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
         │                                    ▲
         ▼                                    │
┌─────────────────────────────────────────────────────────────────────┐
│  SERVER (Backend Go)                                                │
│                                                                     │
│  GET  /api/portfolio  →  loadLatestPortfolio()  →  lê JSON          │
│  POST /api/portfolio  →  handlePortfolio()      →  grava JSON       │
│                                                                     │
│  ★ Cache em memória com invalidação por modTime do arquivo          │
│  ★ Rate-limit de 2s para leituras de diretório                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Ciclo de Recálculo

**Toda alteração** (input, toggle, adição/remoção de aportes) dispara `calculate()`:

1. `getAppState()` — lê o DOM inteiro e monta o objeto de estado
2. `calculateState(state, allDatesSet)` — motor puro de cálculos financeiros
3. O resultado atualiza o DOM: métricas, badges, rankings, gráficos
4. `saveData()` é chamado para persistir automaticamente

> **Regra crítica:** `calculate()` em `main.js` é a **única função** que deve orquestrar o recálculo. Nunca crie caminhos paralelos.

---

## 4. Modelo de Dados (JSON)

```json
{
  "funds": [
    {
      "name": "Nome do Fundo",
      "enabled": true,
      "target": "25",          // % alvo — string
      "expanded": false,
      "id": "fund-1706000000",
      "aportes": [
        { "value": "1.000,00", "return": "50,00", "date": "2025-01-15" }
      ],
      "balances": [
        { "date": "2025-01-31", "value": "1.050,00" }
      ]
    }
  ],
  "capital": "5.000,00",       // Novo aporte disponível
  "cdi": "13.15",              // Taxa CDI anual (benchmark)
  "strategy": "target"         // "target" ou "momentum"
}
```

### Convenções de formato dos dados:

| Campo | Formato | Exemplo |
|---|---|---|
| Valores monetários | String BRL com vírgula decimal e ponto milhar | `"1.250,00"` |
| Datas | ISO `YYYY-MM-DD` | `"2025-06-15"` |
| Percentuais (`target`, `cdi`) | String numérica sem `%` | `"25"`, `"13.15"` |
| IDs de fundos | `"fund-"` + timestamp | `"fund-1706000000"` |
| `enabled` / `expanded` | Boolean | `true` / `false` |
| `strategy` | String enum | `"target"` ou `"momentum"` |

> **⚠️ Nunca altere o formato de persistência** sem atualizar simultaneamente `parseBRL()` em `utils.js`, `getAppState()` em `ui.js`, e os structs em `models.go`.

---

## 5. Módulos JavaScript — Responsabilidades

### `main.js` (~190 linhas) — Orquestrador
- **DOMContentLoaded**: inicializa listeners, carrega dados, dispara primeiro cálculo
- **`calculate()`**: função central (~40 linhas) que delega para módulos:
  - Coleta estado via `getAppState()`
  - Chama `calculateState()` para cada fundo
  - Delega atualização do DOM para `dom-updater.js`
  - Renderiza plano de execução via `renderPlan()`
- **`saveData()`**: serializa e persiste
- **`processData(data)`**: hidrata a UI a partir de dados carregados
- Event listeners globais (filtros, import/export, custom period)

### `dom-updater.js` (~280 linhas) — Atualização do DOM
- **`updateGlobalSummary(results, elements)`**: badges globais (patrimônio, retorno, risco)
- **`updateGlobalProjections(results)`**: projeções 6/12/24m, velocidades implícitas, TTM
- **`aggregateGlobalEquityPoints(results)`**: gera pontos de equity/invested para gráfico global
- **`updateGlobalChartAndPeriodReturn(...)`**: renderiza gráfico global e display de retorno do período
- **`updateAssetDOM(asset, portfolioTotalValue, uniqueYears)`**: atualiza DOM completo de um ativo individual

### `fund-manager.js` (~160 linhas) — Gestão de Fundos
- **`addFund(data, suppressCalc, callbacks)`**: clona template, popula dados, wiring de eventos
- **`updateQuickNav(fundsList)`**: gera badges de navegação rápida
- Callbacks (`calculate`, `saveData`) são injetadas por `main.js` para evitar dependência circular

### `calculations.js` (~354 linhas) — Motor Financeiro
- **`calculateState(state, allDatesSet)`**: cálculos financeiros puros (sem DOM):
  - Total investido, valor atual, retorno
  - Yield total, taxa semanal, comparação CDI
  - Volatilidade (desvio padrão)
  - Projeções futuras (6, 12, 24 meses)
  - Timeline para gráficos
- **`getBalanceAtDate(balancePoints, targetDate)`**: interpolação linear de saldos
- **`expandBalancePointsDaily(balancePoints, endDate)`**: expansão de dados diários (máx. 730 dias)

### `charts.js` (~366 linhas) — Visualização
- **`updateAssetCharts()`**: gráfico individual por ativo (patrimônio vs. investido)
- **`updateHistoryChart()`**: gráfico global de evolução patrimonial
- **`renderAllocationChart()`**: donut chart de distribuição de ativos
- **`calculatePeriodReturn()`**: retorno % de um período selecionado
- **`filterAndNormalizeData()`**: filtragem temporal (12M, YTD, Máx, Ano, Custom)
- **`renderPlan()` / `renderEmpty()`**: plano de execução de rebalanceamento

### `ui.js` (~107 linhas) — Componentes DOM
- **`addAporteRow()`**: adiciona linha de aporte usando `<template>`
- **`addBalanceRow()`**: adiciona linha de saldo usando `<template>`
- **`updateYearOptions()`**: popula dropdown de anos
- **`getAppState()`**: serializa o estado atual da UI para JSON

### `api.js` (~64 linhas) — Persistência
- **`fetchPortfolioData()`**: `GET /api/portfolio`, com fallback para cookie/localStorage
- **`saveState(state)`**: salva em localStorage + cookie + `POST /api/portfolio`
- Persistência tripla: servidor JSON, localStorage, cookie

### `utils.js` (~82 linhas) — Utilitários
- `formatBRL(v)` — número → `R$ 1.234,56`
- `parseBRL(value)` — `"1.234,56"` → `1234.56`
- `formatPct(v)` — `0.1234` → `"12,34%"`
- `formatPP(v)` — pontos percentuais por semana
- `formatTimeFromWeeks(weeks)` — semanas → `"2a 3m"`
- `formatInputCurrency(e)` — formatação em tempo real (positivo)
- `formatInputCurrencyWithNegative(e)` — formatação em tempo real (com negativos)
- `formatValueToBRL(val)` — converte valor numérico/string para formato BRL
- `debounce(func, wait)` — debounce padrão (300ms no calculate)
- `getTrendVisuals(val)` — retorna classes CSS + ícone de tendência

---

## 6. Backend Go — Detalhes

### Endpoints da API

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/` | Serve `base.html` (SPA) |
| `GET` | `/api/portfolio` | Retorna dados do portfolio em JSON |
| `POST` | `/api/portfolio` | Salva dados recebidos em `portfolio-current.json` |
| `GET` | `/static/*` | Serve arquivos estáticos |

### Mecanismo de cache (`handlers.go`)
- Cache em memória com `sync.RWMutex`
- Invalidação por `modTime` do arquivo JSON
- Rate-limit de 2s para verificação de diretório
- Auto-detecção do arquivo `portfolio-*.json` mais recente (por ordem alfabética)

### Templates Go (`templates/`)
- Sistema de templates nativos do Go (`html/template`)
- Templates são parseados **uma vez** no startup (`main.go`)
- `base.html` é o layout raiz que inclui partials via `{{ template "nome" . }}`

---

## 7. Regras Críticas e Invariantes

### 🔴 Nunca quebre estas regras:

1. **Um único ponto de recálculo**: `calculate()` em `main.js` é o ponto central. Não crie vias alternativas.

2. **Formato BRL em strings**: Valores monetários no JSON são **strings em formato BRL** (`"1.250,00"`). Jamais use ponto como decimal no JSON.

3. **Sem frameworks JS**: O frontend é Vanilla JS com ES6 Modules. Não introduza React, Vue, jQuery ou similares.

4. **Sem banco de dados**: A persistência é JSON em arquivo. Não sugira migrar para SQL/NoSQL sem solicitação explícita.

5. **Tailwind via CDN**: Não instale Tailwind localmente. O CDN está em `base.html`.

6. **IDs de elementos HTML**: Os seletores em `main.js` e `calculate()` dependem de IDs específicos no HTML. Alterar IDs nos templates **quebra o JS silenciosamente**.

7. **Interpolação de saldos**: `getBalanceAtDate()` usa interpolação linear. Não altere para outro método sem entender o impacto nos gráficos e cálculos de retorno.

8. **Persistência tripla**: `saveState()` grava em 3 locais (servidor, localStorage, cookie). Não remova nenhum sem justificativa.

9. **Formato de datas**: Sempre `YYYY-MM-DD` (ISO). Os inputs HTML `type="date"` dependem disso.

10. **Go templates**: Templates são parseados no startup. Alterações em templates requerem reiniciar o servidor.

---

## 8. Estratégias de Rebalanceamento

### Target (padrão)
- Aloca o novo aporte priorizando os ativos com **maior defasagem** em relação ao `target %`
- Defasagem = `target%` - `atual%` (percentual real vs. alvo)

### Momentum
- Aloca priorizando ativos com **melhor performance recente** (taxa semanal)
- Reforça posições vencedoras em vez de rebalancear para alvos fixos

---

## 9. Métricas Financeiras Calculadas

| Métrica | Descrição | Onde é calculada |
|---|---|---|
| **Saldo Atual** | Último balanço registrado ou interpolado | `calculations.js` → `calculateState` |
| **Total Investido** | Soma de todos os aportes | `calculations.js` → `calculateState` |
| **Retorno Absoluto** | Saldo - Investido | `calculations.js` → `calculateState` |
| **Yield Total** | (Saldo / Investido) - 1 | `calculations.js` → `calculateState` |
| **Taxa Semanal** | Yield / nº de semanas | `calculations.js` → `calculateState` |
| **Yield Anualizado** | (1 + taxaSemanal)^52 - 1 | `calculations.js` → `calculateState` |
| **Delta CDI** | yieldAnualizado - taxaCDI | `main.js` → `calculate()` |
| **Volatilidade** | Desvio padrão dos retornos semanais | `calculations.js` → `calculateState` |
| **Projeções** | Patrimônio em 6, 12, 24 meses | `calculations.js` → `calculateState` |
| **TTM** | Time to Million (tempo estimado para R$ 1M) | `main.js` → `calculate()` |
| **Retorno do Período** | Retorno % filtrado por período (12M, YTD, etc.) | `charts.js` → `calculatePeriodReturn` |

---

## 10. Padrões de Código e Convenções

### JavaScript
- **ES6 Modules**: `import/export` com caminhos relativos (`'./utils.js'`)
- **Arrow functions**: padrão para lambdas e funções exportadas
- **Debounce**: `calculate()` é chamado via `debouncedCalculate` (300ms) em inputs
- **Nomenclatura**: camelCase para funções/variáveis, PascalCase não utilizado no frontend
- **Sem TypeScript**: tipagem implícita, documentação via JSDoc quando necessário
- **Idioma**: Nomes de variáveis/funções em inglês; textos na UI em português; comentários em português ou inglês

### Go
- **Pacote único**: `package main` (sem modularização avançada)
- **Dependência zero**: apenas biblioteca padrão (`net/http`, `encoding/json`, etc.)
- **Struct tags**: JSON com formato snake_case

### CSS / Tailwind
- Classes utilitárias do Tailwind para layout e espaçamento
- Estilos customizados em `static/css/styles.css` para componentes especializados
- Cores semânticas via Tailwind: `emerald` (positivo), `rose` (negativo), `gray` (neutro)

### HTML Templates
- Go Templates (`{{ template "name" . }}`) para composição
- `<template>` HTML para clonagem de linhas de aportes/saldos
- IDs seguem convenção descritiva: `funds-list`, `total-value`, `action-plan`

---

## 11. Princípios de Modularização

> **Diretriz fundamental:** Cada arquivo deve ter uma **responsabilidade única e bem definida**. O objetivo é manter todos os arquivos em tamanhos manejáveis, facilitando a leitura, manutenção e evolução do sistema.

### Regras de Organização

1. **Um arquivo = um papel claro.** Não misture responsabilidades. Exemplo:
   - `calculations.js` → cálculos puros (sem DOM)
   - `charts.js` → renderização de gráficos (sem lógica de negócio)
   - `ui.js` → criação/manipulação de componentes DOM (sem cálculos)
   - `api.js` → comunicação com servidor (sem renderização)
   - `utils.js` → funções utilitárias puras (sem side-effects)

2. **Tamanho máximo recomendado: ~300-400 linhas por arquivo.** Se um arquivo ultrapassar esse limite, é sinal de que precisa ser dividido. O `main.js` é atualmente o maior (~700 linhas) e é o candidato prioritário para refatoração futura.

3. **Ao adicionar funcionalidade nova**, pergunte:
   - Essa lógica pertence a algum módulo existente?
   - Se não, crie um **novo arquivo** com nome descritivo e papel claro.
   - **Nunca** empilhe lógica não relacionada em um arquivo existente só para "não criar mais arquivos".

4. **Imports devem ser explícitos.** Cada módulo exporta apenas o que outros módulos precisam. Não use `export default` com objetos grandes — prefira named exports para clareza.

5. **Templates HTML seguem o mesmo princípio.** Cada partial (`header.html`, `config.html`, `consolidated.html`, `portfolio.html`) cuida de uma seção da UI. Ao adicionar seções grandes, crie um novo partial.

### Quadro de Responsabilidades Atual

| Arquivo | Papel | Depende de | Não deve conter |
|---|---|---|---|
| `main.js` | Orquestração, listeners, ciclo de vida | todos os módulos | cálculos puros, formatação, DOM updates |
| `dom-updater.js` | Atualização do DOM (global + per-asset) | `utils.js`, `charts.js`, `ui.js` | cálculos financeiros, API |
| `fund-manager.js` | Criação de fundos, quick nav | `utils.js`, `ui.js` | cálculos, chart rendering |
| `calculations.js` | Motor financeiro puro | `utils.js` | DOM, Chart.js |
| `charts.js` | Renderização Chart.js | `utils.js` | cálculos de portfolio |
| `ui.js` | Criação de componentes DOM | `utils.js` | cálculos, API |
| `api.js` | Fetch/save de dados | nenhum | DOM, cálculos |
| `utils.js` | Formatadores e helpers puros | nenhum | DOM, API, lógica de negócio |

---

## 12. Problemas Conhecidos e Cuidados

1. **Valores negativos em retorno**: O campo `return` de aportes aceita negativos (prejuízo). A função `formatInputCurrencyWithNegative()` trata isso. Não use `formatInputCurrency()` para esse campo.

2. **Interpolação com poucos pontos**: Se um ativo tem apenas 1 balanço registrado, a interpolação não pode operar. O código trata isso com fallback para `null`.

3. **Performance em gráficos**: `expandBalancePointsDaily()` tem um limite de 730 dias (2 anos) para evitar travamento. Não remova esse limite.

4. **Cache do backend**: Após alterações no JSON manualmente, o servidor pode demorar até 2s para refletir (rate-limit do cache). Reinicie o servidor se necessário.

---

## 13. Como Executar

```bash
# Compilar e rodar
go run main.go

# Ou usar o executável pré-compilado
./portfolio-manager.exe

# Acessar no navegador
# http://localhost:8080
```

---

## 14. Checklist para Alterações

Antes de propor qualquer mudança, verifique:

- [ ] A mudança afeta o formato do JSON? → Atualize `models.go`, `getAppState()`, e `parseBRL()`
- [ ] A mudança altera IDs de elementos HTML? → Atualize os seletores em `main.js` e `calculate()`
- [ ] A mudança modifica cálculos? → Garanta consistência entre `calculations.js` e as métricas exibidas
- [ ] A mudança afeta gráficos? → Teste com filtros de período (12M, YTD, Máx, Ano)
- [ ] A mudança altera templates? → Verifique qual variante de `consolidated` está ativa
- [ ] A mudança envolve novas dependências? → Este projeto não usa npm/node. CDNs são a via padrão
- [ ] O servidor precisa ser reiniciado? → Templates Go são parseados no startup

---

## 15. Glossário

| Termo | Significado |
|---|---|
| **Aporte** | Contribuição/investimento realizado em um ativo |
| **Saldo / Balance** | Patrimônio registrado em uma data específica |
| **Target %** | Porcentagem alvo da carteira para aquele ativo |
| **Capital** | Valor disponível para novo investimento |
| **CDI** | Taxa de referência do mercado brasileiro (benchmark) |
| **Yield** | Rendimento percentual acumulado |
| **Volatilidade** | Medida de risco (desvio padrão dos retornos) |
| **TTM** | Time to Million — tempo estimado para atingir R$ 1.000.000 |
| **pp/sem** | Pontos percentuais por semana (unidade de taxa) |
| **Rebalanceamento** | Redistribuição do capital para alinhar com targets |
