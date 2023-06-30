package exec

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"golang.org/x/xerrors"
)

type jobWriter struct {
	projectId   string
	workspaceId int

	JobID string

	logFP  *os.File
	lockFP *ProcessingWriter

	lockFile string
}

func createJobWriter(pId string, wId int, jobId string, start, end int) (*jobWriter, error) {

	var err error

	var jw jobWriter
	jw.projectId = pId
	jw.workspaceId = wId
	jw.JobID = jobId

	logDir := filepath.Join(getLogDir(pId))

	jw.logFP, err = os.Create(filepath.Join(logDir, jobId+".log"))
	if err != nil {
		return nil, xerrors.Errorf("create log file error: %w", err)
	}

	jw.lockFile = filepath.Join(logDir, jobId+".lock")
	fp, err := os.Create(jw.lockFile)
	if err != nil {
		return nil, xerrors.Errorf("create processing lock file error: %w", err)
	}

	jw.lockFP = newProcessingWriter(fp, start, end)

	return &jw, nil
}

func (w *jobWriter) Write(b []byte) (int, error) {
	v, err := w.logFP.Write(b)
	v, err = w.lockFP.Write(b)
	return v, err
}

func (w *jobWriter) Close() error {
	w.logFP.Close()
	w.lockFP.Close()
	os.Remove(w.lockFile)
	return nil
}

func (w *jobWriter) GetThumbnailID() (string, int) {

	if strings.Index(w.lockFile, ProjectThumbPrefix) != -1 {
		return w.projectId, -1
	} else if strings.Index(w.lockFile, WorkspaceThumbPrefix) != -1 {
		return w.projectId, w.workspaceId
	}
	return "", -1
}

type ProcessingWriter struct {
	body       io.Writer
	status     int
	frame      int
	startFrame int
	endFrame   int
	sample     string
	samples    string
	buffer     strings.Builder
}

const (
	Error = "Error:"
	Warn  = "WARN"

	FrameFlag = "Fra:"
	Sample    = "Sample"
	Quit      = "Blender quit"
	Remain    = "Remaining"

	ProcessingTimeFormat = "2006-01-02 15:04:05.000Z0700"
)

func newProcessingWriter(body io.Writer, start, end int) *ProcessingWriter {
	var w ProcessingWriter
	w.body = body
	w.buffer.Grow(8192)
	w.status = 0
	w.frame = -1
	w.startFrame = start
	w.endFrame = end
	w.sample = "-1"
	w.samples = "-1"
	return &w
}

func (w *ProcessingWriter) Write(b []byte) (int, error) {
	err := w.write(b)
	if err != nil {
		return 0, err
	}
	return len(b), nil
}

func (w *ProcessingWriter) Close() error {
	if c, ok := w.body.(io.Closer); ok {
		return c.Close()
	}
	return nil
}

func (w *ProcessingWriter) write(b []byte) error {

	_, err := w.buffer.Write(b)
	if err != nil {
		return err
	}

	remain, err := w.writeBuffer()
	if err != nil {
		return err
	}

	//TODO 途中までの読み込みってあるのかな、、、
	w.buffer.Reset()
	w.buffer.WriteString(remain)

	return nil
}

func (w *ProcessingWriter) writeBuffer() (string, error) {

	buf := bytes.NewBufferString(w.buffer.String())
	scanner := bufio.NewScanner(buf)

	for scanner.Scan() {

		line := scanner.Text()
		idx := strings.Index(line, FrameFlag)
		if idx == 0 {
			w.status = 1
			f := 0
			s := ""

			f, s = w.parseLine(line[len(FrameFlag):])
			if s != "" {
				w.sample = s
			} else {
				//フレームが更新されている場合
				if f != w.frame {
					w.sample = "-1"
				}
			}
			w.frame = f
		}

		idx = strings.Index(line, Quit)
		if idx == 0 {
			w.status = 2
		}
	}

	frames := w.endFrame - w.startFrame + 1
	nowFrame := w.frame - w.startFrame + 1
	now := time.Now().Format(ProcessingTimeFormat)

	w.body.Write([]byte(fmt.Sprintf("%s,%d,%d,%d,%s,%s\n", now, w.status, nowFrame, frames, w.sample, w.samples)))

	return "", nil
}

func (w *ProcessingWriter) parseLine(line string) (int, string) {

	sample := ""

	csvS := strings.Split(line, "|")
	//frame parse
	first := csvS[0]
	fIdx := strings.Index(first, " ")
	if fIdx == -1 {
		return -1, sample
	}

	frame, err := strconv.Atoi(first[:fIdx])
	if err != nil {
		return -1, sample
	}

	//sample parse
	if len(csvS) < 5 {
		return frame, sample
	}

	//最終項目にSampleがある前提
	idx := len(csvS) - 1
	last := strings.Trim(csvS[idx], " ")

	sIdx := strings.Index(last, Sample)
	if sIdx == -1 {
		return frame, sample
	}

	samples := last[sIdx+len(Sample)+1:]

	s := strings.Split(samples, "/")
	if len(s) != 2 {
		return frame, sample
	}

	sample = s[0]
	w.samples = s[1]

	return frame, sample
}
