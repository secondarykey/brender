package exec

import (
	"context"
	"io"
	"os/exec"

	"github.com/ikascrew/brender/log"
	"golang.org/x/xerrors"
)

func runCommand(ctx context.Context, w, ew io.Writer, name string, args ...string) (int, chan error, error) {

	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Stdout = w
	cmd.Stderr = ew

	log.Info("Command:%s Arguments:%v", name, args)

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
