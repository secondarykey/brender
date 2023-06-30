package handler

import (
	"net/http"

	"github.com/ikascrew/brender/handler/api"
)

func CreateMux() *http.ServeMux {

	mux := http.NewServeMux()

	api.RegisterHandler("/api", mux)

	mux.HandleFunc("/", indexHandler)
	mux.HandleFunc("/thumb/", thumbnailHandler)
	mux.HandleFunc("/download/zip/", resultZIPHandler)

	mux.HandleFunc("/upload", uploadHandler)
	mux.HandleFunc("/ocr", ocrHandler)

	return mux
}
