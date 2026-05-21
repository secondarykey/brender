package api

import (
	"context"
	"net/http"
	"os"

	"github.com/ikascrew/brender/exec"
	"github.com/ikascrew/brender/model"
	"golang.org/x/xerrors"
)

type ProjectListReq struct {
	Paging *model.Paging `json:"paging"`
}

type ProjectListRes struct {
	Projects []*model.Project `json:"projects"`
	Paging   *model.Paging    `json:"paging"`
}

func projectListHandler(r *http.Request) (*Response, error) {

	res := newResponse()

	var req ProjectListReq
	err := parseJSONBody(r, &req)
	if err != nil {
		return nil, xerrors.Errorf("parseJSONBody() error: %w", err)
	}

	//プロジェクトの検索
	projects, err := model.SelectProjects(req.Paging)
	if err != nil {
		return nil, xerrors.Errorf("model.SelectProjects() error: %w", err)
	}
	var result ProjectListRes
	result.Projects = projects
	result.Paging = req.Paging

	res.setResult(&result)
	res.setSuccess()

	return res, nil
}

type ProjectRegisterReq struct {
	Name string `json:"name"`
	File string `json:"File"`
}

func projectRegisterHandler(r *http.Request) (*Response, error) {

	res := newResponse()

	var req ProjectRegisterReq
	err := parseJSONBody(r, &req)
	if err != nil {
		return nil, xerrors.Errorf("parseJSONBody() error: %w", err)
	}

	//ファイルが存在するか？
	if _, err = os.Stat(req.File); err != nil {
		return nil, xerrors.Errorf("Blender File not exists.: %w", err)
	}

	//プロジェクトの登録
	err = model.PutProject(req.Name, req.File)
	if err != nil {
		return nil, xerrors.Errorf("PutProject() error: %w", err)
	}

	res.setSuccess()
	return res, nil
}

type ProjectViewReq struct {
	ProjectId string        `json:"projectId"`
	Paging    *model.Paging `json:"paging"`
}

func projectViewHandler(r *http.Request) (*Response, error) {

	res := newResponse()
	var req ProjectViewReq
	err := parseJSONBody(r, &req)
	if err != nil {
		return nil, xerrors.Errorf("parseJSONBody() error: %w", err)
	}

	dst, err := model.SelectWorkspaces(req.ProjectId, req.Paging)
	if err != nil {
		return nil, xerrors.Errorf("model.SelectWorkspaces() error: %w", err)
	}

	//ロックファイルが存在するかを確認
	lock := exec.IsProjectThumbnailLock(req.ProjectId)
	if lock {
		res.addMessage("Still creating project thumbnails.For long processing, it is recommended to specify a lightly sampled scene.")
	}
	dst.Lock = lock

	res.setSuccess()
	res.setResult(dst)
	return res, nil
}

type ProjectEditReq struct {
	ProjectId string `json:"projectId"`
	Name      string `json:"name"`
	File      string `json:"blenderFile"`
	Scene     string `json:"scene"`
	Frame     int    `json:"frame"`
}

func projectEditHandler(r *http.Request) (*Response, error) {

	res := newResponse()
	var req ProjectEditReq
	err := parseJSONBody(r, &req)
	if err != nil {
		return nil, xerrors.Errorf("parseJSONBody() error: %w", err)
	}

	//ファイルが存在するか？
	if _, err = os.Stat(req.File); err != nil {
		return nil, xerrors.Errorf("Blender File not exists.: %w", err)
	}

	var p model.Project
	p.ID = req.ProjectId
	p.Name = req.Name
	p.BlenderFile = req.File
	p.Scene = req.Scene
	p.Frame = req.Frame

	err = model.EditProject(&p)
	if err != nil {
		return nil, xerrors.Errorf("model.EditProject() error: %w", err)
	}

	res.setSuccess()
	return res, nil
}

func projectGenerateThumbHandler(r *http.Request) (*Response, error) {

	res := newResponse()
	var req ProjectEditReq
	err := parseJSONBody(r, &req)
	if err != nil {
		return nil, xerrors.Errorf("parseJSONBody() error: %w", err)
	}

	err = exec.CreateProjectThumbnail(context.Background(), req.ProjectId)
	if err != nil {
		return nil, xerrors.Errorf("CreateProjectThumnnail() error: %w", err)
	}

	res.setSuccess()
	return res, nil
}

func projectArchiveHandler(r *http.Request) (*Response, error) {

	res := newResponse()
	var req ProjectViewReq
	err := parseJSONBody(r, &req)
	if err != nil {
		return nil, xerrors.Errorf("parseJSONBody() error: %w", err)
	}

	err = exec.ArchiveProjectFiles(req.ProjectId)
	if err != nil {
		return nil, xerrors.Errorf("exec.ArchiveProjectFiles() error: %w", err)
	}

	res.setSuccess()
	return res, nil
}

type ProjectTreeReq struct {
	ProjectId string `json:"projectId"`
}

type ProjectTreeRes struct {
	Root *exec.Branch `json:"root"`
}

func projectTreeHandler(r *http.Request) (*Response, error) {

	res := newResponse()
	var req ProjectTreeReq
	err := parseJSONBody(r, &req)
	if err != nil {
		return nil, xerrors.Errorf("parseJSONBody() error: %w", err)
	}

	root, err := exec.CreateProjectTree(req.ProjectId, false)
	if err != nil {
		return nil, xerrors.Errorf("exec.CreateTree() error: %w", err)
	}

	res.setSuccess()
	res.setResult(root)
	return res, nil
}
