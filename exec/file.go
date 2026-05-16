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

	RenderResultFile     = "########.png" // deprecated: use RenderResultPattern(ext)
	RenderResultFileGlob = "*.png"        // deprecated: use RenderResultGlob(ext)

	ThumbnailWidth  = 288
	ThumbnailHeight = 162
)

// RenderResultGlob returns a glob pattern for rendered frame files with the given extension.
func RenderResultGlob(ext string) string { return "*." + ext }

// RenderResultPattern returns the Blender output file pattern for the given extension.
func RenderResultPattern(ext string) string { return "########." + ext }
