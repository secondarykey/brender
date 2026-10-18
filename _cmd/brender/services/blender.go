package services

import (
	"context"
	"runtime"

	"github.com/secondarykey/brender/api"
	"github.com/secondarykey/brender/exec"
	"github.com/secondarykey/brender/model"
)

type Blender struct{}

func NewBlender() *Blender {
	var b Blender
	return &b
}

func (s *Blender) List(ctx context.Context) ([]*model.BlenderInstall, error) {
	return api.ListBlenders()
}

func (s *Blender) Register(ctx context.Context, path string) (*model.BlenderInstall, error) {
	return api.RegisterBlender(ctx, path)
}

func (s *Blender) Delete(ctx context.Context, id uint) error {
	return api.DeleteBlender(ctx, id)
}

// References は指定 Blender を参照しているワークスペース等を返す。
func (s *Blender) References(ctx context.Context, id uint) ([]*model.BlenderReference, error) {
	return api.BlenderReferences(ctx, id)
}

// ResetReferences は参照しているワークスペース・ファイルをデフォルト設定に戻す。
func (s *Blender) ResetReferences(ctx context.Context, id uint) (*api.BlenderResetResult, error) {
	return api.ResetBlenderReferences(ctx, id)
}

func (s *Blender) Reorder(ctx context.Context, ids []uint) error {
	return api.ReorderBlenders(ctx, ids)
}

func (s *Blender) OpenFile(ctx context.Context, installID uint, filePath string) error {
	return api.OpenBlenderFile(ctx, installID, filePath)
}

func (s *Blender) GetEngines(ctx context.Context, installID uint) ([]string, error) {
	return api.GetEngines(installID)
}

func (s *Blender) GetScenes(ctx context.Context, installID uint, fileID string) ([]string, error) {
	return api.GetScenes(installID, fileID)
}

func (s *Blender) GetCameras(ctx context.Context, installID uint, fileID string) ([]*exec.CameraTool, error) {
	return api.GetCameras(installID, fileID)
}

func (s *Blender) GetToolData(ctx context.Context, installID uint, fileID string) (*exec.Tool, error) {
	return api.GetToolData(installID, fileID)
}

// Warnings は起動時検証で検出した警告（パス消失など）を返す。
// 起動直後のイベントをフロントエンドが取りこぼすため、マウント時に取得する用途。
func (s *Blender) Warnings(ctx context.Context) []string {
	return api.BlenderWarnings()
}

// CheckPaths は実行ファイルが存在しない Blender の ID を返す（軽量チェック）。
func (s *Blender) CheckPaths(ctx context.Context) ([]uint, error) {
	return api.MissingBlenderPaths()
}

func (s *Blender) GetCPUCount(ctx context.Context) int {
	return runtime.NumCPU()
}
