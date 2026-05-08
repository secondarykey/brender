package api

import (
	"os"

	"github.com/ikascrew/brender/model"
	"golang.org/x/xerrors"
)

func GetEnvironment() (*model.Environment, error) {
	return model.GetEnv()
}

func SetProjectRoot(root string) error {
	if _, err := os.Stat(root); err != nil {
		return xerrors.Errorf("directory not found: %s", root)
	}

	env, err := model.GetEnv()
	if err != nil {
		return xerrors.Errorf("GetEnv error: %w", err)
	}
	if env == nil {
		env = &model.Environment{}
	}
	env.ProjectRoot = root
	return model.SetEnvironment(env)
}
