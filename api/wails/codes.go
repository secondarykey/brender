package wails

import (
	"github.com/ikascrew/brender/codes"
)

type Codes struct{}

func NewCodes() *Codes { return &Codes{} }

func (s *Codes) GetImageFormats() ([]codes.ImageFormat, error) {
	return codes.GetImageFormats()
}

func (s *Codes) GetVideoFormats() ([]codes.VideoFormat, error) {
	return codes.GetVideoFormats()
}

func (s *Codes) GetResolutionPresets() ([]codes.ResolutionPreset, error) {
	return codes.GetResolutionPresets()
}
