//go:build windows

package api

import (
	"golang.org/x/sys/windows"
)

func diskFreeBytes(path string) (free, total uint64, err error) {
	var avail uint64
	p, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return 0, 0, err
	}
	err = windows.GetDiskFreeSpaceEx(p, &avail, &total, &free)
	if err != nil {
		return 0, 0, err
	}
	return avail, total, nil
}
