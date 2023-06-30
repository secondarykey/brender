package model

import (
	"errors"
	"fmt"

	"golang.org/x/xerrors"
	"gorm.io/gorm"
)

type Job struct {
	ID         int    `gorm:"primaryKey" json:"id"`
	JobId      string `json:"job_id"`
	ProjectId  string `json:"projectId"`
	ProcessId  int    `json:"ProcessId"`
	Complated  bool   `json:"complated"`
	Success    bool   `json:"success"`
	Detail     string `json:"detail"`
	MetaFields `gorm:"embedded"`
}

func CreateJob(jobId string, pId string, processId int) error {
	var job Job
	job.JobId = jobId
	job.ProjectId = pId
	job.ProcessId = processId
	job.Complated = false
	job.Success = false
	job.Detail = ""

	db.Create(&job)
	if db.Error != nil {
		return xerrors.Errorf("Job Register error: %w", db.Error)
	}

	return nil
}

func ComplateJob(jobId string, jobError error) error {

	var job Job
	db.Order("created_at desc").First(&job, "job_id = ?", jobId)
	if db.Error != nil {
		return xerrors.Errorf("Select Job: %w", db.Error)
	}

	job.Complated = true
	job.Success = true
	if jobError != nil {
		job.Success = false
		job.Detail = fmt.Sprintf("%+v", jobError)
	}

	res := db.Save(&job)
	if res.Error != nil {
		return xerrors.Errorf("Save Job: %w", res.Error)
	}

	return nil
}

func SelectJobs(pId string, wId int) ([]*Job, error) {
	var jobs []*Job
	res := db.Where("project_id = ?", pId, "workspace_id = ?", wId).Find(&jobs)
	if res.Error != nil {
		if errors.Is(res.Error, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, xerrors.Errorf("Jobs error: %w", res.Error)
	}
	return jobs, nil
}
