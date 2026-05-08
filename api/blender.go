package api

import (
	"os"
	"path/filepath"

	"github.com/ikascrew/brender/exec"
	"github.com/ikascrew/brender/model"
	"golang.org/x/xerrors"
)

func RegisterBlender(path string) (*model.BlenderInstall, error) {
	if _, err := os.Stat(path); err != nil {
		return nil, xerrors.Errorf("blender not found: %s", path)
	}

	b, err := exec.NewBlender(path)
	if err != nil {
		return nil, xerrors.Errorf("NewBlender error: %w", err)
	}
	version := b.Version()

	name := filepath.Base(filepath.Dir(path))

	install, err := model.AddBlenderInstall(path, version, name)
	if err != nil {
		return nil, xerrors.Errorf("AddBlenderInstall error: %w", err)
	}
	return install, nil
}

func ListBlenders() ([]*model.BlenderInstall, error) {
	return model.ListBlenders()
}

func DeleteBlender(id uint) error {
	count, err := model.CountWorkspacesByBlender(id)
	if err != nil {
		return xerrors.Errorf("DeleteBlender check: %w", err)
	}
	if count > 0 {
		return xerrors.Errorf("このBlenderを参照しているワークスペースが %d 件あります。先にワークスペースの設定を変更してください。", count)
	}
	return model.RemoveBlenderInstall(id)
}

func ReorderBlenders(ids []uint) error {
	return model.ReorderBlenders(ids)
}

func GetScenes(installID uint, fileID uint) ([]string, error) {
	var blenderPath string
	if installID != 0 {
		install, err := model.GetBlenderInstall(installID)
		if err != nil {
			return nil, xerrors.Errorf("GetBlenderInstall: %w", err)
		}
		if install == nil {
			return nil, xerrors.Errorf("blender install not found: %d", installID)
		}
		blenderPath = install.Path
	} else {
		b, err := model.FirstBlender()
		if err != nil || b == nil {
			return nil, xerrors.New("Blenderが登録されていません")
		}
		blenderPath = b.Path
	}
	file, err := model.GetProjectFile(fileID)
	if err != nil {
		return nil, xerrors.Errorf("GetProjectFile: %w", err)
	}
	if file == nil {
		return nil, xerrors.Errorf("project file not found: %d", fileID)
	}
	return exec.RunScenes(blenderPath, file.Path)
}

func GetEngines(installID uint) ([]string, error) {
	var blenderPath string
	if installID != 0 {
		install, err := model.GetBlenderInstall(installID)
		if err != nil {
			return nil, xerrors.Errorf("GetBlenderInstall error: %w", err)
		}
		if install == nil {
			return nil, xerrors.Errorf("blender install not found: %d", installID)
		}
		blenderPath = install.Path
	} else {
		b, err := model.FirstBlender()
		if err != nil || b == nil {
			return nil, xerrors.New("Blenderが登録されていません")
		}
		blenderPath = b.Path
	}
	return exec.RunEngines(blenderPath)
}
