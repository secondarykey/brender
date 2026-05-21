package handler

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/ikascrew/brender/exec"
	"golang.org/x/xerrors"
)

func thumbnailHandler(w http.ResponseWriter, r *http.Request) {

	// /thumb/{pId} : Project Thumbnail
	// /thumb/{pId}/{wId} : Workspace Thumbnail
	// /thumb/{pId}/{wId}/{result filename} : Result Thumbnail

	url := r.URL.String()
	s := strings.Split(url, "/")

	leng := len(s)
	if leng < 3 {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	pId := s[2]

	fn := ""

	if leng == 3 {
		fn = exec.GetProjectThumbnailFileName(pId)
	} else {

		wIdBuf := s[3]
		wId, err := strconv.Atoi(wIdBuf)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		if leng == 5 {
			fileName := s[4]
			fn = exec.GetResultFileName(pId, wId, fileName)
		} else {
			fn = exec.GetWorkspaceThumbnailFileName(pId, wId)
		}
	}

	//
	if _, err := os.Stat(fn); err != nil {
		//no content
		w.WriteHeader(http.StatusNotFound)
		return
	}

	err := writeImage(w, fn)
	if err != nil {
		log.Println(err)
	}
}

func writeImage(w http.ResponseWriter, fn string) error {

	fp, err := os.Open(fn)
	if err != nil {
		return xerrors.Errorf("os.Open() error: %w", err)
	}
	defer fp.Close()

	_, err = io.Copy(w, fp)
	if err != nil {
		return xerrors.Errorf("io.Copy() error: %w", err)
	}

	return nil
}

func resultZIPHandler(w http.ResponseWriter, r *http.Request) {

	//download/zip/{project_id}/{workspace_id}

	url := r.URL.String()
	s := strings.Split(url, "/")

	leng := len(s)
	if leng < 5 {
		return
	}

	pId := s[3]
	wIdBuf := s[4]
	wId, err := strconv.Atoi(wIdBuf)
	if err != nil {
		log.Println(err)
		return
	}

	name := fmt.Sprintf("%s-%d.zip", pId, wId)
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", "attachment; filename="+name)

	err = exec.WriteResultZIP(w, pId, wId)
	if err != nil {
		log.Println(err)
		return
	}
}
