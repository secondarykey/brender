package exec

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
