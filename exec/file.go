package exec

import (
	"archive/zip"
	"fmt"
	"image"
	"image/jpeg"
	"io"
	"log"
	"os"
	"path/filepath"

	"github.com/ikascrew/brender/model"
	"golang.org/x/xerrors"
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

func searchWorkspaceThumbnailWorkFile(id string, wId string) string {
	p := getThumbnailDir(id)
	files, err := filepath.Glob(filepath.Join(p, fmt.Sprintf(WorkspaceThumbWorkFileGlob, wId)))
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

func SearchResultFiles(id string, wId string, r bool) ([]string, int64) {
	dir := getResultDir(id, wId)
	files, err := filepath.Glob(filepath.Join(dir, RenderResultFileGlob))
	if err != nil {
		return nil, 0
	}
	if r {
		return files, 0
	}
	names := make([]string, len(files))
	var sz int64
	for idx, fn := range files {
		info, _ := os.Stat(fn)
		sz += info.Size()
		names[idx] = filepath.Base(fn)
	}
	return names, sz
}

func GetProjectThumbnailFileName(id string) string {
	p := getThumbnailDir(id)
	rtn := filepath.Join(p, ProjectThumbnailFile)
	return rtn
}

func GetWorkspaceThumbnailFileName(id string, wId string) string {
	return GetWorkspaceThumbnailPath(id, wId, WorkspaceThumbnailFile)
}

func GetResultFileName(id string, wId string, fn string) string {
	dir := getResultDir(id, wId)
	return filepath.Join(dir, fn)
}

func GetWorkspaceThumbnailPath(id string, wId string, base string) string {
	dir := getThumbnailDir(id)
	return filepath.Join(dir, fmt.Sprintf(base, wId))
}

func createImageFile(n string, img image.Image) error {
	fp, err := os.Create(n)
	if err != nil {
		return xerrors.Errorf("os.Create() error: %w", err)
	}
	defer fp.Close()

	err = jpeg.Encode(fp, img, &jpeg.Options{Quality: 80})
	if err != nil {
		return xerrors.Errorf("jpeg.Encode() error: %w", err)
	}
	return nil
}

func getWorkspaceDir(id string, wId string) string {
	rtn := filepath.Join(getProjectDir(id), "workspace", wId)
	os.MkdirAll(rtn, 0666)
	return rtn
}

func getResultDir(id string, wId string) string {
	rtn := filepath.Join(getWorkspaceDir(id, wId), "result")
	os.MkdirAll(rtn, 0666)
	return rtn
}

func RemoveLockFiles() error {
	env := getEnv()
	if env == nil {
		return nil
	}
	ptn := filepath.Join(env.ProjectRoot, "*", "logs", "*.lock")
	files, err := filepath.Glob(ptn)
	if err != nil {
		return xerrors.Errorf("lock file glob error: %w", err)
	}
	if len(files) != 0 {
		log.Println("Remove lock file")
	}
	for _, file := range files {
		log.Println(file)
		os.Remove(file)
	}
	return nil
}

func createProjectThumbnail(id string) error {
	fn := searchProjectThumbnailWorkFile(id)
	if fn == "" {
		return fmt.Errorf("work file not found rror")
	}
	n := GetProjectThumbnailFileName(id)
	err := createThumbnailFile(n, fn)
	if err != nil {
		return xerrors.Errorf("createThumbnailFile() error: %w", err)
	}
	return nil
}

func createWorkspaceThumbnail(id string, wId string) error {
	fn := searchWorkspaceThumbnailWorkFile(id, wId)
	if fn == "" {
		return fmt.Errorf("work file not found rror")
	}
	n := GetWorkspaceThumbnailFileName(id, wId)
	err := createThumbnailFile(n, fn)
	if err != nil {
		return xerrors.Errorf("createThumbnailFile() error: %w", err)
	}
	return nil
}

// 元ファイルを削除するので注意
func createThumbnailFile(dst, src string) error {
	img, err := CreateAroundImage(src, ThumbnailWidth, ThumbnailHeight)
	if err != nil {
		return xerrors.Errorf("parseJSONBody() error: %w", err)
	}
	err = createImageFile(dst, img)
	if err != nil {
		return xerrors.Errorf("CreateThumbnail() error: %w", err)
	}
	err = os.Remove(src)
	if err != nil {
		log.Println(err)
	}
	return nil
}

func WriteResultZIP(w io.Writer, pId string, wId string) error {
	files, _ := SearchResultFiles(pId, wId, true)
	if files == nil {
		return fmt.Errorf("ResultFiles NotFound")
	}
	zw := zip.NewWriter(w)
	for _, fn := range files {
		err := writeZIP(zw, fn)
		if err != nil {
			return xerrors.Errorf("zip.NewWriter() error: %w", err)
		}
		zw.Flush()
	}
	err := zw.Close()
	if err != nil {
		return xerrors.Errorf("zip.NewWriter() error: %w", err)
	}
	return nil
}

func writeZIP(w *zip.Writer, fn string) error {
	n := filepath.Base(fn)
	f, err := w.Create(n)
	if err != nil {
		return xerrors.Errorf("Create() error: %w", err)
	}
	fp, err := os.Open(fn)
	if err != nil {
		return xerrors.Errorf("os.Open() error: %w", err)
	}
	defer fp.Close()
	_, err = io.Copy(f, fp)
	if err != nil {
		return xerrors.Errorf("io.Copy() error: %w", err)
	}
	return nil
}

type Branch struct {
	ID       string    `json:"value"`
	Name     string    `json:"label"`
	Size     int64     `json:"size"`
	Children []*Branch `json:"children"`
}

func (b *Branch) AddChild(child *Branch) {
	b.Children = append(b.Children, child)
}

func CreateProjectTree(pId string, abs bool) (*Branch, error) {
	p, err := model.SelectProject(pId)
	if err != nil {
		return nil, xerrors.Errorf("model.SelectProject() error: %w", err)
	}
	var b Branch
	b.ID = ""
	b.Name = pId
	rootDir := filepath.Dir(GetBlenderFile(p))
	err = searchProjectTree(&b, rootDir)
	if err != nil {
		return nil, xerrors.Errorf("searchProjectTree() error: %w", err)
	}
	if abs {
		b.ID = rootDir
	} else {
		b.ID = "root"
	}
	return &b, nil
}

func copyProject(dst string, tree *Branch) error {
	p := tree.ID
	for _, b := range tree.Children {
		err := copyBranch(dst, p, b)
		if err != nil {
			return xerrors.Errorf("copyBranch() error: %w", err)
		}
	}
	return nil
}

func copyBranch(dst string, root string, tree *Branch) error {
	children := tree.Children
	id := tree.ID
	p := filepath.Join(root, id)
	out := filepath.Join(dst, id)
	if len(children) == 0 {
		err := copyFile(out, p)
		if err != nil {
			return xerrors.Errorf("copyFile() error: %w", err)
		}
	} else {
		os.Mkdir(out, 0666)
		for _, b := range children {
			err := copyBranch(dst, root, b)
			if err != nil {
				return xerrors.Errorf("copyBranch() error: %w", err)
			}
		}
	}
	return nil
}

func copyFile(dst string, src string) error {
	fp, err := os.Open(src)
	if err != nil {
		return xerrors.Errorf("os.Open() error: %w", err)
	}
	defer fp.Close()
	op, err := os.Create(dst)
	if err != nil {
		return xerrors.Errorf("os.Create() error: %w", err)
	}
	defer op.Close()
	_, err = io.Copy(op, fp)
	if err != nil {
		return xerrors.Errorf("io.Copy() error: %w", err)
	}
	return nil
}

func searchProjectTree(parent *Branch, dir string) error {
	infos, err := os.ReadDir(dir)
	if err != nil {
		return xerrors.Errorf("os.ReadDir() error: %w", err)
	}
	for _, info := range infos {
		var b Branch
		n := info.Name()
		b.ID = parent.ID + "/" + n
		b.Name = n
		i, err := info.Info()
		if err != nil {
			log.Println(err)
		} else {
			b.Size = i.Size()
		}
		if info.IsDir() {
			p := filepath.Join(dir, n)
			err = searchProjectTree(&b, p)
			if err != nil {
				return xerrors.Errorf("searchProjectTree(rec) error: %w", err)
			}
		}
		parent.AddChild(&b)
	}
	var s int64
	for _, child := range parent.Children {
		s += child.Size
	}
	parent.Size += s
	return nil
}

func writeProjectArchive(w io.Writer, id string) error {
	return nil
}
