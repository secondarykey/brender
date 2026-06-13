// Package config は DB を読む前に必要な起動設定を ~/.brender/brender.ini から読む。
//
// log.Init() は initDB() より前に呼ばれるため、ログ出力先のような「DB より早く
// 確定したい設定」を Environment（DB）には置けない。brender.ini はその受け皿で、
// プロセス起動時に1回だけ読まれる（変更は再起動で反映）。デスクトップ・サーバ両
// モード共通。ファイルが無い・壊れている場合は空の Config を返し、各呼び出し側の
// デフォルト動作にフォールバックする。
//
// 形式は INI 風の最小仕様（フラットな key = value）:
//
//	# コメントは # または ;
//	log_dir = D:\brender\logs
//	db_path = D:\brender\brender.db
package config

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

const fileName = "brender.ini"

type Config struct {
	LogDir string // ログ出力ディレクトリ。空なら log パッケージのデフォルト。
	DBPath string // SQLite DB のパス。空なら呼び出し側のデフォルト。
}

var (
	once   sync.Once
	cached Config
)

// Dir は設定ファイルおよびデフォルト DB を置く基準ディレクトリ（~/.brender）を返す。
func Dir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".brender"), nil
}

// Get は brender.ini を読み込んで返す（プロセス内で1回だけ読む）。
func Get() Config {
	once.Do(func() {
		cached = load()
	})
	return cached
}

func load() Config {
	var c Config
	dir, err := Dir()
	if err != nil {
		return c
	}
	f, err := os.Open(filepath.Join(dir, fileName))
	if err != nil {
		return c // 無ければデフォルト動作
	}
	defer f.Close()

	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, ";") || strings.HasPrefix(line, "[") {
			continue
		}
		key, val, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		val = strings.Trim(strings.TrimSpace(val), `"`)
		switch key {
		case "log_dir":
			c.LogDir = val
		case "db_path":
			c.DBPath = val
		}
	}
	return c
}
