package model

import (
	"errors"
	"fmt"
	"strings"

	"golang.org/x/xerrors"
	"gorm.io/gorm"
)

type Job struct {
	ID          int    `gorm:"primaryKey" json:"id"`
	JobId       string `json:"jobId"`
	ProjectId   string `json:"projectId"`
	WorkspaceId int    `json:"workspaceId"`
	ProcessId   int    `json:"ProcessId"`
	Complated   bool   `json:"complated"`
	Success     bool   `json:"success"`
	Detail      string `json:"detail"`
	MetaFields  `gorm:"embedded"`
}

func CreateJob(jobId string, pId string, wId int, processId int) error {

	//ジョブがサムネイルだった場合、削除を行う
	if strings.Index(jobId, "thumb") != -1 {

		job, err := SelectByJobId(jobId)
		if err != nil {
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				return xerrors.Errorf("SelectByJobId() error: %w", err)
			}
		}

		if job != nil {
			res := db.Where("job_id = ?", job.JobId).Delete(job)
			if res.Error != nil {
				return xerrors.Errorf("Job delete error: %w", res.Error)
			}
		}
	}

	var job Job
	job.JobId = jobId
	job.ProjectId = pId
	job.WorkspaceId = wId
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

func SelectByJobId(jobId string) (*Job, error) {
	var job Job
	db.First(&job, "job_id = ?", jobId)
	if db.Error != nil {
		return nil, xerrors.Errorf("Select Job: %w", db.Error)
	}
	return &job, nil
}

func ComplateJob(jobId string, jobError error) error {

	job, err := SelectByJobId(jobId)
	if err != nil {
		return xerrors.Errorf("SelectByJobId() error: %w", err)
	}

	job.Complated = true
	job.Success = true
	if jobError != nil {
		job.Success = false
		job.Detail = fmt.Sprintf("%+v", jobError)
	}

	res := db.Save(job)
	if res.Error != nil {
		return xerrors.Errorf("Save Job: %w", res.Error)
	}

	return nil
}

func SelectJobs(pId string, wId int, pg *Paging) ([]*Job, error) {

	var cnt int64
	res := db.Model(&Job{}).Where("project_id = ? AND workspace_id = ?", pId, wId).Count(&cnt)
	fmt.Println(cnt)
	pg.Count = int(cnt)
	offset := (pg.Current - 1) * pg.Limit
	limit := pg.Limit

	var jobs []*Job
	res = db.Where("project_id = ? AND workspace_id = ?", pId, wId).Offset(offset).Limit(limit).Find(&jobs)
	if res.Error != nil {
		if errors.Is(res.Error, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, xerrors.Errorf("Jobs error: %w", res.Error)
	}
	return jobs, nil
}
