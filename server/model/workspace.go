package model

import (
	"fmt"

	"golang.org/x/xerrors"
)

type Workspace struct {
	ID         int    `gorm:"primaryKey" json:"id"`
	ProjectId  string `json:"project_id"`
	Name       string `json:"name"`
	Scene      string `json:"scene"`
	Frame      int    `json:"frame"`
	StartFrame int    `json:"start"`
	EndFrame   int    `json:"end"`
	MetaFields `gorm:"embedded"`
}

func newWorkspace(name string) *Workspace {
	var workspace Workspace
	workspace.Name = name
	return &workspace
}

func PutWorkspace(projectId string, name string) error {

	w := newWorkspace(name)
	w.ProjectId = projectId

	db.Create(w)
	if db.Error != nil {
		return xerrors.Errorf("workspace Register error: %w", db.Error)
	}

	return nil
}

func SelectWorkspace(pId string, wId int) (*Workspace, error) {

	var w Workspace
	db.First(&w, "id = ?", wId)
	if db.Error != nil {
		return nil, xerrors.Errorf("db.First() error: %w", db.Error)
	}

	if w.ProjectId != pId {
		return nil, fmt.Errorf("ProjectId is different." + w.ProjectId)
	}
	return &w, nil
}

func EditWorkspace(w *Workspace) error {

	dbW, err := SelectWorkspace(w.ProjectId, w.ID)
	if err != nil {
		return xerrors.Errorf("SelectProject() error: %w", err)
	}

	dbW.Name = w.Name
	dbW.Frame = w.Frame
	dbW.Scene = w.Scene
	dbW.StartFrame = w.StartFrame
	dbW.EndFrame = w.EndFrame

	res := db.Save(dbW)
	if res.Error != nil {
		return xerrors.Errorf("Save() error: %w", res.Error)
	}

	fmt.Println(res.RowsAffected)

	return nil
}
