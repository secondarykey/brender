package api

import (
	"context"
	"net/http"

	"github.com/ikascrew/brender/exec"
	"github.com/ikascrew/brender/model"
	"golang.org/x/xerrors"
)

type WorkspaceRegisterReq struct {
	ProjectId string `json:"projectId"`
	Name      string `json:"name"`
}

func workspaceRegisterHandler(r *http.Request) (*Response, error) {

	res := newResponse()

	var req WorkspaceRegisterReq
	err := parseJSONBody(r, &req)
	if err != nil {
		return nil, xerrors.Errorf("parseJSONBody() error: %w", err)
	}

	//プロジェクトの検索
	err = model.PutWorkspace(req.ProjectId, req.Name)
	if err != nil {
		return nil, xerrors.Errorf("PutProject() error: %w", err)
	}

	res.setSuccess()
	return res, nil
}

type WorkspaceViewReq struct {
	ProjectId   string        `json:"projectId"`
	WorkspaceId int           `json:"workspaceId"`
	Paging      *model.Paging `json:"paging"`
}

type WorkspaceViewRes struct {
	Workspace *model.Workspace `json:"workspace"`
	Jobs      []*model.Job     `json:"jobs"`
	Lock      bool             `json:"lock"`
	Rendering bool             `json:"rendering"`
	Paging    *model.Paging    `json:"paging"`
}

func workspaceViewHandler(r *http.Request) (*Response, error) {

	res := newResponse()
	var req WorkspaceViewReq
	err := parseJSONBody(r, &req)
	if err != nil {
		return nil, xerrors.Errorf("parseJSONBody() error: %w", err)
	}

	var result WorkspaceViewRes

	w, err := model.SelectWorkspace(req.ProjectId, req.WorkspaceId)
	if err != nil {
		return nil, xerrors.Errorf("SelectWorkspace() error: %w", err)
	}
	result.Workspace = w

	//ジョブの検索
	jobs, err := model.SelectJobs(req.ProjectId, req.WorkspaceId, req.Paging)
	if err != nil {
		return nil, xerrors.Errorf("SelectJobs() error: %w", err)
	}

	//ロックファイルが存在するかを確認
	lock := exec.IsWorkspaceThumbnailLock(req.ProjectId, req.WorkspaceId)
	if lock {
		res.addMessage("Still creating workspace thumbnails.For long processing, it is recommended to specify a lightly sampled scene.")
	}
	result.Lock = lock

	//レンダリング確認
	rendering := exec.IsWorkspaceRendering(req.ProjectId, req.WorkspaceId)
	if rendering {
		res.addMessage("Still workspace rendering.")
	}
	result.Rendering = rendering
	result.Paging = req.Paging
	result.Jobs = jobs

	res.setSuccess()
	res.setResult(&result)
	return res, nil
}

type WorkspaceResultRes struct {
	Size  int64    `json:"size"`
	Files []string `json:"files"`
}

func workspaceResultHandler(r *http.Request) (*Response, error) {

	res := newResponse()
	var req WorkspaceViewReq
	err := parseJSONBody(r, &req)
	if err != nil {
		return nil, xerrors.Errorf("parseJSONBody() error: %w", err)
	}

	//処理結果を検索
	files, size := exec.SearchResultFiles(req.ProjectId, req.WorkspaceId, false)
	var ret WorkspaceResultRes
	ret.Size = size
	ret.Files = files

	res.setSuccess()
	res.setResult(ret)
	return res, nil
}

type WorkspaceEditReq struct {
	ProjectId   string `json:"projectId"`
	WorkspaceId int    `json:"workspaceId"`
	Name        string `json:"name"`
	Scene       string `json:"scene"`
	Frame       int    `json:"frame"`
	Start       int    `json:"start"`
	End         int    `json:"end"`
}

func workspaceEditHandler(r *http.Request) (*Response, error) {

	res := newResponse()
	var req WorkspaceEditReq
	err := parseJSONBody(r, &req)
	if err != nil {
		return nil, xerrors.Errorf("parseJSONBody() error: %w", err)
	}

	var w model.Workspace
	w.ID = req.WorkspaceId
	w.ProjectId = req.ProjectId
	w.Name = req.Name
	w.Scene = req.Scene
	w.Frame = req.Frame
	w.StartFrame = req.Start
	w.EndFrame = req.End

	err = model.EditWorkspace(&w)
	if err != nil {
		return nil, xerrors.Errorf("parseJSONBody() error: %w", err)
	}

	res.setSuccess()
	return res, nil
}

func workspaceGenerateThumbHandler(r *http.Request) (*Response, error) {

	res := newResponse()
	var req WorkspaceViewReq
	err := parseJSONBody(r, &req)
	if err != nil {
		return nil, xerrors.Errorf("parseJSONBody() error: %w", err)
	}

	pId := req.ProjectId
	wId := req.WorkspaceId

	err = exec.CreateWorkspaceThumbnail(context.Background(), pId, wId)
	if err != nil {
		return nil, xerrors.Errorf("CreateWorkspaceThumnnail() error: %w", err)
	}
	res.setSuccess()
	return res, nil
}

func workspaceRenderHandler(r *http.Request) (*Response, error) {

	res := newResponse()
	var req WorkspaceViewReq
	err := parseJSONBody(r, &req)
	if err != nil {
		return nil, xerrors.Errorf("parseJSONBody() error: %w", err)
	}

	jobId, err := exec.RunWorkspace(context.Background(), req.ProjectId, req.WorkspaceId)
	if err != nil {
		return nil, xerrors.Errorf("Runworkspace() error: %w", err)
	}

	res.setSuccess()
	res.setResult(jobId)
	return res, nil
}
