//go:build production

package main

// isDev は wails3 dev・go run で動かしているか。wails3 build（-tags production）では false。
const isDev = false
