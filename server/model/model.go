package model

import (
	"fmt"

	"golang.org/x/xerrors"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func Start() error {

	db, err := gorm.Open(sqlite.Open("../test.db"), &gorm.Config{})
	if err != nil {
		return xerrors.Errorf("DB Open error: %w", err)
	}

	db.AutoMigrate(&Runner{})
	db.AutoMigrate(&Project{})
	db.AutoMigrate(&Workspace{})
	db.AutoMigrate(&Job{})

	/*
		var run Runner
		run.Name = "Mac"
		run.Cmd = "/Applications/Blender.app/Contents/MacOS/Blender"

		db.Create(&run)
		if db.Error != nil {
			return xerrors.Errorf("Create Runner: %w", err)
		}
		fmt.Println(run)
	*/

	var p Project
	//db.First(&p, "36bb97e2-fd24-11ed-887e-1ebb8adcc540")
	db.First(&p, "id = ?", "36bb97e2-fd24-11ed-887e-1ebb8adcc540")
	if db.Error != nil {
		return xerrors.Errorf("Select Project: %w", err)
	}
	fmt.Println(p)

	/*
		var p Project

		p.SetID()
		p.Name = "Gopher"
		p.Thumbnail = 1

		db.Create(&p)
		if db.Error != nil {
			return xerrors.Errorf("Create Project: %w", err)
		}

		fmt.Println(p)
	*/
	/*
		var w Workspace
		w.Sampring = -1
		w.Camera = ""
		w.StartFrame = 1
		w.EndFrame = 80
		w.Project = "36bb97e2-fd24-11ed-887e-1ebb8adcc540"
		db.Create(&w)
		if db.Error != nil {
			return xerrors.Errorf("Create Workspace: %w", err)
		}
		fmt.Println(w)
	*/

	return nil
}
