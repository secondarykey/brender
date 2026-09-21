package services

import (
	"github.com/secondarykey/brender/api"
	"github.com/secondarykey/brender/sysmon"
)

type SysMon struct{}

func NewSysMon() *SysMon { return &SysMon{} }

func (s *SysMon) Get() (sysmon.Stats, error) {
	return api.GetSystemStats(), nil
}
