package services

import (
	"context"
	"github.com/secondarykey/brender/api"
	"github.com/secondarykey/brender/sysmon"
)

type SysMon struct{}

func NewSysMon() *SysMon { return &SysMon{} }

func (s *SysMon) Get(ctx context.Context) (sysmon.Stats, error) {
	return api.GetSystemStats(), nil
}

// Keep はシステムモニタを動かし続ける（表示しているあいだ、TTL より短い間隔で呼ぶ）。
// すでに動いていたときは直近の値、動かし始めたときは nil を返す。
func (s *SysMon) Keep(ctx context.Context) (*sysmon.Stats, error) {
	return api.KeepSystemMonitor(), nil
}
