package model

import (
	"database/sql"
	"path/filepath"
	"strings"
	"testing"

	_ "github.com/glebarez/go-sqlite"
)

// 表を作れなかったら Init はエラーを返す（以前は AutoMigrate のエラーを捨てて起動していた）。
func TestInitFailsWhenMigrationFails(t *testing.T) {
	dsn := filepath.Join(t.TempDir(), "test.db")

	// work_dirs という名前のビューを先に置くと、GORM は表が無いと見て CREATE TABLE し、名前がぶつかって失敗する
	raw, err := sql.Open("sqlite", dsn)
	if err != nil {
		t.Fatalf("sql.Open: %v", err)
	}
	if _, err := raw.Exec("CREATE VIEW work_dirs AS SELECT 1 AS id"); err != nil {
		raw.Close()
		t.Fatalf("CREATE VIEW: %v", err)
	}
	raw.Close()

	err = Init(dsn)
	// Windows では接続を閉じないと TempDir のクリーンアップが失敗する。
	t.Cleanup(func() { Close() })

	if err == nil {
		t.Fatal("Init() error = nil, want error")
	}
	if !strings.Contains(err.Error(), "WorkDir") {
		t.Errorf("Init() error = %q, want the model name WorkDir in it", err)
	}
}
