package main

import (
	"fmt"
	"html/template"
	"log"
	"net/http"
)

func main() {
	// 0. Parse Templates
	// Create a new empty template
	tmpl := template.New("")

	// Parse root templates
	_, err := tmpl.ParseGlob("templates/*.html")
	if err != nil {
		log.Printf("Warning parsing root templates: %v", err)
	}

	// Parse partials
	_, err = tmpl.ParseGlob("templates/partials/*.html")
	if err != nil {
		log.Printf("Warning parsing partials: %v", err)
	}

	// Parse components
	_, err = tmpl.ParseGlob("templates/components/*.html")
	if err != nil {
		log.Printf("Warning parsing components: %v", err)
	}

	// 1. Serve Static Files
	fs := http.FileServer(http.Dir("./static"))
	http.Handle("/static/", http.StripPrefix("/static/", fs))

	// 2. Serve Index HTML at Root (via Template)
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}

		// Reload templates in dev mode (optional, but good for now)
		// For production, parse once is better. Here we parse once at startup, sticking to that plan.

		if err := tmpl.ExecuteTemplate(w, "base.html", nil); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	})

	// 3. API Endpoint for Portfolio Data
	http.HandleFunc("/api/portfolio", handlePortfolio)

	// Start Server
	fmt.Println("Server executing on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
