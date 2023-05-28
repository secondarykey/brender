package brender

import (
	"net/http"
)

func Listen() error {

	mux := http.NewServeMux()
	mux.HandleFunc("/", indexHandler)
	mux.HandleFunc("/upload", uploadHandler)

	return http.ListenAndServe(":8080", mux)
}
