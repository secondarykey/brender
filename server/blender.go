package brender

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

func CreateProjectThumbnail(id string) error {
	//project search
	//target frame
	return nil
}

func CreateWorkspaceThumbnail(id string, wId int) error {
	//project search
	//target frame
	return nil
}

func RunWorkspace(pId string, wId int) (string, chan error) {

	b := newBlender()

	//TODO search workspace
	b.Start = 1
	b.End = 80
	b.File = filepath.Join(getContentDir(pId), "1685240894732623000.blend")

	resultDir := filepath.Join(getResultDir(pId, wId))
	b.Result = resultDir + "/"

	jobId := generateJobId()
	logDir := filepath.Join(getLogDir(pId, wId))

	logFp, err := os.Create(filepath.Join(logDir, jobId+".log"))
	if err != nil {
		panic(err)
	}

	fp, err := os.Create(filepath.Join(logDir, "processing.log"))
	if err != nil {
		panic(err)
	}

	//処理中のファイルがないかを確認
	processFp := newProcessingWriter(fp, b.Start, b.End)

	w := io.MultiWriter(logFp, processFp)
	b.Writer = w
	b.ErrorWriter = w

	start := fmt.Sprintf("%d", b.Start)
	end := fmt.Sprintf("%d", b.End)
	thread := fmt.Sprintf("%d", b.Thread)

	args := []string{"-noaudio", "-b", b.File, "-o", b.Result, "-t", thread, "-s", start, "-e", end, "-a"}
	return jobId, b.run(args)
}

func generateJobId() string {
	return time.Now().Format("20060102150405")
}

type Blender struct {
	Start  int
	End    int
	Thread int

	File   string
	Result string

	Writer      io.Writer
	ErrorWriter io.Writer
}

func newBlender() *Blender {
	var b Blender
	b.Start = 0
	b.End = 0
	b.Thread = 0
	b.Writer = os.Stdout
	b.ErrorWriter = os.Stdout
	return &b
}

func (b *Blender) run(args []string) chan error {

	ch := make(chan error)

	cmd := exec.Command(blenderCmd, args...)
	cmd.Stdout = b.Writer
	cmd.Stderr = b.ErrorWriter

	startErr := cmd.Start()

	go func() {
		var err error
		if startErr != nil {
			err = startErr
		} else {
			err = cmd.Wait()
		}
		ch <- err
	}()

	return ch
}
