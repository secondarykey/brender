package model

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"golang.org/x/xerrors"
	"gorm.io/gorm"
)

type Project struct {
	ID                 string    `gorm:"primaryKey" json:"id"`
	Name               string    `json:"name"`
	BlenderFile        string    `json:"blender_file"`
	BlenderLastUpdated time.Time `json:"blender_file_late_updated"`
	Scene              string    `json:"scene"`
	Frame              int       `json:"frame"`
	Archive            bool      `json:"archive"`
	MetaFields         `gorm:"embedded"`
}

type ProjectWorkspaces struct {
	Project    *Project     `json:"project"`
	Workspaces []*Workspace `json:"workspaces"`
	Lock       bool         `json:"lock"`
	Paging     *Paging      `json:"paging"`
}

func newProject(name string) *Project {
	var p Project
	p.ID = p.generateId()
	p.Name = name
	return &p
}

func (p *Project) generateId() string {
	id, err := uuid.NewUUID()
	if err != nil {
		panic(err)
	}
	return id.String()
}

func SelectProjects(p *Paging) ([]*Project, error) {

	var cnt int64
	res := db.Model(&Project{}).Count(&cnt)
	if res.Error != nil {
		return nil, xerrors.Errorf("Project count error: %w", res.Error)
	}
	p.Count = int(cnt)

	var projects []*Project
	offset := (p.Current - 1) * p.Limit
	limit := p.Limit

	db.Offset(offset).Limit(limit).Find(&projects)
	if res.Error != nil {
		if errors.Is(res.Error, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, xerrors.Errorf("Project count error: %w", res.Error)
	}
	return projects, nil
}

func PutProject(name string, file string) error {

	p := newProject(name)
	p.BlenderFile = file

	db.Create(&p)
	if db.Error != nil {
		return xerrors.Errorf("project Register error: %w", db.Error)
	}

	return nil
}

func EditProject(p *Project) error {

	dbP, err := SelectProject(p.ID)
	if err != nil {
		return xerrors.Errorf("SelectProject() error: %w", err)
	}

	dbP.Name = p.Name

	dbP.BlenderFile = p.BlenderFile
	dbP.Frame = p.Frame
	dbP.Scene = p.Scene

	res := db.Save(dbP)
	if res.Error != nil {
		return xerrors.Errorf("Save() error: %w", res.Error)
	}

	return nil
}

func SelectProject(id string) (*Project, error) {
	var p Project

	db.First(&p, "id = ?", id)
	if db.Error != nil {
		return nil, xerrors.Errorf("Select Project: %w", db.Error)
	}
	return &p, nil
}

func SelectWorkspaces(projectId string, pg *Paging) (*ProjectWorkspaces, error) {

	var rtn ProjectWorkspaces

	p, err := SelectProject(projectId)
	if err != nil {
		return nil, xerrors.Errorf("SelectProject() error: %w", err)
	}
	rtn.Project = p

	wk, err := selectWorkspaces(projectId, pg)
	if err != nil {
		return nil, xerrors.Errorf("selectWorkspaces() error: %w", err)
	}
	rtn.Workspaces = wk
	rtn.Paging = pg

	return &rtn, nil
}

func selectWorkspaces(projectId string, pg *Paging) ([]*Workspace, error) {

	var cnt int64

	res := db.Model(&Workspace{}).Where("project_id = ?", projectId).Count(&cnt)
	pg.Count = int(cnt)
	offset := (pg.Current - 1) * pg.Limit
	limit := pg.Limit

	var wk []*Workspace
	res = db.Where("project_id = ?", projectId).Offset(offset).Limit(limit).Find(&wk)

	if res.Error != nil {
		if errors.Is(res.Error, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, xerrors.Errorf("Project count error: %w", res.Error)
	}

	return wk, nil
}

func SetProjectArchive(id string) error {

	dbP, err := SelectProject(id)
	if err != nil {
		return xerrors.Errorf("SelectProject() error: %w", err)
	}

	dbP.Archive = true

	res := db.Save(dbP)
	if res.Error != nil {
		return xerrors.Errorf("Save() error: %w", res.Error)
	}
	return nil
}
