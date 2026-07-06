package services

import (
	"github.com/google/uuid"
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

func (s *Codes) SaveImageFormats(items []code.ImageFormat) error {
	return code.SaveImageFormats(items)
}

func (s *Codes) SaveVideoFormats(items []code.VideoFormat) error {
	return code.SaveVideoFormats(items)
}

func (s *Codes) SaveResolutionPresets(items []code.ResolutionPreset) error {
	return code.SaveResolutionPresets(items)
}

func (s *Codes) GenerateID() (string, error) {
	id, err := uuid.NewV7()
	if err != nil {
		return "", err
	}
	return id.String(), nil
}

func (s *Codes) ResetImageFormats() error      { return code.ResetImageFormats() }
func (s *Codes) ResetVideoFormats() error      { return code.ResetVideoFormats() }
func (s *Codes) ResetResolutionPresets() error { return code.ResetResolutionPresets() }
