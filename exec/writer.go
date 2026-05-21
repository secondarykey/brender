package exec

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/ikascrew/brender/log"
)

// サブフレーム進捗パターン（Cycles / EEVEE）
var (
	// "Rendered 2/16 Tiles, Sample 64/512"  (Cycles, tiles完了行)
	reTilesRendered = regexp.MustCompile(`Rendered\s+(\d+)\s*/\s*(\d+)\s+Tiles?`)
	// "Tile 3/16" or "Path Tracing Tile 3/16"  (Cycles, レンダリング中)
	reTileCurrent = regexp.MustCompile(`\bTile\s+(\d+)\s*/\s*(\d+)`)
	// "Sample 256/512"  (Cycles, tiles あり / なし共通)
	reSample = regexp.MustCompile(`\bSample\s+(\d+)\s*/\s*(\d+)`)
	// "Rendering 25 / 64 samples"  (EEVEE)
	reEevee = regexp.MustCompile(`Rendering\s+(\d+)\s*/\s*(\d+)\s+samples`)
)

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
	BytesReceived      int64           `json:"bytes_received"` // パイプ診断用
	// サブフレーム進捗（Cycles: tiles / samples、EEVEE: samples）
	NowTile      int  `json:"now_tile"` // 完了済みタイル数（0 = タイル情報なし）
	TotalTiles   int  `json:"total_tiles"`
	NowSample    int  `json:"now_sample"` // 現在サンプル（0 = サンプル情報なし）
	TotalSamples int  `json:"total_samples"`
	FrameActive  bool `json:"frame_active"` // false = 初期化中（Synchronizing 等）、true = レンダリング開始済み
}

type logFormat int

const (
	formatUnknown    logFormat = iota
	formatLegacy               // Blender 4.x: Fra:N Mem:... | Time:...
	formatStructured           // Blender 5.x: MM:SS.mmm  category  | Fra: N | ...
)

type ProcessingWriter struct {
	mu     sync.RWMutex
	buffer strings.Builder
	status int
	format logFormat

	nowFrame   int
	startFrame int
	endFrame   int

	Scenes map[string]Scene

	startTime          time.Time
	renderingStartTime time.Time
	expectedTime       time.Time
	renderingTimes     []time.Duration

	latestFile    string
	log1          string
	log2          string
	bytesReceived int64

	nowTile         int
	totalTiles      int
	nowSample       int
	totalSamples    int
	frameActive     bool      // サンプル/タイルデータ受信後 true（初期化フェーズを除外）
	everSawFra      bool      // 一度でも Fra: 行を見たら true（リセットしない sticky フラグ）
	everHadSamples  bool      // 一度でも totalSamples > 0 を受信したら true（リセットしない）
	sampleStartTime time.Time // totalSamples が初めて確定した時刻（sync 前を除外した ETA 用）

	// タイル遷移の偽データ補正用（直前の parseLog 確定値）
	prevNowTile   int
	prevNowSample int

	analysis Analysis
}

const (
	Error = "Error:"
	Warn  = "WARN"

	FrameFlag      = "Fra:"            // Cycles/EEVEE（行中のどこかに現れる）
	RenderingFrame = "Rendering frame" // Workbench（Fra: を出力しない）
	FrameSaved     = "Saved:"
	FrameTime      = "Time:"
	FrameSaving    = "(Saving:"
	Quit           = "Blender quit"

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
	w.bytesReceived += int64(len(b))
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
	r.NowTile = w.nowTile
	r.TotalTiles = w.totalTiles
	r.NowSample = w.nowSample
	r.TotalSamples = w.totalSamples
	r.FrameActive = w.frameActive
	r.TotalTime = time.Since(w.startTime)
	r.BytesReceived = w.bytesReceived

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

	content := w.buffer.String()

	// \r\n → \n、単独 \r → \n に正規化（Windows Blender の上書き進捗対応）
	content = strings.ReplaceAll(content, "\r\n", "\n")
	content = strings.ReplaceAll(content, "\r", "\n")

	// 最後の \n より後は未完の行 → 次回に持ち越す
	nl := strings.LastIndex(content, "\n")
	if nl < 0 {
		return content, nil
	}

	complete := content[:nl]
	remain := content[nl+1:]

	for _, line := range strings.Split(complete, "\n") {
		line = strings.TrimRight(line, "\r")
		if line == "" {
			continue
		}
		w.parseLine(line)
	}

	return remain, nil
}

// detectFormat はログの最初の行からフォーマットを自動判定します。
// Blender 5.x は全行が "MM:SS.mmm  category  | ..." の形式で始まります。
func detectFormat(line string) logFormat {
	// タイムスタンプ: 数字2桁 + ':' + 数字2桁 + '.'
	if len(line) >= 6 &&
		line[0] >= '0' && line[0] <= '9' &&
		line[1] >= '0' && line[1] <= '9' &&
		line[2] == ':' &&
		line[3] >= '0' && line[3] <= '9' &&
		line[4] >= '0' && line[4] <= '9' &&
		line[5] == '.' {
		return formatStructured
	}
	return formatLegacy
}

// 状態等の設定
// Blender 4.x (formatLegacy):     Fra:N Mem:... | Time:... | ...
// Blender 5.x (formatStructured): MM:SS.mmm  category  | Fra: N | Mem: ... | detail
func (w *ProcessingWriter) parseLine(line string) error {

	// フォーマット未確定なら最初の行で判定
	if w.format == formatUnknown {
		w.format = detectFormat(line)
	}

	switch w.format {
	case formatStructured:
		return w.parseLineStructured(line)
	default:
		return w.parseLineLegacy(line)
	}
}

// parseLineLegacy は Blender 4.x 形式のログを解析します。
func (w *ProcessingWriter) parseLineLegacy(line string) error {

	if strings.HasPrefix(line, FrameFlag) {
		if w.status == 0 {
			w.renderingStartTime = time.Now()
		}
		w.parseLog(line)
		w.status = 1
		return nil
	}

	if strings.HasPrefix(line, Quit) {
		w.status = 3
		return nil
	}

	if w.status < 1 {
		return nil
	}

	switch {
	case strings.Contains(line, FrameSaved):
		w.setLatestFile(line)
	case strings.Contains(line, FrameTime):
		w.updateAverageTime(line)
	default:
		w.parseSubFrame(line)
	}

	return nil
}

// parseLineStructured は Blender 5.x 形式のログを解析します。
// Cycles/EEVEE は "Fra: N" セグメントを、Workbench は "Rendering frame N" セグメントを使います。
func (w *ProcessingWriter) parseLineStructured(line string) error {

	// | で分割してセグメントを検索
	segments := strings.Split(line, "|")

	for _, seg := range segments {
		trimmed := strings.TrimSpace(seg)
		if strings.HasPrefix(trimmed, FrameFlag) {
			// Cycles / EEVEE
			if w.status == 0 {
				w.renderingStartTime = time.Now()
			}
			w.parseLog(line)
			w.status = 1
			return nil
		}
		if strings.HasPrefix(trimmed, RenderingFrame) {
			// Workbench: "Rendering frame N"
			if w.status == 0 {
				w.renderingStartTime = time.Now()
			}
			w.parseWorkbenchFrame(line, trimmed)
			w.status = 1
			return nil
		}
	}

	if strings.Contains(line, Quit) {
		w.status = 3
		return nil
	}

	if w.status < 1 {
		return nil
	}

	switch {
	case strings.Contains(line, FrameSaved):
		w.setLatestFile(line)
	case strings.Contains(line, FrameTime):
		w.updateAverageTime(line)
	default:
		w.parseSubFrame(line)
	}

	return nil
}

// parseWorkbenchFrame は "Rendering frame N" セグメントからフレーム番号を抽出します。
// Workbench と EEVEE どちらも "Rendering frame N" を出力するが挙動が異なる:
//   - everSawFra=false (Workbench、または EEVEE の最初のフレーム開始前):
//     frameActive=true にしてフレーム番号を即表示
//   - everSawFra=true (EEVEE のフレーム間遷移):
//     サンプル状態をリセットし frameActive=false（次の Fra: 行が来るまで準備中）
func (w *ProcessingWriter) parseWorkbenchFrame(line, seg string) {
	buf := strings.TrimPrefix(seg, RenderingFrame)
	buf = strings.TrimSpace(buf)
	fields := strings.Fields(buf)
	if len(fields) > 0 {
		if v, err := strconv.Atoi(fields[0]); err == nil {
			w.nowFrame = v
		}
	}
	// 古いサンプル/タイル値を常にリセット（フレーム間の誤った進捗スパイク防止）
	w.nowTile = 0
	w.totalTiles = 0
	w.nowSample = 0
	w.totalSamples = 0
	if !w.everSawFra {
		// Workbench または初回フレーム開始前: frameActive=true で即表示
		w.frameActive = true
	}
	// everSawFra=true（Cycles/EEVEE のフレーム間）: frameActive はそのまま維持
	// → 「準備中...」に戻らず、新サンプルが来るまで直前の進捗を保持
	w.log1 = line
	w.log2 = ""
}

func (w *ProcessingWriter) parseLog(line string) {

	csvS := strings.Split(line, "|")

	// Fra: で始まるセグメントからフレーム番号を取得
	// 4.x: csvS[0] = "Fra:1 Mem:..."  5.x: csvS[N] = " Fra: 1 "
	w.nowFrame = -1
	for _, seg := range csvS {
		seg = strings.TrimSpace(seg)
		if strings.HasPrefix(seg, FrameFlag) {
			w.nowFrame = parseFrame(seg)
			break
		}
	}

	// Fra: 行を初めて見た → sticky フラグ ON（以降 parseWorkbenchFrame の挙動が変わる）
	w.everSawFra = true

	// 直前の確定値を保存（タイル遷移の偽データ補正に使用）
	prevTile := w.prevNowTile
	prevSample := w.prevNowSample

	// サブフレーム値をリセットしてから行を再解析
	w.nowTile = 0
	w.totalTiles = 0
	w.nowSample = 0
	w.totalSamples = 0
	w.parseSubFrame(line)

	// ── タイル遷移の偽データ補正 ────────────────────────────────────
	if w.totalSamples > 0 {
		// P1: タイルがインクリメントした直後に nowSample == totalSamples（前タイルの残値）
		//     例: Rendered 0/2…Sample 128/128 → Rendered 1/2…Sample 128/128
		//     → 新タイルはまだ開始していないので nowSample を 0 に補正
		if w.nowTile > prevTile && w.nowSample == w.totalSamples {
			w.nowSample = 0
		}
		// P2: タイルが同じなのに nowSample が 0 にリセット、かつ前回が totalSamples
		//     例: Rendered 1/2…Sample 128/128 → Rendered 1/2…Sample 0/128（Finished 直前）
		//     → 最終タイル完了後の偽リセットなので totalSamples に戻す
		if w.nowTile == prevTile && prevSample == w.totalSamples && w.nowSample == 0 {
			w.nowSample = w.totalSamples
		}
	}
	// 補正済みの値を次回呼び出し用に保存
	w.prevNowTile = w.nowTile
	w.prevNowSample = w.nowSample

	// totalSamples > 0 が判明した瞬間から frameActive=true。
	// 一度でもサンプル数が確定したら Denoising・Compositing・フレーム間 sync でもそのまま維持。
	// まだ totalSamples が判明していない場合（Cycles 初期化 sync 行）は false のまま＝準備中表示。
	w.frameActive = w.everHadSamples

	last := len(csvS) - 1
	if last >= 2 {
		w.log1 = strings.Join(csvS[:last-1], "|")
		w.log2 = strings.Join(csvS[last-1:last+1], "|")
	} else if last == 1 {
		w.log1 = csvS[0]
		w.log2 = csvS[1]
	} else {
		w.log1 = line
		w.log2 = ""
	}
}

// parseSubFrame はCycles/EEVEEのサブフレーム進捗（タイル・サンプル数）を行から抽出します。
func (w *ProcessingWriter) parseSubFrame(line string) {
	// Cycles tiles: "Rendered 2/16 Tiles" (N=完了済み) → nowTile=N
	if m := reTilesRendered.FindStringSubmatch(line); m != nil {
		w.nowTile, _ = strconv.Atoi(m[1])
		w.totalTiles, _ = strconv.Atoi(m[2])
	} else if m := reTileCurrent.FindStringSubmatch(line); m != nil {
		// "Tile 3/16" (N=現在処理中) → 完了済み = N-1
		cur, _ := strconv.Atoi(m[1])
		w.nowTile = cur - 1
		if w.nowTile < 0 {
			w.nowTile = 0
		}
		w.totalTiles, _ = strconv.Atoi(m[2])
	}

	// EEVEE: "Rendering 25 / 64 samples"
	if m := reEevee.FindStringSubmatch(line); m != nil {
		w.nowSample, _ = strconv.Atoi(m[1])
		w.totalSamples, _ = strconv.Atoi(m[2])
		w.onSamplesKnown()
		w.updateExpectedFromSubFrame()
		return
	}

	// Cycles samples: "Sample 256/512"
	if m := reSample.FindStringSubmatch(line); m != nil {
		w.nowSample, _ = strconv.Atoi(m[1])
		w.totalSamples, _ = strconv.Atoi(m[2])
		w.onSamplesKnown()
		w.updateExpectedFromSubFrame()
	}
}

// onSamplesKnown は totalSamples > 0 が初めて判明したときに一度だけ sampleStartTime を記録します。
func (w *ProcessingWriter) onSamplesKnown() {
	if w.totalSamples <= 0 {
		return
	}
	if !w.everHadSamples {
		w.sampleStartTime = time.Now()
		w.everHadSamples = true
	}
}

// updateExpectedFromSubFrame はサンプル進捗から完了予定時刻を計算します。
//
// sync フェーズを除外するため sampleStartTime（totalSamples 確定時点）からの経過時間を使います。
// ETA = sampleStartTime + elapsed × totalWork / workDone
func (w *ProcessingWriter) updateExpectedFromSubFrame() {
	if w.sampleStartTime.IsZero() || w.nowFrame < 0 || w.totalSamples <= 0 {
		return
	}
	totalFrames := w.endFrame - w.startFrame + 1
	if totalFrames <= 0 {
		return
	}

	// 1フレームあたりの総作業量（タイルあり: totalTiles×totalSamples、なし: totalSamples）
	totalWorkPerFrame := w.totalSamples
	if w.totalTiles > 0 {
		totalWorkPerFrame = w.totalTiles * w.totalSamples
	}

	// 現フレームの作業済み量
	// 「1/n を0とする」: サンプルは1始まりのため -1 して計算（sample 1 = 進捗0）
	effectiveSample := w.nowSample - 1
	if effectiveSample < 0 {
		effectiveSample = 0
	}
	workInFrame := effectiveSample
	if w.totalTiles > 0 {
		workInFrame = w.nowTile*w.totalSamples + effectiveSample
	}

	// 全体の作業済み量（完了済みフレーム＋現フレーム途中）
	framesDone := w.nowFrame - w.startFrame
	totalWorkDone := framesDone*totalWorkPerFrame + workInFrame
	if totalWorkDone <= 0 {
		return
	}

	// サンプル 1/n は計測開始直後で elapsed がほぼゼロ → ETA の外挿誤差が極大になるためスキップ
	if totalWorkDone <= 1 {
		return
	}

	totalWork := totalFrames * totalWorkPerFrame
	elapsed := time.Since(w.sampleStartTime)
	// 比例計算: ETA = sampleStartTime + elapsed × (totalWork / workDone)
	estimated := time.Duration(float64(elapsed) * float64(totalWork) / float64(totalWorkDone))
	w.expectedTime = w.sampleStartTime.Add(estimated)
}

// parseFrame は "Fra:1 Mem:..." (4.x) または "Fra: 1" (5.x) からフレーム番号を返します。
func parseFrame(seg string) int {
	buf := strings.TrimPrefix(seg, FrameFlag) // "1 Mem:..." or " 1"
	buf = strings.TrimSpace(buf)
	fields := strings.Fields(buf)
	if len(fields) == 0 {
		log.Warn("parseFrame() empty:%s", seg)
		return -1
	}
	v, err := strconv.Atoi(fields[0])
	if err != nil {
		log.Warn("parseFrame() error:%s", seg)
		return -1
	}
	return v
}

// updateAverageTime はフレーム完了時刻行を解析し、平均時間と予測終了時刻を更新します。
func (w *ProcessingWriter) updateAverageTime(line string) {

	if line == "" {
		return
	}

	// Blender 4.x: "Time:00:15.81 (Saving: 00:00.14)"  — Time: が行頭
	// Blender 5.x: "HH:MM.SS  render  | Time: 00:33.76 (Saving: 00:00.15)"
	// → | で分割し Time: を含むセグメントを探す
	seg := line
	for _, part := range strings.Split(line, "|") {
		if strings.Contains(part, FrameTime) {
			seg = strings.TrimSpace(part)
			break
		}
	}

	// seg: "Time:00:15.81 ..." or "Time: 00:33.76 ..."
	// Time: プレフィックスを除去してスペース区切りの先頭がタイムスタンプ
	buf := strings.TrimPrefix(seg, FrameTime) // "00:15.81 ..." or " 00:33.76 ..."
	buf = strings.TrimSpace(buf)
	parts := strings.Fields(buf)
	if len(parts) == 0 {
		return
	}
	t := parts[0]

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

// setLatestFile はフレーム保存行からファイルパスを抽出します。
// Blender 4.x: "Saved: 'C:\tmp\0060.png'"
// Blender 5.x: "HH:MM.SS  render  | Saved: 'D:\...\frame_0001.png'"
func (w *ProcessingWriter) setLatestFile(line string) {
	// | で分割し Saved: を含むセグメントを探す
	seg := line
	for _, part := range strings.Split(line, "|") {
		if strings.Contains(part, FrameSaved) {
			seg = strings.TrimSpace(part)
			break
		}
	}
	// seg: "Saved: 'path'" — スペース区切りの2番目がパス
	f := strings.SplitN(seg, " ", 3)
	if len(f) >= 2 {
		w.latestFile = strings.Trim(f[len(f)-1], "'")
	}
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
