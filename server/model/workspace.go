package model

import (
	"gorm.io/gorm"
)

type Workspace struct {
	gorm.Model
	Project    string
	Sampring   int
	Camera     string
	StartFrame int
	EndFrame   int
}
