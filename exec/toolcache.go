package exec

import (
	"os"
	"sync"
	"time"
)

// Tool 解析結果（RunTool の出力）のインメモリキャッシュ。
// .blend ファイルの Blender 起動は数秒かかるため、同一ファイルの再解析を避ける。
// キーは cmd + filePath、有効性はファイルの更新時刻で判定する。
// ファイルが編集されれば mtime が変わり自動的にキャッシュミスになる。

type toolCacheEntry struct {
	mtime time.Time
	tool  Tool
}

var (
	toolCacheMu sync.Mutex
	toolCache   = map[string]toolCacheEntry{}
)

func toolCacheKey(cmd, filePath string) string {
	return cmd + "\x00" + filePath
}

// cachedTool は cmd+filePath の解析結果を返す。
// filePath が空、stat 失敗、mtime 不一致のときは ok=false。
func cachedTool(cmd, filePath string) (Tool, bool) {
	if filePath == "" {
		return Tool{}, false
	}
	info, err := os.Stat(filePath)
	if err != nil {
		return Tool{}, false
	}
	toolCacheMu.Lock()
	defer toolCacheMu.Unlock()
	e, ok := toolCache[toolCacheKey(cmd, filePath)]
	if ok && e.mtime.Equal(info.ModTime()) {
		return e.tool, true
	}
	return Tool{}, false
}

// storeTool は解析結果をファイルの現在の mtime とともに保存する。
func storeTool(cmd, filePath string, tool Tool) {
	if filePath == "" {
		return
	}
	info, err := os.Stat(filePath)
	if err != nil {
		return
	}
	toolCacheMu.Lock()
	toolCache[toolCacheKey(cmd, filePath)] = toolCacheEntry{mtime: info.ModTime(), tool: tool}
	toolCacheMu.Unlock()
}

// InvalidateToolCache は指定ファイルのキャッシュを破棄する（明示的な再解析が必要な場合用）。
// cmd が空なら filePath に一致する全 cmd のエントリを破棄する。
func InvalidateToolCache(cmd, filePath string) {
	toolCacheMu.Lock()
	defer toolCacheMu.Unlock()
	if cmd != "" {
		delete(toolCache, toolCacheKey(cmd, filePath))
		return
	}
	suffix := "\x00" + filePath
	for k := range toolCache {
		if len(k) >= len(suffix) && k[len(k)-len(suffix):] == suffix {
			delete(toolCache, k)
		}
	}
}
