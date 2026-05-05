package exec

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/ikascrew/brender/model"
	"golang.org/x/xerrors"
)

func RunVersion(cmd string) (string, error) {

	log.Println(cmd)
	b := newBlender(cmd)
	var w strings.Builder

	b.Writer = &w
	b.ErrorWriter = &w

	_, errCh, err := b.run("-v")
	if err != nil {
		return "", xerrors.Errorf("blender command error: %w", err)
	}

	//wait
	err = <-errCh
	if err != nil {
		return "", xerrors.Errorf("blender running error: %w", err)
	}

	/*
	   	//fmt.Println(w.String())
	   | Blender 3.4.1
	   |       build date: 2022-12-20
	   |       build time: 01:51:19
	   |       build commit date: 2022-12-19
	   |       build commit time: 17:00
	   |       build hash: 55485cb379f7
	   |       build platform: Windows
	   |       build type: release
	   |       build c flags: /W3 /w34062 /w34115 /w34189 /w35038 /wd4018 /wd4146 /wd4065 /wd4127 /wd4181 /wd4200 /wd4244 /wd4267 /wd4305 /wd4800 /wd4828 /wd4996 /wd4661 /wd4848 /we4013 /we4133 /we4431 /we4033 /DWIN32 /D_WINDOWS /W3 /nologo /J /Gd /MP /bigobj /Zc:inline -openmp
	   |       build c++ flags: /W3 /w34062 /w34115 /w34189 /w35038 /wd4018 /wd4146 /wd4065 /wd4127 /wd4181 /wd4200 /wd4244 /wd4267 /wd4305 /wd4800 /wd4828 /wd4996 /wd4661 /wd4848 /we4013 /we4133 /we4431 /we4033 /DWIN32 /D_WINDOWS /W3  /EHsc /nologo /J /Gd /MP /EHsc /bigobj /Zc:inline /permissive- /Zc:twoPhase- -openmp /Zc:__cplusplus
	   |       build link flags: /MACHINE:X64  /SUBSYSTEM:CONSOLE /STACK:2097152 /ignore:4049 /ignore:4217 /ignore:4221
	   |       build system: CMake
	*/

	ver := parseVersion(&w)
	return ver, nil
}

func parseVersion(b *strings.Builder) string {

	r := strings.NewReader(b.String())
	s := bufio.NewScanner(r)
	for s.Scan() {
		line := s.Text()
		if strings.Index(line, "Blender") == 0 {
			sl := strings.Split(line, " ")
			if len(sl) == 2 {
				return sl[1]
			}
		}
	}

	return "-"
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

func CreateProjectThumbnail(pId string) error {

	env, err := model.GetEnv()
	if err != nil {
		return xerrors.Errorf("get environment error: %w", err)
	}

	b := newBlender(env.BlenderCmd)

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
	f := fmt.Sprintf("%d", p.Frame)

	jobId := ProjectThumbJobName
	jw, err := createJobWriter(p.ID, 0, jobId, 1, 1)
	if err != nil {
		return xerrors.Errorf("createJobWriter() error: %w", err)
	}

	b.Writer = jw
	b.ErrorWriter = jw

	bFile := GetBlenderFile(p)
	//target frame
	args := []string{"-b", bFile}
	if p.Scene != "" {
		args = append(args, "-S", p.Scene)
	}

	//logDir := getLogDir(p.ID)
	//logFile := filepath.Join(logDir, "test.log")
	//args = append(args, "--log", "*")
	//args = append(args, "--log-level", "-1")
	//args = append(args, "--log-file", logFile)

	args = append(args, "-o", target)
	args = append(args, "-F", "PNG", "-t", "0")
	args = append(args, "-f", f)

	processId, errCh, err := b.run(args...)
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

func CreateWorkspaceThumbnail(pId string, wId int) error {

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
	f := fmt.Sprintf("%d", w.Frame)

	b := newBlender(env.BlenderCmd)
	//ログファイルとロックファイルを準備
	jobId := fmt.Sprintf(WorkspaceThumbJobName, w.ID)
	jw, err := createJobWriter(pId, w.ID, jobId, 1, 1)
	if err != nil {
		return xerrors.Errorf("createJobWriter() error: %w", err)
	}
	b.Writer = jw
	b.ErrorWriter = jw

	bFile := GetBlenderFile(p)
	args := []string{"-b", bFile}
	if p.Scene != "" {
		args = append(args, "-S", w.Scene)
	}
	args = append(args, "-o", target, "-F", "PNG", "-t", "0")
	args = append(args, "-f", f)

	processId, errCh, err := b.run(args...)
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

func RunWorkspace(pId string, wId int) (string, error) {

	env, err := model.GetEnv()
	if err != nil {
		return "", xerrors.Errorf("environment error: %w", err)
	}

	b := newBlender(env.BlenderCmd)

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

	thread := fmt.Sprintf("%d", b.Thread)

	args := []string{"-b", b.File}
	if w.Scene != "" {
		args = append(args, "-S", w.Scene)
	}
	args = append(args, "-o", b.Result, "-F", "PNG", "-t", thread)

	//指定がある場合にフレームを設定
	if !(b.Start == 0 && b.End == 0) {
		start := fmt.Sprintf("%d", b.Start)
		end := fmt.Sprintf("%d", b.End)
		args = append(args, "-s", start, "-e", end)
	}

	args = append(args, "-a")

	fmt.Println(args)

	processId, errCh, err := b.run(args...)
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
