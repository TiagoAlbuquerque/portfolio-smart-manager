package main

// PortfolioData represents the structure of the portfolio JSON file.
type PortfolioData struct {
	Funds    []Fund `json:"funds"`
	Capital  string `json:"capital"`
	CDI      string `json:"cdi"`
	Strategy string `json:"strategy"`
}

type Fund struct {
	Name     string    `json:"name"`
	Enabled  bool      `json:"enabled"`
	Target   string    `json:"target"`
	Expanded bool      `json:"expanded"`
	ID       string    `json:"id"`
	Aportes  []Aporte  `json:"aportes"`
	Balances []Balance `json:"balances"`
}

type Aporte struct {
	Value  string `json:"value"`
	Return string `json:"return"`
	Date   string `json:"date"`
}

type Balance struct {
	Date  string `json:"date"`
	Value string `json:"value"`
}
