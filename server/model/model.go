package model

import (
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var db *gorm.DB

type MetaFields struct {
	CreatedAt *time.Time     `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt *time.Time     `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"deleted_at"`
}

func init() {

	var err error
	db, err = gorm.Open(sqlite.Open("../test3.db"), &gorm.Config{})
	if err != nil {
		panic(err)
	}

	db.AutoMigrate(&Environment{})
	db.AutoMigrate(&Project{})
	db.AutoMigrate(&Workspace{})
	db.AutoMigrate(&Job{})
	return
}
