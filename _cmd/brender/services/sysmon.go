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
