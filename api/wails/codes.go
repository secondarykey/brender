package wails

import (
	"github.com/ikascrew/brender/code"
)

type Codes struct{}

func NewCodes() *Codes { return &Codes{} }

func (s *Codes) GetImageFormats() ([]code.ImageFormat, error) {
	return code.GetImageFormats()
}

func (s *Codes) GetVideoFormats() ([]code.VideoFormat, error) {
	return code.GetVideoFormats()
}

func (s *Codes) GetResolutionPresets() ([]code.ResolutionPreset, error) {
	return code.GetResolutionPresets()
}
