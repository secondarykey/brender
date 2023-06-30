package exec

import (
	"io"
	"os"
	"os/exec"

	"golang.org/x/xerrors"
)

type Blender struct {
	cmd    string
	Start  int
	End    int
	Thread int

	File   string
	Result string

	Writer      io.Writer
	ErrorWriter io.Writer
}

func newBlender(cmd string) *Blender {
	var b Blender
	b.cmd = cmd
	b.Start = 0
	b.End = 0
	b.Thread = 0
	b.Writer = os.Stdout
	b.ErrorWriter = os.Stdout
	return &b
}

func (b *Blender) run(args ...string) (int, chan error, error) {

	cmd := exec.Command(b.cmd, args...)
	cmd.Stdout = b.Writer
	cmd.Stderr = b.ErrorWriter

	err := cmd.Start()
	if err != nil {
		return -1, nil, xerrors.Errorf("Command start error: %w", err)
	}
	pid := cmd.Process.Pid

	ch := make(chan error)
	go func() {
		ch <- cmd.Wait()
	}()

	return pid, ch, nil
}
