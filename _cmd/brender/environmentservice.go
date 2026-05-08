package main

import (
	"os"

	"github.com/ikascrew/brender/api"
	"github.com/ikascrew/brender/model"
)

type EnvironmentService struct{}

func (s *EnvironmentService) Get() (*model.Environment, error) {
	return api.GetEnvironment()
}

func (s *EnvironmentService) SetRoot(root string) error {
	return api.SetProjectRoot(root)
}

// GetWorkDir returns the process working directory for use as a dialog default.
func (s *EnvironmentService) GetWorkDir() string {
	dir, err := os.Getwd()
	if err != nil {
		return ""
	}
	return dir
}
