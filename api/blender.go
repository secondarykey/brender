package api

import (
	"context"
	"fmt"
	"os"
	osexec "os/exec"
	"path/filepath"
	"sync"

	"github.com/secondarykey/brender/exec"
	"github.com/secondarykey/brender/log"
	"github.com/secondarykey/brender/model"
	"golang.org/x/xerrors"
)

// BlenderWarningHook は起動時の Blender 検証で警告が発生したときに呼ばれるフック。
var BlenderWarningHook func(warnings []string)

// 起動時検証の結果。フロントエンドがイベント購読より先に起動を終えていない場合に
// 取りこぼすため、最新の警告を保持して後から取得できるようにする。
var (
	blenderWarnMu sync.RWMutex
	blenderWarns  []string
)

func setBlenderWarnings(warnings []string) {
	blenderWarnMu.Lock()
	blenderWarns = warnings
	blenderWarnMu.Unlock()
}

// BlenderWarnings は直近の VerifyBlenderInstalls で検出した警告を返す。
func BlenderWarnings() []string {
	blenderWarnMu.RLock()
	defer blenderWarnMu.RUnlock()
	return append([]string(nil), blenderWarns...)
}

func RegisterBlender(ctx context.Context, path string) (*model.BlenderInstall, error) {
	if err := requireAdmin(ctx); err != nil {
		return nil, err
	}
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

func DeleteBlender(ctx context.Context, id uint) error {
	if err := requireAdmin(ctx); err != nil {
		return err
	}
	count, err := model.CountWorkspacesByBlender(id)
	if err != nil {
		return xerrors.Errorf("DeleteBlender check: %w", err)
	}
	if count > 0 {
		return xerrors.Errorf("このBlenderを参照しているワークスペースが %d 件あります。先にワークスペースの設定を変更してください。", count)
	}
	return model.RemoveBlenderInstall(id)
}

// BlenderReferences は指定 Blender を参照しているワークスペース・ファイル・
// プロジェクトを列挙する。削除できないときに参照元を提示するために使う。
func BlenderReferences(ctx context.Context, id uint) ([]*model.BlenderReference, error) {
	if err := requireAdmin(ctx); err != nil {
		return nil, err
	}
	return model.ListBlenderReferences(id)
}

// BlenderResetResult は ResetBlenderReferences の更新件数。
type BlenderResetResult struct {
	Workspaces int64 `json:"workspaces"`
	Files      int64 `json:"files"`
}

// ResetBlenderReferences は指定 Blender を参照しているワークスペース・ファイルを
// デフォルト設定に戻す。削除前に参照を外すために使う。
func ResetBlenderReferences(ctx context.Context, id uint) (*BlenderResetResult, error) {
	if err := requireAdmin(ctx); err != nil {
		return nil, err
	}
	ws, files, err := model.ResetBlenderReferences(id)
	if err != nil {
		return nil, err
	}
	log.Noticef("ResetBlenderReferences: blender=%d workspaces=%d files=%d", id, ws, files)
	return &BlenderResetResult{Workspaces: ws, Files: files}, nil
}

func ReorderBlenders(ctx context.Context, ids []uint) error {
	if err := requireAdmin(ctx); err != nil {
		return err
	}
	return model.ReorderBlenders(ids)
}

// VerifyBlenderInstalls は登録済み Blender のパス存在とバージョンを検証する。
// パスが存在しない場合は警告、バージョンが変わっていた場合は DB を更新する。
func VerifyBlenderInstalls() {
	installs, err := model.ListBlenders()
	if err != nil {
		log.Errorf("VerifyBlenderInstalls: ListBlenders: %v", err)
		return
	}
	if len(installs) == 0 {
		return
	}

	var warnings []string
	for _, inst := range installs {
		if _, err := os.Stat(inst.Path); err != nil {
			msg := fmt.Sprintf("%s (%s): パスが見つかりません", inst.Name, inst.Path)
			log.Warnf("VerifyBlenderInstalls: %s", msg)
			warnings = append(warnings, msg)
			continue
		}

		b, err := exec.NewBlender(inst.Path)
		if err != nil {
			log.Warnf("VerifyBlenderInstalls: NewBlender(%s): %v", inst.Path, err)
			continue
		}
		newVersion := b.Version()
		if newVersion == "" || newVersion == "-" {
			log.Warnf("VerifyBlenderInstalls: バージョン取得失敗: %s", inst.Path)
			continue
		}
		if newVersion != inst.Version {
			log.Noticef("VerifyBlenderInstalls: %s バージョン更新 %s → %s", inst.Name, inst.Version, newVersion)
			if err := model.UpdateBlenderVersion(inst.ID, newVersion); err != nil {
				log.Errorf("VerifyBlenderInstalls: UpdateBlenderVersion: %v", err)
			}
		}
	}

	setBlenderWarnings(warnings)

	if len(warnings) > 0 && BlenderWarningHook != nil {
		BlenderWarningHook(warnings)
	}
}

// MissingBlenderPaths は登録済み Blender のうち実行ファイルが存在しないものの ID を返す。
// os.Stat のみの軽量チェックで、Blender の起動は行わない。
func MissingBlenderPaths() ([]uint, error) {
	installs, err := model.ListBlenders()
	if err != nil {
		return nil, xerrors.Errorf("MissingBlenderPaths: %w", err)
	}
	missing := []uint{}
	for _, inst := range installs {
		if _, err := os.Stat(inst.Path); err != nil {
			missing = append(missing, inst.ID)
		}
	}
	return missing, nil
}

func GetScenes(installID uint, fileID string) ([]string, error) {
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

// OpenBlenderFile は Blender GUI でファイルを開く。
// -b を付けないので Blender がウィンドウ付きで起動する。
// プロセスは非同期で起動し、呼び出し元はブロックされない。
func OpenBlenderFile(ctx context.Context, installID uint, filePath string) error {
	if err := requireAdmin(ctx); err != nil {
		return err
	}
	var blenderPath string
	if installID != 0 {
		install, err := model.GetBlenderInstall(installID)
		if err != nil {
			return xerrors.Errorf("GetBlenderInstall: %w", err)
		}
		if install == nil {
			return xerrors.Errorf("blender install not found: %d", installID)
		}
		blenderPath = install.Path
	} else {
		b, err := model.FirstBlender()
		if err != nil || b == nil {
			// 登録済み Blender がなければシステムの blender コマンドを試みる
			blenderPath = "blender"
		} else {
			blenderPath = b.Path
		}
	}
	cmd := osexec.Command(blenderPath, filePath)
	exec.HideConsole(cmd)
	return cmd.Start()
}

func GetToolData(installID uint, fileID string) (*exec.Tool, error) {
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
		return nil, xerrors.Errorf("project file not found: %s", fileID)
	}
	tool, err := exec.RunToolData(blenderPath, file.Path)
	if err != nil {
		return nil, err
	}
	// Pack 状態を DB に保存
	if updateErr := model.UpdateProjectFilePacked(fileID, tool.Pack); updateErr != nil {
		log.Errorf("GetToolData: UpdateProjectFilePacked fileID=%s error=%v", fileID, updateErr)
	}
	return tool, nil
}

func GetCameras(installID uint, fileID string) ([]*exec.CameraTool, error) {
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
		return nil, xerrors.Errorf("project file not found: %s", fileID)
	}
	return exec.RunCameras(blenderPath, file.Path)
}

func GetEngines(installID uint) ([]string, error) {
	blenderPath, err := resolveBlenderPath(installID, 0)
	if err != nil {
		return nil, err
	}
	return exec.RunEnginesFromTool(blenderPath)
}
