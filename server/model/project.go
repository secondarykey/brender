package model

import (
	"github.com/google/uuid"
	"gorm.io/gorm"
	"time"
)

type Project struct {
	ID        string `gorm:"primaryKey"`
	Name      string
	Thumbnail int
	CreatedAt time.Time `gorm:"autoCreateTime"`
	UpdatedAt time.Time `gorm:"autoUpdateTime"`
	DeletedAt gorm.DeletedAt
}

func (p *Project) SetID() {
	id, err := uuid.NewUUID()
	if err != nil {
		panic(err)
	}
	p.ID = id.String()
	return
}
