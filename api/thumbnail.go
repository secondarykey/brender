package api

import (
	"github.com/ikascrew/brender/exec"
	"github.com/ikascrew/brender/model"
)

func CreateThumbnailWorkspace(projectID string, file *model.ProjectFile) error {
	blenderPath, err := resolveBlenderPath(file.BlenderInstallID, 0)
	if err != nil {
		return err
	}

	st, err := exec.ResolveScene(blenderPath, file.Path, "")
	if err != nil {
		return err
	}

	mid := (st.Start + st.End) / 2
	name := file.Name + " Thumbnail"

	ws, err := model.CreateSystemWorkspace(projectID, file.ID, name, mid, mid)
	if err != nil {
		return err
	}

	_, err = Enqueue(projectID, ws.ID)
	return err
}
