package model

import (
	"path/filepath"
	"testing"
	"time"
)

// サムネイル用に隠していたワークスペース（is_system=1）が起動時に普通のワークスペースとして一覧に出て、
// そこの Test ジョブがファイルのサムネイルの元として辿れること。
func TestMigrateSystemWorkspaces(t *testing.T) {
	dsn := filepath.Join(t.TempDir(), "test.db")
	if err := Init(dsn); err != nil {
		t.Fatalf("Init: %v", err)
	}
	t.Cleanup(func() { Close() })

	detail, err := CreateProject("Proj", nil, 0)
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}
	projectID := detail.Project.ID
	file, err := AddProjectFile(projectID, "/tmp/scene.blend")
	if err != nil {
		t.Fatalf("AddProjectFile: %v", err)
	}

	// 隠していた頃のデータを作る（列は GORM の AutoMigrate と同じ形で足す）
	if res := db.Exec("ALTER TABLE `workspaces` ADD `is_system` numeric DEFAULT false"); res.Error != nil {
		t.Fatalf("add column: %v", res.Error)
	}
	hidden, err := CreateWorkspace(projectID, file.ID, "scene.blend Thumbnail")
	if err != nil {
		t.Fatalf("CreateWorkspace(hidden): %v", err)
	}
	if res := db.Exec("UPDATE workspaces SET is_system = 1 WHERE id = ?", hidden.ID); res.Error != nil {
		t.Fatalf("mark system: %v", res.Error)
	}
	normal, err := CreateWorkspace(projectID, file.ID, "本番用")
	if err != nil {
		t.Fatalf("CreateWorkspace(normal): %v", err)
	}

	earlier := time.Now().Add(-time.Hour)
	later := time.Now()
	thumbJob := &Job{ID: "job-thumb", ProjectID: projectID, WorkspaceID: hidden.ID, ProjectFileID: file.ID,
		Status: JobCompleted, JobType: JobTypeTest, EnqueuedAt: &earlier}
	renderJob := &Job{ID: "job-render", ProjectID: projectID, WorkspaceID: normal.ID, ProjectFileID: file.ID,
		Status: JobCompleted, JobType: JobTypeRender, EnqueuedAt: &later}
	for _, j := range []*Job{thumbJob, renderJob} {
		if err := CreateJob(j); err != nil {
			t.Fatalf("CreateJob: %v", err)
		}
	}

	if err := migrateSystemWorkspaces(); err != nil {
		t.Fatalf("migrateSystemWorkspaces: %v", err)
	}
	if db.Migrator().HasColumn(&Workspace{}, "is_system") {
		t.Errorf("is_system column still exists")
	}
	// 2回目は何もしない
	if err := migrateSystemWorkspaces(); err != nil {
		t.Fatalf("migrateSystemWorkspaces(2nd): %v", err)
	}

	list, err := ListWorkspacesByProject(projectID, "", "")
	if err != nil {
		t.Fatalf("ListWorkspacesByProject: %v", err)
	}
	if len(list) != 1 || len(list[0].Workspaces) != 2 {
		t.Fatalf("workspaces = %+v, want 2 under the file", list)
	}

	// 新しい render ジョブがあっても、サムネイルの元は Test ジョブ
	got, err := GetLatestTestJobByFile(file.ID)
	if err != nil {
		t.Fatalf("GetLatestTestJobByFile: %v", err)
	}
	if got == nil || got.ID != thumbJob.ID {
		t.Fatalf("test job = %+v, want %s", got, thumbJob.ID)
	}
}
