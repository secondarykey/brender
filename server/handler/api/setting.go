package api

import (
	"net/http"
	"os"

	"github.com/ikascrew/brender/exec"
	"github.com/ikascrew/brender/model"
	"golang.org/x/xerrors"
)

func settingHandler(r *http.Request) (*Response, error) {

	env, err := model.GetEnv()
	if err != nil {
		return nil, xerrors.Errorf("GetEnv() error: %w", err)
	}

	res := newResponse()
	res.setSuccess()
	res.setResult(env)
	return res, nil
}

type settingEditReq struct {
	Cmd  string `json:"cmd"`
	Root string `json:"root"`
}

func settingEditHandler(r *http.Request) (*Response, error) {

	res := newResponse()
	//コマンドを実行して存在確認
	var req settingEditReq
	err := parseJSONBody(r, &req)
	if err != nil {
		return nil, xerrors.Errorf("parseJSONBody() error: %w", err)
	}

	//ブレンダの確認
	if _, err := os.Stat(req.Cmd); err != nil {
		res.addMessage("Blender Command is not exists." + req.Cmd)
		return res, nil
	}

	//プロジェクトの位置指定を取得
	if _, err := os.Stat(req.Root); err != nil {
		res.addMessage("ProjectRoot is not exists.")
		return res, nil
	}

	//バージョンでブレンダの実行
	ver, err := exec.RunVersion(req.Cmd)
	if err != nil {
		return nil, xerrors.Errorf("blender version error: %w", err)
	}

	env, err := model.GetEnv()
	if err != nil {
		return nil, xerrors.Errorf("model.GetEnv() error: %w", err)
	}

	if env == nil {
		env = &model.Environment{}
	}

	env.BlenderCmd = req.Cmd
	env.BlenderVersion = ver
	env.ProjectRoot = req.Root
	if env.Hash == "" {
		env.Hash = model.GenerateEnvHash()
	}

	//DB を更新
	err = model.SetEnvironment(env)
	if err != nil {
		return nil, xerrors.Errorf("environment save error: %w", err)
	}

	res.setSuccess()
	res.addMessage("Saved")

	return res, nil
}
