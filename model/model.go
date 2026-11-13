package model

import (
	"strings"
	"time"

	"github.com/secondarykey/brender/log"

	"github.com/glebarez/sqlite"
	"golang.org/x/xerrors"
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

	// WAL + busy_timeout でサーバモードの同時アクセス時の "database is locked" を避ける。
	// glebarez ドライバは接続ごとに DSN の _pragma を適用する（busy_timeout は既定 5000ms）。
	// journal_mode=WAL は読み取りと書き込みの同時実行を可能にする。
	sep := "?"
	if strings.Contains(dsn, "?") {
		sep = "&"
	}
	connDSN := dsn + sep + "_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=synchronous(NORMAL)"

	var err error
	db, err = gorm.Open(sqlite.Open(connDSN), conf)
	if err != nil {
		return err
	}

	// CreatedBy / UpdatedBy を自動設定するコールバック。
	// クエリに紐付いた context のユーザを優先し、なければ goroutine-local にフォールバックする。
	db.Callback().Create().Before("gorm:create").Register("set_created_by", func(tx *gorm.DB) {
		user := auditUser(tx.Statement.Context)
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
		user := auditUser(tx.Statement.Context)
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
	db.AutoMigrate(&FileFavorite{})
	db.AutoMigrate(&User{})
	db.AutoMigrate(&Group{})
	db.AutoMigrate(&UserGroup{})
	db.AutoMigrate(&ProjectPermission{})
	db.AutoMigrate(&FilePermission{})
	db.AutoMigrate(&PasswordResetToken{})
	db.AutoMigrate(&Session{})

	// 失敗しても起動は止めない（次の起動でやり直す）
	if err := migrateSystemWorkspaces(); err != nil {
		log.Error("migrateSystemWorkspaces", "error", err)
	}

	db.Exec("DROP INDEX IF EXISTS idx_tags_name")
	db.Exec("DROP INDEX IF EXISTS uni_tags_name")

	// システムユーザ・グループの初期投入
	if err := SeedAuthData(); err != nil {
		return err
	}

	return nil
}

// migrateSystemWorkspaces は、サムネイル用に隠していたワークスペース（is_system=1）を
// 普通のワークスペースに戻し、is_system 列を消す。
// 隠していた頃のサムネイルのジョブは test として作られていたので thumbnail に直す
// （ファイルのサムネイルは thumbnail のジョブから探すため）。列が無ければ何もしない。
func migrateSystemWorkspaces() error {
	if !db.Migrator().HasColumn(&Workspace{}, "is_system") {
		return nil
	}
	if res := db.Exec(`UPDATE jobs SET job_type = ?
		WHERE job_type = ? AND workspace_id IN (SELECT id FROM workspaces WHERE is_system = 1)`,
		JobTypeThumbnail, JobTypeTest); res.Error != nil {
		return xerrors.Errorf("migrateSystemWorkspaces jobs: %w", res.Error)
	}
	if res := db.Exec("ALTER TABLE workspaces DROP COLUMN is_system"); res.Error != nil {
		return xerrors.Errorf("migrateSystemWorkspaces drop column: %w", res.Error)
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
