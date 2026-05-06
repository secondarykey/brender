package model

import (
	"errors"

	"golang.org/x/xerrors"
	"gorm.io/gorm"
)

type Environment struct {
	ID             uint   `gorm:"primaryKey" json:"id"`
	BlenderCmd     string `json:"command"`
	ProjectRoot    string `json:"root"`
	Server         bool   `json:"server"`
	BlenderVersion string `json:"version"`
	Hash           string `json:"hash"`
	MetaFields
}

func GetEnv() (*Environment, error) {
	env := Environment{}
	//環境値は絶対１件
	res := db.First(&env)
	if errors.Is(res.Error, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &env, nil
}

func SetEnvironment(e *Environment) error {

	env := Environment{}
	//環境値は絶対１件
	res := db.First(&env)
	if !errors.Is(res.Error, gorm.ErrRecordNotFound) {
		e.ID = env.ID
		res = db.Save(&e)
	} else {
		res = db.Create(&e)
	}

	if res.Error != nil {
		return xerrors.Errorf("Enviroment save() error: %w", res.Error)
	}

	return nil
}
