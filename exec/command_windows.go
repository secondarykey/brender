package exec

import (
	"os/exec"
	"syscall"
)

func HideConsole(cmd *exec.Cmd) {
	setSysProcAttr(cmd)
}

func setSysProcAttr(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000, // CREATE_NO_WINDOW
	}
}
