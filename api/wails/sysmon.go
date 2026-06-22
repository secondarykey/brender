package wails

import (
	"github.com/ikascrew/brender/api"
	"github.com/ikascrew/brender/sysmon"
)

type SysMon struct{}

func NewSysMon() *SysMon { return &SysMon{} }

func (s *SysMon) Get() (sysmon.Stats, error) {
	return api.GetSystemStats(), nil
}
