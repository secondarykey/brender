package exec

import (
	"bufio"
	"bytes"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
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

	//TODO 中間処理用のWriterを渡していた
	_, err = os.Create(jw.lockFile)
	if err != nil {
		return nil, xerrors.Errorf("create processing lock file error: %w", err)
	}
	jw.lockFP = newProcessingWriter(start, end)

	return &jw, nil
}

func (w *jobWriter) Write(b []byte) (int, error) {
	v, err := w.logFP.Write(b)
	if err != nil {
		return v, xerrors.Errorf("logFP write error: %w", err)
	}
	v, err = w.lockFP.Write(b)
	if err != nil {
		return v, xerrors.Errorf("lockFP write error: %w", err)
	}
	return v, nil
}

func (w *jobWriter) Close() error {
	w.logFP.Close()
	w.lockFP.Close()
	os.Remove(w.lockFile)
	return nil
}

func (w *jobWriter) GetThumbnailID() (string, int) {

	if strings.Contains(w.lockFile, ProjectThumbPrefix) {
		return w.projectId, -1
	} else if strings.Contains(w.lockFile, WorkspaceThumbPrefix) {
		return w.projectId, w.workspaceId
	}
	return "", -1
}

// ProcessingResult はBlenderレンダリング処理の状態スナップショットです。
// JSON出力やコマンド側での整形表示に利用します。
type ProcessingResult struct {
	StartTime          time.Time       `json:"start_time"`
	RenderingStartTime time.Time       `json:"rendering_start_time,omitempty"`
	ExpectedTime       time.Time       `json:"expected_time,omitempty"`
	NowFrame           int             `json:"now_frame"`
	StartFrame         int             `json:"start_frame"`
	EndFrame           int             `json:"end_frame"`
	TotalTime          time.Duration   `json:"total_time"`
	AverageTime        time.Duration   `json:"average_time,omitempty"`
	RenderingTimes     []time.Duration `json:"rendering_times,omitempty"`
	LatestFile         string          `json:"latest_file,omitempty"`
	Status             int             `json:"status"`
	Log1               string          `json:"log1,omitempty"`
	Log2               string          `json:"log2,omitempty"`
}

type ProcessingWriter struct {
	mu     sync.RWMutex
	buffer strings.Builder
	status int

	nowFrame   int
	startFrame int
	endFrame   int

	Scenes map[string]Scene

	startTime          time.Time
	renderingStartTime time.Time
	expectedTime       time.Time
	renderingTimes     []time.Duration

	latestFile string
	log1       string
	log2       string

	analysis Analysis
}

const (
	Error = "Error:"
	Warn  = "WARN"

	FrameFlag   = "Fra:"
	FrameSaved  = "Saved:"
	FrameTime   = "Time:"
	FrameSaving = "(Saving:"
	Quit        = "Blender quit"

	Remain = "Remaining"
	Sample = "Sample"

	ProcessingTimeFormat = "2006-01-02 15:04:05.000Z0700"
)

// ターミナル表示用フォーマット文字列（コマンド側で使用）
const (
	StartLine     string = "Start Time           : %v"
	RenderingLine string = "Rendering Start Time : %v"
	TotalLine     string = "Total Time           : %v"
	AveLine       string = "Frame Average Time   : %v"
	ExpectedLine  string = "Expected End Time    : %v (%v left)"
	LatestLine    string = "Latest Saved File    : %s (%v)"
	NowFrameLine  string = "Now Frame            : %d (%0.2f%%)"
)

// ターミナル表示用行インデックス（コマンド側で使用）
const (
	StartNum    = 0
	RenderNum   = 1
	ExpectedNum = 2
	NowFrameNum = 3
	AveNum      = 4
	LatestNum   = 5
	TotalNum    = 6
	Log1Num     = 7
	Log2Num     = 8
	LineNum     = 9
)

func NewProcessingWriter(start, end int) *ProcessingWriter {
	return newProcessingWriter(start, end)
}

func newProcessingWriter(start, end int) *ProcessingWriter {

	var w ProcessingWriter
	w.buffer.Grow(1024 * 8)

	w.status = 0
	w.nowFrame = -1
	w.startFrame = start
	w.endFrame = end

	w.startTime = time.Now()
	w.expectedTime = time.Time{}

	w.analysis = NoneAnalysis

	return &w
}

func (w *ProcessingWriter) SetMode(analysis Analysis) {
	if analysis != NoneAnalysis {
		//3フレーム固定
		w.endFrame = w.startFrame + 3
	}
	w.analysis = analysis
}

func (w *ProcessingWriter) Write(b []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	err := w.write(b)
	if err != nil {
		return 0, err
	}
	return len(b), nil
}

func (w *ProcessingWriter) Close() error {
	return nil
}

// Result は現在の処理状態のスナップショットを返します。
// 別ゴルーチンから安全に呼び出せます。
func (w *ProcessingWriter) Result() ProcessingResult {
	w.mu.RLock()
	defer w.mu.RUnlock()

	var r ProcessingResult
	r.StartTime = w.startTime
	r.RenderingStartTime = w.renderingStartTime
	r.ExpectedTime = w.expectedTime
	r.NowFrame = w.nowFrame
	r.StartFrame = w.startFrame
	r.EndFrame = w.endFrame
	r.LatestFile = w.latestFile
	r.Status = w.status
	r.Log1 = w.log1
	r.Log2 = w.log2
	r.TotalTime = time.Since(w.startTime)

	if len(w.renderingTimes) > 0 {
		r.RenderingTimes = make([]time.Duration, len(w.renderingTimes))
		copy(r.RenderingTimes, w.renderingTimes)
		ave := w.getAverage()
		if ave >= 0 {
			r.AverageTime = time.Duration(ave)
		}
	}

	return r
}

func (w *ProcessingWriter) isExpected() bool {
	return w.startFrame != w.endFrame
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

	w.buffer.Reset()
	w.buffer.WriteString(remain)

	return nil
}

func (w *ProcessingWriter) writeBuffer() (string, error) {

	buf := bytes.NewBufferString(w.buffer.String())
	scanner := bufio.NewScanner(buf)

	for scanner.Scan() {

		line := scanner.Text()
		if line == "" {
			continue
		}

		w.parseLine(line)

	}

	return "", nil
}

// 状態等の設定
func (w *ProcessingWriter) parseLine(line string) error {

	//フレーム処理の場合
	idx := strings.Index(line, FrameFlag)

	if idx == 0 {

		if w.status == 2 {
			slog.Warn("status 2 error")
		} else if w.status == 0 {
			//実質の処理開始
			w.renderingStartTime = time.Now()
		}

		//ログの解析
		w.parseLog(line)
		w.status = 1

	} else if w.status == 1 {

		//フレーム内での例外処理
		switch {
		case strings.Contains(line, FrameSaved):
			//ファイル名を取得
			w.setLatestFile(line)
		case strings.Contains(line, FrameTime):
			w.updateAverageTime(line)
		case strings.Contains(line, FrameSaving):
		//何もしない
		default:
			w.status = 2
		}

	} else {

		//すでにフレームを終了している場合
		if w.status == 2 {
			//コマンドの正式終了の場合
			if strings.Index(line, Quit) == 0 {
				w.status = 3
			}
		}

	}

	return nil
}

func (w *ProcessingWriter) parseLog(line string) {

	//現在のフレーム
	csvS := strings.Split(line, "|")
	f1 := csvS[0]

	w.nowFrame = parseFrame(f1)

	if w.analysis != NoneAnalysis {
		//Sample処理か？
	}

	last := len(csvS) - 1
	w.log1 = strings.Join(csvS[:last-1], "|")
	w.log2 = strings.Join(csvS[last-1:last+1], "|")
}

func parseFrame(line string) int {
	fra := strings.Split(line, " ")

	buf := strings.Replace(fra[0], FrameFlag, "", 1)
	v, err := strconv.Atoi(buf)
	if err != nil {
		slog.Warn("parseFrame() error:" + line)
		return -1
	}
	return v
}

// updateAverageTime はフレーム完了時刻行を解析し、平均時間と予測終了時刻を更新します。
func (w *ProcessingWriter) updateAverageTime(line string) {

	if line == "" {
		return
	}

	//   Time: 00:15.81 (Saving: 00:00.14)
	csvS := strings.Split(strings.Trim(line, " "), " ")
	//先頭のTimeがあるので注意
	t := csvS[1]

	d := parseDuration(t)
	w.renderingTimes = append(w.renderingTimes, d)

	ave := w.getAverage()
	if ave >= 0 {
		remain := w.endFrame - w.nowFrame
		r := int64(remain) * ave
		rd := time.Duration(r)
		w.expectedTime = time.Now().Add(rd)
	}
}

func (w *ProcessingWriter) getAverage() int64 {

	leng := len(w.renderingTimes)
	if leng == 0 {
		return -1
	}

	all := int64(0)
	for _, dur := range w.renderingTimes {
		all += int64(dur)
	}

	return all / int64(leng)
}

/**
 * 最新保存ファイルの設定
 */
func (w *ProcessingWriter) setLatestFile(line string) {
	//Saved: 'C:\tmp\0060.png'
	f := strings.Split(line, " ")
	w.latestFile = f[1]
}

/**
 * 文字列（00:05:31 など）を時間に変換する
 */
func parseDuration(v string) time.Duration {

	unit := []string{"s", "m", "h"}
	f := strings.Split(v, ":")

	buf := ""
	for idx := range f {
		wk := f[len(f)-1-idx]
		buf = fmt.Sprintf("%s%s", wk, unit[idx]) + buf
	}

	d, _ := time.ParseDuration(buf)
	return d
}
