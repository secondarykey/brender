package api

import (
	"context"

	"github.com/secondarykey/brender/code"
)

// コード（選択肢リスト）の保存・初期化はシステム全体に効くため admin 限定。
// 読み出しは code パッケージを直接使ってよい。

func SaveImageFormats(ctx context.Context, items []code.ImageFormat) error {
	if err := requireAdmin(ctx); err != nil {
		return err
	}
	return code.SaveImageFormats(items)
}

func SaveVideoFormats(ctx context.Context, items []code.VideoFormat) error {
	if err := requireAdmin(ctx); err != nil {
		return err
	}
	return code.SaveVideoFormats(items)
}

func SaveResolutionPresets(ctx context.Context, items []code.ResolutionPreset) error {
	if err := requireAdmin(ctx); err != nil {
		return err
	}
	return code.SaveResolutionPresets(items)
}

func ResetImageFormats(ctx context.Context) error {
	if err := requireAdmin(ctx); err != nil {
		return err
	}
	return code.ResetImageFormats()
}

func ResetVideoFormats(ctx context.Context) error {
	if err := requireAdmin(ctx); err != nil {
		return err
	}
	return code.ResetVideoFormats()
}

func ResetResolutionPresets(ctx context.Context) error {
	if err := requireAdmin(ctx); err != nil {
		return err
	}
	return code.ResetResolutionPresets()
}
