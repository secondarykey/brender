package exec

import (
	"log"
	"os"
	"path/filepath"

	"github.com/ikascrew/brender/model"
)

var env *model.Environment

func init() {
}

const (
	ProjectThumbPrefix       = "project_thumb"
	ProjectThumbJobName      = ProjectThumbPrefix
	ProjectThumbWorkFile     = ProjectThumbPrefix + "_########.png"
	ProjectThumbWorkFileGlob = ProjectThumbPrefix + "_*png"
	ProjectThumbnailFile     = ProjectThumbPrefix + ".jpg"

	WorkspaceThumbPrefix       = "workspace_thumb"
	WorkspaceThumbJobName      = WorkspaceThumbPrefix + "_%s"
	WorkspaceThumbWorkFile     = WorkspaceThumbPrefix + "_%s_########.png"
	WorkspaceThumbWorkFileGlob = WorkspaceThumbPrefix + "_%s_*.png"
	WorkspaceThumbnailFile     = WorkspaceThumbPrefix + "_%s.jpg"

	RenderingJobName     = "%s_%s"
	RenderingJobNameGlob = "*_%s.lock"

	RenderResultFile     = "########.png"
	RenderResultFileGlob = "*.png"

	ThumbnailWidth  = 288
	ThumbnailHeight = 162
)

func getEnv() *model.Environment {
	var err error
	if env == nil {
		env, err = model.GetEnv()
		if err != nil {
			log.Println(err)
			return nil
		}
	}
	return env
}

func getProjectDir(id string) string {
	getEnv()
	rtn := filepath.Join(env.ProjectRoot, id)
	os.MkdirAll(rtn, 0666)
	return rtn
}

func getContentDir(id string) string {
	rtn := filepath.Join(getProjectDir(id), "content")
	os.MkdirAll(rtn, 0666)
	return rtn
}

func getLogDir(id string) string {
	rtn := filepath.Join(getProjectDir(id), "logs")
	os.MkdirAll(rtn, 0666)
	return rtn
}

func getThumbnailDir(id string) string {
	rtn := filepath.Join(getProjectDir(id), "thumbnail")
	os.MkdirAll(rtn, 0666)
	return rtn
}

func searchProjectThumbnailWorkFile(id string) string {
	p := getThumbnailDir(id)
	files, err := filepath.Glob(filepath.Join(p, ProjectThumbWorkFileGlob))
	if err != nil {
		log.Println(err)
		return ""
	}
	if len(files) <= 0 {
		log.Println("thumbnail work file not found.")
		return ""
	}
	if len(files) > 1 {
		log.Println("thumbnail work file to many")
	}
	return files[0]
}
