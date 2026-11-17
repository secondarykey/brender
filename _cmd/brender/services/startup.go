package services

import (
	"crypto/sha256"
	"encoding/hex"
	"path/filepath"
	"runtime"
	"strings"
)

// 起動のしかたの決まり（main.go が使う。main パッケージはテストが動かないので、ここに置く）

// BackgroundArg は「ウィンドウを出さずに起動する」引数（サーバモードでブラウザから使うとき）。
// ウィンドウを出すには、もう一度 brender を起動する（動いている方がウィンドウを出す）。
const BackgroundArg = "--background"

// HasBackgroundArg は起動の引数に BackgroundArg（-background も可）があるかを返す。
func HasBackgroundArg(args []string) bool {
	for _, a := range args {
		if a == BackgroundArg || a == "-background" {
			return true
		}
	}
	return false
}

// InstanceID は二重起動を見分ける ID。同じ DB を使うアプリは1つだけにする
// （2つ目が起動時のリカバリで、1つ目が実行中のレンダリングを止めてしまう。スケジューラも2つになる）。
// DB が違えば並べて動かせる。Windows・macOS はパスの大文字小文字を区別しないので揃える。
func InstanceID(dbPath string) string {
	return instanceID(dbPath, runtime.GOOS)
}

func instanceID(dbPath, goos string) string {
	p, err := filepath.Abs(dbPath)
	if err != nil {
		p = dbPath
	}
	p = filepath.Clean(p)
	if goos != "linux" {
		p = strings.ToLower(p)
	}
	sum := sha256.Sum256([]byte(p))
	return "brender-" + hex.EncodeToString(sum[:8])
}
