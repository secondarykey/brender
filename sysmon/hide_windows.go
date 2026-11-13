package sysmon

import (
	"os/exec"
	"syscall"
)

// hideConsole は子プロセスのコンソール窓を出さないようにする。
// 配る exe は -H windowsgui でコンソールを持たないので、これが無いと
// nvidia-smi を起動するたびに窓が一瞬開く（brender/exec の HideConsole と同じ設定。
// sysmon を model などに依存させないよう、ここに置いている）。
func hideConsole(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000, // CREATE_NO_WINDOW
	}
}
