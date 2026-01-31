package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"time"
)

var (
	cacheMutex    sync.RWMutex
	cachedData    *PortfolioData
	lastFile      string
	lastModTime   time.Time
	lastCheckTime time.Time
)

func handlePortfolio(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		var data PortfolioData
		if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}

		// Save to portfolio-current.json
		file, err := os.Create("portfolio-current.json")
		if err != nil {
			log.Printf("Error creating file: %v", err)
			http.Error(w, "Error saving file", http.StatusInternalServerError)
			return
		}
		defer file.Close()

		encoder := json.NewEncoder(file)
		encoder.SetIndent("", "  ")
		if err := encoder.Encode(data); err != nil {
			log.Printf("Error encoding JSON: %v", err)
			http.Error(w, "Error saving file", http.StatusInternalServerError)
			return
		}

		// Invalidate cache immediately
		cacheMutex.Lock()
		cachedData = &data
		lastFile = "portfolio-current.json"
		lastCheckTime = time.Now()
		info, _ := file.Stat()
		if info != nil {
			lastModTime = info.ModTime()
		}
		cacheMutex.Unlock()

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"saved"}`))
		return
	}

	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	data, err := loadLatestPortfolio()
	if err != nil {
		log.Printf("Error loading portfolio: %v", err)
		http.Error(w, fmt.Sprintf("Error loading portfolio: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(data); err != nil {
		http.Error(w, "Error encoding JSON", http.StatusInternalServerError)
	}
}

func loadLatestPortfolio() (*PortfolioData, error) {
	cacheMutex.Lock()
	defer cacheMutex.Unlock()

	// Rate limit directory checks to once every 2 seconds
	if cachedData != nil && time.Since(lastCheckTime) < 2*time.Second {
		return cachedData, nil
	}
	lastCheckTime = time.Now()

	// Find the latest portfolio-*.json file
	files, err := os.ReadDir(".")
	if err != nil {
		return nil, err
	}

	var portfolioFiles []string
	for _, f := range files {
		if !f.IsDir() && strings.HasPrefix(f.Name(), "portfolio-") && strings.HasSuffix(f.Name(), ".json") {
			portfolioFiles = append(portfolioFiles, f.Name())
		}
	}

	sort.Strings(portfolioFiles)

	var filename string
	if len(portfolioFiles) > 0 {
		filename = portfolioFiles[len(portfolioFiles)-1]
	} else {
		if _, err := os.Stat("portfolio.json"); err == nil {
			filename = "portfolio.json"
		} else {
			return &PortfolioData{}, nil
		}
	}

	info, err := os.Stat(filename)
	if err != nil {
		return nil, err
	}

	// Use cache if file is same and modification time hasn't changed
	if cachedData != nil && filename == lastFile && info.ModTime().Equal(lastModTime) {
		return cachedData, nil
	}

	fmt.Printf("Loading data from disk: %s (Req: %s, Cache: %s)\n", filename, info.ModTime(), lastModTime)

	content, err := os.ReadFile(filename)
	if err != nil {
		return nil, err
	}

	var data PortfolioData
	if err := json.Unmarshal(content, &data); err != nil {
		return nil, err
	}

	// Update Cache
	cachedData = &data
	lastFile = filename
	lastModTime = info.ModTime()

	return &data, nil
}
