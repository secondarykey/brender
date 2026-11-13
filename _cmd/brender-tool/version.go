package main

import (
	"runtime/debug"
)

// version はリリースのビルドで -ldflags "-X main.version=X.Y.Z" から入る
// （版の正は _cmd/brender/version だが、別のモジュールなので go:embed では読めない）。
var version string

// appVersion は -version とログに出す版。-X で渡されていなければ dev とし、
// go build が埋め込んだ git のコミットが分かればそれを付ける（例: dev (1a2b3c4, modified)）。
func appVersion() string {
	if version != "" {
		return version
	}
	info, ok := debug.ReadBuildInfo()
	if !ok {
		return "dev"
	}
	return devVersion(info.Settings)
}

func devVersion(settings []debug.BuildSetting) string {
	var rev string
	var modified bool
	for _, s := range settings {
		switch s.Key {
		case "vcs.revision":
			rev = s.Value
		case "vcs.modified":
			modified = s.Value == "true"
		}
	}
	if rev == "" {
		return "dev"
	}
	if len(rev) > 7 {
		rev = rev[:7]
	}
	if modified {
		return "dev (" + rev + ", modified)"
	}
	return "dev (" + rev + ")"
}
