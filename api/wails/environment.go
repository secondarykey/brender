package wails

import (
	"os"

	"github.com/ikascrew/brender/api"
	"github.com/ikascrew/brender/model"
)

type Environment struct{}

func NewEnvironment() *Environment {
	var env Environment
	return &env
}

func (s *Environment) Get() (*model.Environment, error) {
	return api.GetEnvironment()
}

func (s *Environment) SetRoot(root string) error {
	return api.SetProjectRoot(root)
}

// GetWorkDir returns the process working directory for use as a dialog default.
func (s *Environment) GetWorkDir() string {
	dir, err := os.Getwd()
	if err != nil {
		return ""
	}
	return dir
}
