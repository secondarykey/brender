package exec

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/ikascrew/brender/core/model"
	"golang.org/x/xerrors"
)

/**
 * 文字列（-v 出力）からバージョンを抜き出す
 */
func parseVersion(b *strings.Builder) (string, error) {

	r := strings.NewReader(b.String())
	s := bufio.NewScanner(r)
	for s.Scan() {
		line := s.Text()
		if strings.Index(line, "Blender") == 0 {
			sl := strings.Split(line, " ")
			if len(sl) >= 2 {
				return sl[1], nil
			}
		}
	}
	return "-", nil
}

/**
 * Blender のエンジンリストを取得する
 */
func RunEngines(cmd string) ([]string, error) {

	b, err := NewBlender(cmd)
	if err != nil {
		return nil, xerrors.Errorf("NewBlender() error: %w", err)
	}

	var w strings.Builder
	b.Writer = &w
	b.ErrorWriter = &w

	err = b.Run("-E", "help", "-b")
	if err != nil {
		return nil, xerrors.Errorf("blender command error: %w", err)
	}

	return parseEngines(&w)
}

/**
 * 文字列（-E help -b 出力）からエンジンリストを抜き出す
 */
func parseEngines(b *strings.Builder) ([]string, error) {

	r := strings.NewReader(b.String())
	s := bufio.NewScanner(r)

	engines := make([]string, 0, 10)
	start := false
	for s.Scan() {
		line := s.Text()
		if strings.Index(line, "Blender Engine Listing:") == 0 {
			start = true
		} else if start {
			engines = append(engines, strings.Trim(line, " \t"))
		}
	}
	return engines, nil
}

func IsProjectThumbnailLock(pId string) bool {
	logDir := getLogDir(pId)
	lockFile := filepath.Join(logDir, ProjectThumbJobName+".lock")
	if _, err := os.Stat(lockFile); err == nil {
		return true
	}
	return false
}

func IsWorkspaceThumbnailLock(pId string, wId int) bool {
	logDir := getLogDir(pId)
	jobId := fmt.Sprintf(WorkspaceThumbJobName, wId)
	lockFile := filepath.Join(logDir, jobId+".lock")
	if _, err := os.Stat(lockFile); err == nil {
		return true
	}
	return false
}

func getWorkspaceRenderingFile(pId string, wId int) string {
	logDir := getLogDir(pId)
	reg := fmt.Sprintf(RenderingJobNameGlob, wId)

	files, err := filepath.Glob(filepath.Join(logDir, reg))
	if err != nil {
		return ""
	}

	if len(files) == 0 {
		return ""
	}
	if len(files) > 1 {
		log.Println("LockFile duplicate")
	}
	return files[0]
}

func IsWorkspaceRendering(pId string, wId int) bool {
	file := getWorkspaceRenderingFile(pId, wId)
	if file == "" {
		return false
	}
	return true
}

func GetRenderingTime(pId string, wId int) *RenderingTime {

	file := getWorkspaceRenderingFile(pId, wId)
	if file == "" {
		return nil
	}

	rt, err := createRenderingTime(file)
	if err != nil {
		return nil
	}
	return rt
}

func CreateProjectThumbnail(ctx context.Context, pId string) error {

	env, err := model.GetEnv()
	if err != nil {
		return xerrors.Errorf("get environment error: %w", err)
	}

	b, err := NewBlender(env.BlenderCmd)
	if err != nil {
		return xerrors.Errorf("NewBlender() error: %w", err)
	}

	p, err := model.SelectProject(pId)
	if err != nil {
		return xerrors.Errorf("SelectProject() error: %w", err)
	}

	dir := getThumbnailDir(p.ID)
	//サムネイルが存在するなら削除
	thumb := filepath.Join(dir, ProjectThumbnailFile)
	if _, err = os.Stat(thumb); err == nil {
		err = os.Remove(thumb)
		if err != nil {
			log.Println(err)
		}
	}

	//作業用のファイル名指定
	target := filepath.Join(dir, ProjectThumbWorkFile)

	jobId := ProjectThumbJobName
	jw, err := createJobWriter(p.ID, 0, jobId, 1, 1)
	if err != nil {
		return xerrors.Errorf("createJobWriter() error: %w", err)
	}

	b.Writer = jw
	b.ErrorWriter = jw

	b.File = GetBlenderFile(p)
	b.Scene = p.Scene

	//args = append(args, "--log", "*")
	//args = append(args, "--log-level", "-1")
	//args = append(args, "--log-file", logFile)

	b.Result = target
	b.SetFrame(p.Frame)

	processId, errCh, err := b.run(ctx)
	if err != nil {
		return xerrors.Errorf("Blender command error: %w", err)
	}

	err = model.CreateJob(jobId, p.ID, 0, processId)
	if err != nil {
		return xerrors.Errorf("model.CreateJon() error: %w", err)
	}

	go func() {
		//サムネイル作成処理
		err = complateJob(errCh, jw)
		if err != nil {
			log.Println("complateJob() error:", err)
		}
	}()

	return nil
}

func ArchiveProjectFiles(pId string) error {

	root, err := CreateProjectTree(pId, true)
	if err != nil {
		return xerrors.Errorf("exec.CreateProjectTree() error: %w", err)
	}

	dstDir := getContentDir(pId)
	err = copyProject(dstDir, root)
	if err != nil {
		return xerrors.Errorf("CopyBranch() error: %w", err)
	}

	err = model.SetProjectArchive(pId)
	if err != nil {
		return xerrors.Errorf("CreateProjectTree() error: %w", err)
	}
	return nil
}

func GetBlenderFile(p *model.Project) string {
	if p.Archive {
		base := filepath.Base(p.BlenderFile)
		dir := getContentDir(p.ID)
		return filepath.Join(dir, base)
	}
	return p.BlenderFile
}

func CreateWorkspaceThumbnail(ctx context.Context, pId string, wId int) error {

	//すべてのワークファイルを削除
	env, err := model.GetEnv()
	if err != nil {
		return xerrors.Errorf("get environment error: %w", err)
	}

	p, err := model.SelectProject(pId)
	if err != nil {
		return xerrors.Errorf("SelectProject() error: %w", err)
	}
	w, err := model.SelectWorkspace(pId, wId)
	if err != nil {
		return xerrors.Errorf("SelectWorkspace() error: %w", err)
	}

	//サムネイルが存在するなら削除
	thumb := GetWorkspaceThumbnailFileName(pId, w.ID)
	if _, err = os.Stat(thumb); err == nil {
		err = os.Remove(thumb)
		if err != nil {
			log.Println(err)
		}
	}

	//TODO ワークファイルを削除
	target := GetWorkspaceThumbnailPath(pId, w.ID, WorkspaceThumbWorkFile)

	b, err := NewBlender(env.BlenderCmd)
	if err != nil {
		return xerrors.Errorf("NewBlender() error: %w", err)
	}
	//ログファイルとロックファイルを準備
	jobId := fmt.Sprintf(WorkspaceThumbJobName, w.ID)
	jw, err := createJobWriter(pId, w.ID, jobId, 1, 1)
	if err != nil {
		return xerrors.Errorf("createJobWriter() error: %w", err)
	}

	b.Writer = jw
	b.ErrorWriter = jw
	b.Scene = w.Scene
	if b.Scene != "" {
		b.Scene = p.Scene
	}
	b.Result = target
	b.SetFrame(w.Frame)

	processId, errCh, err := b.run(ctx)
	if err != nil {
		return xerrors.Errorf("Blender command error: %w", err)
	}

	err = model.CreateJob(jobId, p.ID, w.ID, processId)
	if err != nil {
		return xerrors.Errorf("CreateJob() error: %w", err)
	}

	go func() {
		err = complateJob(errCh, jw)
		if err != nil {
			log.Println("complateJob() error:", err)
		}
	}()

	return nil
}

func RunWorkspace(ctx context.Context, pId string, wId int) (string, error) {

	env, err := model.GetEnv()
	if err != nil {
		return "", xerrors.Errorf("environment error: %w", err)
	}

	b, err := NewBlender(env.BlenderCmd)
	if err != nil {
		return "", xerrors.Errorf("NewBlender() error: %w", err)
	}
	//各種設定をDBから取得
	p, err := model.SelectProject(pId)
	if err != nil {
		return "", xerrors.Errorf("SelectProject() error: %w", err)
	}
	w, err := model.SelectWorkspace(pId, wId)
	if err != nil {
		return "", xerrors.Errorf("SelectWorkspace() error: %w", err)
	}

	b.Start = w.StartFrame
	b.End = w.EndFrame
	b.File = GetBlenderFile(p)

	resultDir := filepath.Join(getResultDir(pId, wId))
	b.Result = filepath.Join(resultDir, RenderResultFile)

	//JobID を発行
	dateId := generateDateId()
	jobId := fmt.Sprintf(RenderingJobName, dateId, wId)

	jw, err := createJobWriter(p.ID, w.ID, jobId, b.Start, b.End)
	if err != nil {
		return "", xerrors.Errorf("createJobWriter() error: %w", err)
	}

	b.Writer = jw
	b.ErrorWriter = jw
	b.Scene = w.Scene
	if b.Scene == "" {
		b.Scene = p.Scene
	}

	processId, errCh, err := b.run(ctx)
	if err != nil {
		return "", xerrors.Errorf("Blender command error: %w", err)
	}

	err = model.CreateJob(jobId, pId, wId, processId)
	if err != nil {
		return "", xerrors.Errorf("CreateJob() error: %w", err)
	}

	go func() {
		err = complateJob(errCh, jw)
		if err != nil {
			log.Println("complateJob() error:", err)
			return
		}
	}()

	return jobId, nil
}

func complateJob(errCh chan error, w *jobWriter) error {

	err := <-errCh
	if err != nil {
		return xerrors.Errorf("Command run error() error: %w", err)
	}

	if err == nil {
		pId, wId := w.GetThumbnailID()
		//サムネイルの変換処理を行う
		if pId != "" && wId > 0 {
			err = createWorkspaceThumbnail(pId, wId)
		} else if pId != "" {
			err = createProjectThumbnail(pId)
		}
	}

	if err == nil {
		err = w.Close()
		if err != nil {
			return xerrors.Errorf("CompalteJob() error: %w", err)
		}
	}

	err = model.ComplateJob(w.JobID, err)
	if err != nil {
		return xerrors.Errorf("CompalteJob() error: %w", err)
	}
	return nil
}

func generateDateId() string {
	return time.Now().Format("20060102150405")
}
