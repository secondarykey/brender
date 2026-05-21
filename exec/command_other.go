//go:build !windows

package exec

import "os/exec"

func HideConsole(_ *exec.Cmd) {}

func setSysProcAttr(_ *exec.Cmd) {}
