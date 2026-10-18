package services

import (
	"github.com/google/uuid"
	"github.com/secondarykey/brender/api"
	"github.com/secondarykey/brender/code"
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
	return api.SaveImageFormats(api.WailsContext(), items)
}

func (s *Codes) SaveVideoFormats(items []code.VideoFormat) error {
	return api.SaveVideoFormats(api.WailsContext(), items)
}

func (s *Codes) SaveResolutionPresets(items []code.ResolutionPreset) error {
	return api.SaveResolutionPresets(api.WailsContext(), items)
}

func (s *Codes) GenerateID() (string, error) {
	id, err := uuid.NewV7()
	if err != nil {
		return "", err
	}
	return id.String(), nil
}

func (s *Codes) ResetImageFormats() error      { return api.ResetImageFormats(api.WailsContext()) }
func (s *Codes) ResetVideoFormats() error      { return api.ResetVideoFormats(api.WailsContext()) }
func (s *Codes) ResetResolutionPresets() error { return api.ResetResolutionPresets(api.WailsContext()) }
