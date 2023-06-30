package api

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"

	"golang.org/x/xerrors"
)

func parseJSONBody(r *http.Request, dst interface{}) error {

	b, err := io.ReadAll(r.Body)
	if err != nil {
		return xerrors.Errorf("io.ReadAll() error: %w", err)
	}

	err = json.Unmarshal(b, dst)
	if err != nil {
		return xerrors.Errorf("json.Unmarshal() error: %w", err)
	}

	return nil
}

func writeError(w http.ResponseWriter, err error) {
	res := newResponse()
	res.Success = false
	res.addMessage(fmt.Sprintf("%+v", err))

	log.Println(err)

	writeJSON(w, res)
}

func writeJSON(w http.ResponseWriter, v interface{}) {

	b, err := json.Marshal(v)
	if err != nil {
		log.Println(err)
		return
	}
	_, err = w.Write(b)
	if err != nil {
		log.Println(err)
		return
	}
}

type Response struct {
	Success  bool        `json:"success"`
	Messages []string    `json:"messages"`
	Result   interface{} `json:"result"`
}

func newResponse() *Response {
	var r Response
	r.Success = false
	r.Messages = nil
	return &r
}

func (r *Response) setSuccess() {
	r.Success = true
}

func (r *Response) setResult(result interface{}) {
	r.Result = result
}

func (r *Response) addMessage(msg string) {
	if r.Messages == nil {
		r.Messages = make([]string, 0)
	}
	r.Messages = append(r.Messages, msg)
}

type apiHandler func(*http.Request) (*Response, error)

type Handle struct {
	mux    *http.ServeMux
	prefix string
	route  map[string]apiHandler
}

func (h *Handle) addRoute(p string, api apiHandler) {
	h.route[p] = api
	h.mux.HandleFunc(h.prefix+p, h.jsonHandler)
}

func newHandle(prefix string, mux *http.ServeMux) *Handle {
	var h Handle
	h.prefix = prefix
	h.mux = mux
	h.route = make(map[string]apiHandler)
	return &h
}

func RegisterHandler(prefix string, mux *http.ServeMux) error {

	h := newHandle(prefix, mux)
	h.addRoute("/v1/setting", settingHandler)
	h.addRoute("/v1/setting/edit", settingEditHandler)
	h.addRoute("/v1/project/list", projectListHandler)
	h.addRoute("/v1/project/register", projectRegisterHandler)
	h.addRoute("/v1/project/view", projectViewHandler)
	h.addRoute("/v1/project/edit", projectEditHandler)
	h.addRoute("/v1/project/tree", projectTreeHandler)
	h.addRoute("/v1/project/archive", projectArchiveHandler)
	h.addRoute("/v1/project/thumb/generate", projectGenerateThumbHandler)
	h.addRoute("/v1/workspace/register", workspaceRegisterHandler)
	h.addRoute("/v1/workspace/view", workspaceViewHandler)
	h.addRoute("/v1/workspace/edit", workspaceEditHandler)
	h.addRoute("/v1/workspace/render", workspaceRenderHandler)
	h.addRoute("/v1/workspace/result", workspaceResultHandler)
	h.addRoute("/v1/workspace/thumb/generate", workspaceGenerateThumbHandler)

	return nil
}

func (h *Handle) selectHandler(r *http.Request) apiHandler {

	url := strings.Replace(r.URL.String(), h.prefix, "", 1)
	ret, ok := h.route[url]
	if !ok {
		fmt.Println("notFound", url)
		return notFoundHandler
	}
	return ret
}

func (h *Handle) jsonHandler(w http.ResponseWriter, r *http.Request) {

	handler := h.selectHandler(r)

	ret, err := handler(r)
	if err != nil {
		writeError(w, err)
		return
	}

	writeJSON(w, ret)
}

func notFoundHandler(r *http.Request) (*Response, error) {
	return nil, fmt.Errorf("NotFound")
}
