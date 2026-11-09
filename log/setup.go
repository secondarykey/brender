package log

import (
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"sync/atomic"

	"github.com/secondarykey/brender/config"
	wlog "github.com/wenteasy/log"
)

// Options は Init の設定。
type Options struct {
	// Dir はログファイルを書くフォルダ。空ならファイルには書かない。無ければ作る。
	// ファイルは日ごとに分かれる（Dir/<Prefix>_20261109.log）。ふつうは DefaultDir() を渡す
	Dir string
	// Prefix はログファイルの名前の頭。空なら FilePrefix（brender）。
	// 同じフォルダに書くほかのプログラム（brender-tool）は別の頭にして、アプリのログと混ぜない
	Prefix string
	// Root は出すレベル（これより下は出さない）。ゼロ値は Info。あとから SetLevel で変えられる
	Root slog.Level
	// Console は標準エラー出力にも出すか。wails3 dev や go run で動かすとき（ターミナルで見るとき）に立てる。
	// ⚠️ 配る exe（-H windowsgui）には標準エラー出力の行き先が無いので、立てても見えない
	Console bool
	// KeepDays は Dir に残す日数（今日を含む）。それより古い <Prefix>_<日付>.log を消す。0 なら消さない。
	// 消すのは wenteasy/log の RollingFileWriter（SetKeep）で、ファイルを開いたとき（最初に書いたとき・日付が変わって切り替えたとき）に動く
	KeepDays int
}

// FilePrefix はログファイルの名前の頭の既定（brender_20261109.log）。
const FilePrefix = "brender"

// level は Init で組んだ出口のレベル。SetLevel / GetLevel で読み書きする。
var level slog.LevelVar

// file は Init で開いたログファイル（Path が使う）。ファイルに書いていなければ nil。
var file atomic.Pointer[wlog.RollingFileWriter]

// DefaultDir はログファイルの既定のフォルダ。brender.ini の log_dir があればそこ、無ければ {TempDir}/brender/logs。
func DefaultDir() string {
	if dir := config.Get().LogDir; dir != "" {
		return dir
	}
	return filepath.Join(os.TempDir(), "brender", "logs")
}

// Init はログの出口を組み、slog.Default() をそこへ向ける。**アプリの main の最初に 1 回だけ呼ぶ**。
// brender をライブラリとして使う人は呼ばなくてよい（自分の slog.SetDefault の出口に出る）。
//
// 書式は wenteasy/log の SimpleHandler（1件1行: 2026-11-09T16:00:00+09:00 [INFO  ] メッセージ key=value）。
//
// ⚠️ ログが書けなくてもアプリは動かす。ファイルを作れないときも、出せる出口（標準エラー出力）だけで組み、理由をエラーで返す。
// 返す io.Closer は必ず nil ではない（終わるときに Close する）。
func Init(opts Options) (io.Closer, error) {
	level.Set(opts.Root)
	prefix := opts.Prefix
	if prefix == "" {
		prefix = FilePrefix
	}

	var sinks []slog.Handler
	var closer io.Closer = nopCloser{}
	var err error
	if opts.Dir != "" {
		var w *wlog.RollingFileWriter
		if w, err = wlog.NewRollingFileWriter(opts.Dir, wlog.Day); err == nil {
			w.SetPrefix(prefix)
			// 片付けるのは <prefix>_<日付>.log にぴったり合うものだけ（頭の違うファイルや、前の形の YYYYMMDD.log には触らない）
			w.SetKeep(opts.KeepDays)
			// 消せなかったことは残す（ログのために止めはしない）。wenteasy/log は w のロックを持たずに呼ぶので、ここから同じ w へ書いてよい
			w.SetErrorHandler(func(err error) {
				Warnf("古いログファイルを片付けられませんでした（%s）: %v", opts.Dir, err)
			})
			sinks = append(sinks, wlog.NewSimpleHandler(w, &level))
			closer = w
			file.Store(w)
		} else {
			err = fmt.Errorf("ログのフォルダ %s を作れないので、ログはファイルに残りません: %w", opts.Dir, err)
		}
	}
	if opts.Console || len(sinks) == 0 {
		// どこにも出せないときも標準エラー出力にする（slog.Default() のまま残すと、標準の log の書式で出る）
		sinks = append(sinks, wlog.NewSimpleHandler(os.Stderr, &level))
	}
	slog.SetDefault(slog.New(slog.NewMultiHandler(sinks...)))
	// 標準の log で書かれたもの（Wails の中の WebView2 の [WebView2] … など）は、SetDefault のあと slog の出口に流れる。
	// 標準の log はレベルを持たないので、最初に出すレベル（Root）で記録する（既定の Info のままだと、Root が Notice のとき捨ててしまう）
	slog.SetLogLoggerLevel(opts.Root)
	return closer, err
}

// SetLevel は Init で組んだ出口のレベルを変える（設定画面・-v から）。
//
// ⚠️ 効くのは Init で組んだ出口だけ。SetLogger で別の Logger を渡したときや、
// Init を呼ばずにライブラリとして使っているときは効かない（レベルはその Logger の側で決める）。
func SetLevel(l slog.Level) {
	level.Set(l)
}

// GetLevel は Init で組んだ出口のレベルを返す。
func GetLevel() slog.Level {
	return level.Level()
}

// Path は今書いているログファイルのパスを返す。ファイルに書いていない（まだ 1 度も書いていない）なら空。
func Path() string {
	if w := file.Load(); w != nil {
		return w.Path()
	}
	return ""
}

type nopCloser struct{}

func (nopCloser) Close() error { return nil }
