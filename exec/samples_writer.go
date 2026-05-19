package exec

import (
	"bufio"
	"bytes"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"
)

type sampleTiming struct {
	samples int
	elapsed float64
}

type SamplesComparisonWriter struct {
	mu            sync.RWMutex
	sampleList    []int
	totalCount    int
	doneCount     int
	currentSample int
	startTime     time.Time
	log2          string
	status        int
	buf           []byte
	timings       []sampleTiming
	expectedTime  time.Time
}

func NewSamplesComparisonWriter(sampleList []int) *SamplesComparisonWriter {
	return &SamplesComparisonWriter{
		sampleList: sampleList,
		totalCount: len(sampleList),
		startTime:  time.Now(),
	}
}

func (w *SamplesComparisonWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	w.buf = append(w.buf, p...)

	for {
		idx := bytes.IndexByte(w.buf, '\n')
		if idx < 0 {
			break
		}
		line := string(w.buf[:idx])
		w.buf = w.buf[idx+1:]
		w.parseLine(strings.TrimRight(line, "\r"))
	}

	return len(p), nil
}

func (w *SamplesComparisonWriter) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.status = 3
	return nil
}

func (w *SamplesComparisonWriter) parseLine(line string) {
	switch {
	case strings.HasPrefix(line, "BRENDER_SAMPLES_START "):
		if n, err := strconv.Atoi(strings.TrimPrefix(line, "BRENDER_SAMPLES_START ")); err == nil {
			w.currentSample = n
			w.status = 1
		}
	case strings.HasPrefix(line, "BRENDER_SAMPLES_DONE "):
		w.parseDone(line)
		w.doneCount++
		w.updateExpected()
	case strings.Contains(line, "Blender quit"):
		w.status = 3
	default:
		trimmed := strings.TrimSpace(line)
		if trimmed != "" {
			w.log2 = trimmed
		}
	}
}

func (w *SamplesComparisonWriter) parseDone(line string) {
	parts := strings.Fields(line)
	if len(parts) < 3 {
		return
	}
	samples, err1 := strconv.Atoi(parts[1])
	elapsed, err2 := strconv.ParseFloat(parts[2], 64)
	if err1 != nil || err2 != nil {
		return
	}
	w.timings = append(w.timings, sampleTiming{samples: samples, elapsed: elapsed})
}

func (w *SamplesComparisonWriter) updateExpected() {
	if len(w.timings) == 0 || w.doneCount >= w.totalCount {
		return
	}

	// 完了済みデータから「1サンプルあたりの時間」を算出
	var totalElapsed float64
	var totalSamples int
	for _, t := range w.timings {
		totalElapsed += t.elapsed
		totalSamples += t.samples
	}
	if totalSamples == 0 {
		return
	}
	timePerSample := totalElapsed / float64(totalSamples)

	// 残りのサンプル数合計から予測時間を算出
	var remainingSamples int
	for i := w.doneCount; i < w.totalCount; i++ {
		remainingSamples += w.sampleList[i]
	}

	remainingSec := timePerSample * float64(remainingSamples)
	w.expectedTime = time.Now().Add(time.Duration(remainingSec * float64(time.Second)))
}

func (w *SamplesComparisonWriter) Result() ProcessingResult {
	w.mu.RLock()
	defer w.mu.RUnlock()

	var log1 string
	if w.currentSample > 0 {
		log1 = fmt.Sprintf("samples=%d", w.currentSample)
	}

	// 最新の完了タイミングがあれば表示
	if len(w.timings) > 0 {
		last := w.timings[len(w.timings)-1]
		log1 = fmt.Sprintf("samples=%d (%.1fs)", last.samples, last.elapsed)
		if w.currentSample > 0 && w.doneCount < w.totalCount {
			log1 = fmt.Sprintf("samples=%d (prev: %d=%.1fs)", w.currentSample, last.samples, last.elapsed)
		}
	}

	return ProcessingResult{
		StartTime:    w.startTime,
		NowFrame:     w.doneCount,
		StartFrame:   0,
		EndFrame:     w.totalCount,
		FrameActive:  w.status == 1,
		Log1:         log1,
		Log2:         w.log2,
		Status:       w.status,
		ExpectedTime: w.expectedTime,
	}
}

func ParseSamplesList(s string) []int {
	var list []int
	sc := bufio.NewScanner(strings.NewReader(s))
	sc.Split(func(data []byte, atEOF bool) (advance int, token []byte, err error) {
		for i := 0; i < len(data); i++ {
			if data[i] == ',' {
				return i + 1, data[:i], nil
			}
		}
		if atEOF && len(data) > 0 {
			return len(data), data, nil
		}
		return 0, nil, nil
	})
	for sc.Scan() {
		t := strings.TrimSpace(sc.Text())
		if n, err := strconv.Atoi(t); err == nil && n > 0 {
			list = append(list, n)
		}
	}
	return list
}
