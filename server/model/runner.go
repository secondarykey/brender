package model

import (
	"gorm.io/gorm"
)

type Runner struct {
	gorm.Model
	Name    string
	LocalId string
	Cmd     string
}
