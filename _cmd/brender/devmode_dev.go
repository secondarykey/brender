//go:build !production

package main

// isDev は wails3 dev・go run で動かしているか（-tags production が付いていない）。
// ログを組む（log.Init）のは application.New より前なので、app.Env.Info().Debug ではなくビルドタグで見分ける。
const isDev = true
