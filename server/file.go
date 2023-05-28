package brender

import (
	"fmt"
	"path/filepath"
)

var blenderCmd = "/Applications/Blender.app/Contents/MacOS/Blender"
var projectDir = "/Users/secondarykey/GoApp/ikascrew/brender/projects"

func getProjectDir(id string) string {
	return filepath.Join(projectDir, id)
}

func getContentDir(id string) string {
	return filepath.Join(getProjectDir(id), "content")
}

func getThumbnailDir(id string) string {
	return filepath.Join(getProjectDir(id), "thumbnail")
}

func getWorkspaceDir(id string, wId int) string {
	workspace := fmt.Sprintf("%d", wId)
	return filepath.Join(getProjectDir(id), "workspace", workspace)
}

func getResultDir(id string, wId int) string {
	return filepath.Join(getWorkspaceDir(id, wId), "result")
}

func getLogDir(id string, wId int) string {
	return filepath.Join(getWorkspaceDir(id, wId), "logs")
}
