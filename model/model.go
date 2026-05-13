package model

import (
	"time"

	"github.com/ikascrew/brender/log"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

var db *gorm.DB

// resolveOrder はソートキーを ORDER BY 句に変換する。
// "display_order" → display_order asc, created_at desc
// "processed_at"  → processed_at desc, created_at desc
// その他(デフォルト) → created_at desc
func resolveOrder(sort string) string {
	switch sort {
	case "display_order":
		return "display_order asc, created_at desc"
	case "processed_at":
		return "processed_at desc, created_at desc"
	default:
		return "created_at desc"
	}
}

type MetaFields struct {
	CreatedAt *time.Time     `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt *time.Time     `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"deleted_at"`
}

func Init(dsn string) error {

	conf := &gorm.Config{}
	conf.Logger = log.NewDBLogger()

	var err error
	db, err = gorm.Open(sqlite.Open(dsn), conf)
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
