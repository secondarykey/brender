package model

import (
	"errors"

	"golang.org/x/xerrors"
	"gorm.io/gorm"
)

type Environment struct {
	ID     uint `gorm:"primaryKey" json:"id"`
	Server bool `json:"server"`
	OutputFormat       string `json:"output_format"`        // レンダリング出力フォーマット（"PNG" / "JPEG"）。空なら "PNG"
	FfmpegCmd          string `json:"ffmpeg_cmd"`
	FfmpegFPS          int    `json:"ffmpeg_fps"`
	FfmpegOutExt       string `json:"ffmpeg_out_ext"`
	FfmpegArgs         string `json:"ffmpeg_args"`
	MaxConcurrentJobs  int    `gorm:"default:1" json:"max_concurrent_jobs"`
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
