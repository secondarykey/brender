package model

import (
	"time"

	"github.com/ikascrew/brender/log"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

var db *gorm.DB

// resolveOrder はソートキーと方向を ORDER BY 句に変換する。
// dir が "asc" / "desc" 以外の場合はキーごとのデフォルト方向を使う。
func resolveOrder(sort, dir string) string {
	d := dir
	if d != "asc" && d != "desc" {
		d = ""
	}
	switch sort {
	case "display_order":
		if d == "" {
			d = "asc"
		}
		return "display_order " + d + ", created_at desc"
	case "processed_at":
		if d == "" {
			d = "desc"
		}
		return "processed_at " + d + ", created_at desc"
	case "name":
		if d == "" {
			d = "asc"
		}
		return "name " + d
	default: // created_at
		if d == "" {
			d = "desc"
		}
		return "created_at " + d
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

	db.AutoMigrate(&WorkDir{})
	db.AutoMigrate(&Environment{})
	db.AutoMigrate(&BlenderInstall{})
	db.AutoMigrate(&Project{})
	db.AutoMigrate(&ProjectFile{})
	db.AutoMigrate(&Workspace{})
	db.AutoMigrate(&Job{})
	db.AutoMigrate(&Queue{})

	return nil
}
