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
	CreatedBy string         `json:"created_by"`
	UpdatedBy string         `json:"updated_by"`
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

	// CreatedBy / UpdatedBy を自動設定するコールバック
	db.Callback().Create().Before("gorm:create").Register("set_created_by", func(tx *gorm.DB) {
		user := CurrentUser()
		if tx.Statement.Schema == nil {
			return
		}
		if f := tx.Statement.Schema.LookUpField("CreatedBy"); f != nil {
			_ = f.Set(tx.Statement.Context, tx.Statement.ReflectValue, user)
		}
		if f := tx.Statement.Schema.LookUpField("UpdatedBy"); f != nil {
			_ = f.Set(tx.Statement.Context, tx.Statement.ReflectValue, user)
		}
	})
	db.Callback().Update().Before("gorm:update").Register("set_updated_by", func(tx *gorm.DB) {
		user := CurrentUser()
		if tx.Statement.Schema == nil {
			return
		}
		if f := tx.Statement.Schema.LookUpField("UpdatedBy"); f != nil {
			tx.Statement.SetColumn("UpdatedBy", user)
		}
	})

	db.AutoMigrate(&WorkDir{})
	db.AutoMigrate(&Environment{})
	db.AutoMigrate(&BlenderInstall{})
	db.AutoMigrate(&Project{})
	db.AutoMigrate(&ProjectFile{})
	db.AutoMigrate(&Workspace{})
	db.AutoMigrate(&Job{})
	db.AutoMigrate(&Queue{})
	db.AutoMigrate(&TagCategory{})
	db.AutoMigrate(&Tag{})
	db.AutoMigrate(&ProjectFileTag{})
	db.AutoMigrate(&User{})
	db.AutoMigrate(&Group{})
	db.AutoMigrate(&UserGroup{})
	db.AutoMigrate(&ProjectPermission{})
	db.AutoMigrate(&FilePermission{})

	db.Exec("DROP INDEX IF EXISTS idx_tags_name")
	db.Exec("DROP INDEX IF EXISTS uni_tags_name")

	// システムユーザ・グループの初期投入
	if err := SeedAuthData(); err != nil {
		return err
	}

	return nil
}

func Close() error {
	if db == nil {
		return nil
	}
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}
