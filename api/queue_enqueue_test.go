package api

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/secondarykey/brender/model"
)

// ジョブ名はワークスペース名の前にファイル名を付ける（ワークスペース名「Default」はどのファイルにもあるため）。
func TestJobName(t *testing.T) {
	dsn := filepath.Join(t.TempDir(), "test.db")
	if err := model.Init(dsn); err != nil {
		t.Fatalf("Init: %v", err)
	}
	t.Cleanup(func() { model.Close() })

	detail, err := model.CreateProject(context.Background(), "Proj", nil, 0)
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}
	file, err := model.AddProjectFile(context.Background(), detail.Project.ID, "/tmp/scene.blend")
	if err != nil {
		t.Fatalf("AddProjectFile: %v", err)
	}

	if got := jobName(file.ID, defaultWorkspaceName+" (Test)"); got != "scene.blend Default (Test)" {
		t.Errorf("jobName = %q", got)
	}
	if got := jobName("missing", "Default"); got != "Default" {
		t.Errorf("jobName(missing) = %q", got)
	}
}
