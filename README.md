# Portfólio Smart Manager

**Portfólio Smart Manager** é uma aplicação web completa para gestão, monitoramento e rebalanceamento de carteiras de investimentos. Desenvolvida com um backend leve em **Go** e um frontend moderno e reativo utilizando **Vanilla JavaScript** e **Tailwind CSS**.

![Status](https://img.shields.io/badge/Status-Active-success)
![Go](https://img.shields.io/badge/Backend-Go-blue)
![JavaScript](https://img.shields.io/badge/Frontend-Vanilla%20JS-yellow)

## 🚀 Funcionalidades

### 📊 Gestão de Carteira
- **Cadastro de Ativos**: Adicione e gerencie múltiplos ativos (fundos, ações, etc.).
- **Histórico de Aportes**: Registro detalhado de aportes com data, valor aplicado e retorno.
- **Histórico de Saldo**: Acompanhamento da evolução do saldo patrimonial ao longo do tempo.
- **Importação/Exportação**: Backup e restauração dos dados da carteira via arquivos JSON.

### 🧠 Inteligência e Análise
- **Rebalanceamento Automático**:
  - **Estratégia Target**: Rebalanceamento baseado na defasagem em relação à alocação alvo (%).
  - **Estratégia Momentum**: Alocação dinâmica baseada na performance recente do ativo.
- **Cálculo de Rentabilidade**: Métricas detalhadas como Yield total, taxa de retorno semanal e comparação com Benchmark (CDI).
- **Análise de Risco**: Monitoramento de volatilidade (Desvio Padrão) para cada ativo e risco ponderado global.

### 📈 Visualização de Dados (Charts)
- **Evolução Patrimonial Global**: Gráfico interativo comparando Patrimônio Total vs. Total Investido.
- **Evolução por Ativo**: Gráficos individuais para cada ativo com filtros de período (12M, YTD, Máx).
- **Distribuição de Ativos**: Gráfico de rosca (Donut Chart) para visualização da alocação atual.
- **Projeções**: Estimativas de patrimônio futuro (6, 12, 24 meses) baseadas em taxas históricas e momentum recente.

---

## 🛠️ Tecnologias Utilizadas

- **Backend**:
  - [Go (Golang)](https://go.dev/) - Servidor HTTP robusto e performático.
  - `net/http` - Biblioteca padrão para roteamento e servidor de arquivos.

- **Frontend**:
  - **HTML5 & CSS3** - Estrutura semântica e estilos.
  - [Tailwind CSS](https://tailwindcss.com/) - Framework CSS utilitário para design rápido e responsivo.
  - **Vanilla JavaScript (ES6+)** - Lógica de interação, cálculos financeiros e manipulação do DOM.
  - [Chart.js](https://www.chartjs.org/) - Renderização de gráficos interativos e responsivos.
  - [Date-fns](https://date-fns.org/) - Manipulação de datas (via adaptador Chart.js).

---

## 🏁 Como Executar

### Pré-requisitos
- [Go](https://go.dev/dl/) instalado (versão 1.18+ recomendada).
- Navegador moderno (Chrome, Edge, Firefox).

### Passo a Passo

1.  **Clone o repositório**:
    ```bash
    git clone https://github.com/TiagoAlbuquerque/portfolio-smart-manager.git
    cd portfolio-smart-manager
    ```

2.  **Execute o servidor**:
    ```bash
    go run main.go
    ```

3.  **Acesse a aplicação**:
    Abra seu navegador e vá para:
    [http://localhost:8080](http://localhost:8080)

---

## 📂 Estrutura do Projeto

```
/
├── main.go             # Ponto de entrada do servidor Go
├── handlers.go         # Manipuladores de rotas da API
├── models.go           # Definições de estruturas de dados (Structs)
├── portfolio-current.json # Base de dados local (JSON)
├── static/             # Arquivos estáticos
│   ├── css/            # Estilos globais e Tailwind
│   └── js/             # Lógica do Frontend
│       ├── main.js     # Orquestrador principal
│       ├── calculations.js # Motor de cálculo financeiro
│       ├── ui.js       # Manipulação do DOM e componentes
│       ├── charts.js   # Configuração e renderização de gráficos
│       ├── api.js      # Comunicação com o backend
│       └── utils.js    # Funções utilitárias e formatadores
└── templates/          # Arquivos HTML (Go Templates)
    ├── base.html       # Layout base
    └── partials/       # Fragmentos de interface (Header, Config, etc.)
```

## 📝 Uso

1.  **Defina os Parâmetros Globais**:
    - Insira o **Novo Aporte** (capital disponível para investir).
    - Defina a **Taxa CDI** (Benchmark anual).
    - Escolha a **Estratégia de Alocação** (Target ou Momentum).

2.  **Adicione Ativos**:
    - Clique em "+ Adicionar Ativo".
    - Defina o Nome e a Porcentagem Alvo (Target %).
    - Registre seus **Aportes** passados (Data, Valor, Retorno).
    - (Opcional) Registre pontos de **Saldo** para refinar o histórico.

3.  **Analise e Rebalanceie**:
    - O painel "Consolidado" mostrará a sugestão de **Plano de Execução** (onde investir seu novo aporte).
    - Verifique os gráficos para entender a performance histórica e projetada.

---

## 🤝 Contribuição

Contribuições são bem-vindas! Sinta-se à vontade para abrir Issues ou enviar Pull Requests.

---

## 📄 Licença

Este projeto é de uso pessoal e educacional.
