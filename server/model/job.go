package model

import (
	"gorm.io/gorm"
)

type Job struct {
	gorm.Model
	JobId string
}
