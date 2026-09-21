package model

import (
	"path/filepath"
	"testing"
)

// ListBlenderReferences は生 SQL を使うため、実スキーマに対して流して
// カラム名のずれを検出する。
func TestListBlenderReferences(t *testing.T) {
	dsn := filepath.Join(t.TempDir(), "test.db")
	if err := Init(dsn); err != nil {
		t.Fatalf("Init: %v", err)
	}
	// Windows では接続を閉じないと TempDir のクリーンアップが失敗する。
	t.Cleanup(func() { Close() })

	install, err := AddBlenderInstall("/path/to/blender", "4.2.0", "blender-4.2")
	if err != nil {
		t.Fatalf("AddBlenderInstall: %v", err)
	}
	other, err := AddBlenderInstall("/path/to/other", "5.0.0", "blender-5.0")
	if err != nil {
		t.Fatalf("AddBlenderInstall(other): %v", err)
	}

	detail, err := CreateProject("Proj", nil, 0)
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}
	projectID := detail.Project.ID

	file, err := AddProjectFile(projectID, "/tmp/scene.blend")
	if err != nil {
		t.Fatalf("AddProjectFile: %v", err)
	}

	ws, err := CreateWorkspace(projectID, file.ID, "本番用", false)
	if err != nil {
		t.Fatalf("CreateWorkspace: %v", err)
	}
	if res := db.Model(&Workspace{}).Where("id = ?", ws.ID).
		Update("blender_install_id", install.ID); res.Error != nil {
		t.Fatalf("update workspace: %v", res.Error)
	}
	if res := db.Model(&ProjectFile{}).Where("id = ?", file.ID).
		Update("blender_install_id", install.ID); res.Error != nil {
		t.Fatalf("update file: %v", res.Error)
	}

	refs, err := ListBlenderReferences(install.ID)
	if err != nil {
		t.Fatalf("ListBlenderReferences: %v", err)
	}
	if len(refs) != 2 {
		t.Fatalf("len(refs) = %d, want 2: %+v", len(refs), refs)
	}

	w := refs[0]
	if w.Kind != "workspace" || w.WorkspaceID != ws.ID || w.WorkspaceName != "本番用" {
		t.Errorf("workspace ref = %+v", w)
	}
	if w.ProjectName != "Proj" || w.FileName != file.Name || w.ProjectID != projectID {
		t.Errorf("workspace ref names = %+v", w)
	}
	if refs[1].Kind != "file" || refs[1].FileID != file.ID {
		t.Errorf("file ref = %+v", refs[1])
	}

	// ワークスペース参照の件数は削除可否の判定と一致していなければならない。
	count, err := CountWorkspacesByBlender(install.ID)
	if err != nil {
		t.Fatalf("CountWorkspacesByBlender: %v", err)
	}
	var wsRefs int
	for _, r := range refs {
		if r.Kind == "workspace" {
			wsRefs++
		}
	}
	if int64(wsRefs) != count {
		t.Errorf("workspace refs = %d, count = %d", wsRefs, count)
	}

	// デフォルトに戻すと参照が外れ、削除可能になる。
	wsReset, fileReset, err := ResetBlenderReferences(install.ID)
	if err != nil {
		t.Fatalf("ResetBlenderReferences: %v", err)
	}
	if wsReset != 1 || fileReset != 1 {
		t.Errorf("reset counts = (%d, %d), want (1, 1)", wsReset, fileReset)
	}
	after, err := ListBlenderReferences(install.ID)
	if err != nil {
		t.Fatalf("ListBlenderReferences(after reset): %v", err)
	}
	if len(after) != 0 {
		t.Errorf("len(after) = %d, want 0: %+v", len(after), after)
	}

	// 参照していない Blender は空を返す。
	empty, err := ListBlenderReferences(other.ID)
	if err != nil {
		t.Fatalf("ListBlenderReferences(other): %v", err)
	}
	if len(empty) != 0 {
		t.Errorf("len(empty) = %d, want 0: %+v", len(empty), empty)
	}
}
