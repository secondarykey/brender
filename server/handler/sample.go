package handler

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

func indexHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Println("request")
	w.Header().Add("Content-Type", "text/html")
	http.ServeFile(w, r, "index.html")
}

func ocrHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Add("Content-Type", "text/html")
	//fmt.Println(generateOwnHash())
	//fmt.Println(makeRandString(16))
	http.ServeFile(w, r, "ocr.html")
}

func uploadHandler(w http.ResponseWriter, r *http.Request) {

	// ここから追加
	file, fileHeader, err := r.FormFile("file")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	defer file.Close()

	err = os.MkdirAll("../upload_files", os.ModePerm)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	dst, err := os.Create(fmt.Sprintf("../uploadfiles/%d%s", time.Now().UnixNano(), filepath.Ext(fileHeader.Filename)))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	defer dst.Close()

	_, err = io.Copy(dst, file)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	fmt.Fprintf(w, "uploaded")
}
