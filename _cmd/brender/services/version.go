package services

import (
	"fmt"
	"strconv"
	"strings"
)

// RunVersion は画面とログに出す版。dev 実行では version ファイルの版のパッチを 1 つ上げる
// （version ファイルは出した版を指していて、dev で動かしているのはその次の版の作業中のため。
// 画面は dev のとき後ろに +DEV を付ける）。X.Y.Z の形でなければそのまま返す。
func RunVersion(raw string, dev bool) string {
	v := strings.TrimSpace(raw)
	if !dev {
		return v
	}
	parts := strings.Split(v, ".")
	if len(parts) != 3 {
		return v
	}
	patch, err := strconv.Atoi(parts[2])
	if err != nil || patch < 0 {
		return v
	}
	return fmt.Sprintf("%s.%s.%d", parts[0], parts[1], patch+1)
}
