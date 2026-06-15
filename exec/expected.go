package exec

import (
	"encoding/csv"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/ikascrew/brender/log"
	"golang.org/x/xerrors"
)

type RenderingTime struct {
	Now      int
	Max      int
	Sample   int
	Expected time.Time
}

type PerFrame struct {
	Ended bool
	Min   time.Time
	Max   time.Time
}

type Frame struct {
	Time   time.Time
	Sample int
}

var (
	RenderingStillStartError = fmt.Errorf("Rendering still start.")
	RenderingEndedError      = fmt.Errorf("Rendering finished.")
)

func createRenderingTime(fn string) (*RenderingTime, error) {

	records := loadProcessingCSV(fn)
	if records == nil {
		return nil, xerrors.Errorf("loadProcessingCSV() error")
	}

	var rt RenderingTime

	frames := make(map[int][]*Frame)
	maxStatus := 0
	for _, rec := range records {
		//time , status , now_f , end_f , now_s , end_s
		var frame Frame
		pTime := rec[0]
		status, _ := strconv.Atoi(rec[1])
		nowF, _ := strconv.Atoi(rec[2])
		maxF, _ := strconv.Atoi(rec[3])
		nowS, _ := strconv.Atoi(rec[4])
		maxS, _ := strconv.Atoi(rec[5])

		if status > maxStatus {
			maxStatus = status
		}
		if nowF > rt.Now {
			rt.Now = nowF
		}
		if maxF != -1 {
			rt.Max = maxF
		}
		if maxS != -1 {
			rt.Sample = maxS
		}

		t, _ := time.Parse(ProcessingTimeFormat, pTime)
		frame.Time = t
		frame.Sample = nowS

		s := frames[nowF]
		s = append(s, &frame)
		frames[nowF] = s
	}

	if maxStatus == 0 {
		return nil, RenderingStillStartError
	} else if maxStatus == 0 {
		return nil, RenderingEndedError
	}

	rt.expected(frames)

	return &rt, nil
}

func (rt *RenderingTime) expected(data map[int][]*Frame) {

	var result []*PerFrame
	for key, frames := range data {
		if key == -1 {
			continue
		}

		var pf PerFrame
		pf.Min = time.Now()
		pf.Max = time.Time{}
		for _, frame := range frames {

			if frame.Time.Before(pf.Min) {
				pf.Min = frame.Time
			}
			if frame.Time.After(pf.Max) {
				pf.Max = frame.Time
			}

			if frame.Sample == rt.Sample {
				pf.Ended = true
			}
		}
		result = append(result, &pf)
	}

	if result == nil {
		return
	}

	var num int64
	var total int64

	//TODO Max Min で最大、最小を出すのもありかも
	for _, pf := range result {
		if pf.Ended {
			d := pf.Max.Sub(pf.Min)
			total += int64(d)
			num++
		}
	}

	if total == 0 {
		return
	}

	avg := total / num
	remain := int64(rt.Max - rt.Now)
	log.Debug("AVG: %s", time.Duration(avg))
	log.Debug("RemainFrame: %d", remain)

	at := time.Duration(avg * remain)
	log.Debug("Remain: %s", at)

	//1フレーム平均を算出
	now := time.Now()
	rt.Expected = now.Add(at)
}

//1フレームの終了時間を算出
//サンプリング1件の終了時刻を算出

func loadProcessingCSV(fn string) [][]string {
	fp, err := os.Open(fn)
	if err != nil {
		return nil
	}
	defer fp.Close()

	reader := csv.NewReader(fp)
	records, err := reader.ReadAll()
	if err != nil {
		return nil
	}
	return records
}
