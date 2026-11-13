//go:build !windows

package sysmon

import "os/exec"

func hideConsole(_ *exec.Cmd) {}
