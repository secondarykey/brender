package exec

import (
	"fmt"
	"io"
	"log/slog"
	"os"
	"strings"

	"golang.org/x/term"
)

type Terminal struct {
	width   int
	height  int
	lines   []string
	Refresh bool

	writer io.Writer
}

func NewTerminal(h int) (*Terminal, error) {
	var term Terminal
	term.lines = make([]string, h)
	term.height = h
	term.Refresh = false
	term.writer = os.Stdout
	term.width = 80 // default fallback
	if err := term.setWidth(); err != nil {
		slog.Warn("terminal width detection failed, using 80")
	}
	return &term, nil
}

func (t *Terminal) setWidth() error {
	if t == nil {
		return nil
	}
	//TODO ?
	w, _, err := term.GetSize(int(os.Stdout.Fd()))
	if err != nil {
		slog.Warn("term.GetSize()")
		return err
	}
	t.width = w
	return nil
}

func (t *Terminal) Set(idx int, line string) error {
	if t == nil {
		return nil
	}
	if idx+1 > t.height {
		return fmt.Errorf("index error max = %d", t.height-1)
	}
	t.lines[idx] = line
	return nil
}

func (t *Terminal) PrintLine(c byte) {
	if t == nil {
		return
	}
	fmt.Fprintln(t.writer, strings.Repeat(fmt.Sprintf("%s", string([]byte{c})), t.width))
}

func (t *Terminal) Println(line string) {
	if t == nil {
		return
	}
	fmt.Fprintln(t.writer, line)
}

func (t *Terminal) Print() {
	if t == nil {
		return
	}

	if t.Refresh {
		t.setWidth()
	}
	var buf strings.Builder
	for _, line := range t.lines {
		remain := t.width - len(line)
		wk := line
		if remain > 0 {
			wk += strings.Repeat(" ", remain)
		} else if remain < 0 {
			wk = wk[0:t.width]
		}
		buf.WriteString(wk + "\n")
	}
	fmt.Fprint(t.writer, buf.String()+fmt.Sprintf("\033[%dA", t.height))
	return
}

func (t *Terminal) NewLine() {
	if t == nil {
		return
	}
	fmt.Fprint(t.writer, strings.Repeat("\n", t.height))
}
