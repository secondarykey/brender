package model

import (
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

var db *gorm.DB

type MetaFields struct {
	CreatedAt *time.Time     `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt *time.Time     `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"deleted_at"`
}

func Init(dsn string) error {
	var err error
	db, err = gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		return err
	}

	db.AutoMigrate(&Environment{})
	db.AutoMigrate(&BlenderInstall{})
	db.AutoMigrate(&Project{})
	db.AutoMigrate(&ProjectFile{})
	db.AutoMigrate(&Workspace{})
	db.AutoMigrate(&Job{})
	db.AutoMigrate(&Queue{})

	return nil
}
