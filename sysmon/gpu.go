package sysmon

import (
	"os/exec"
	"strconv"
	"strings"
)

var nvidiaSmiPath string

func initGPU() {
	path, err := exec.LookPath("nvidia-smi")
	if err != nil {
		return
	}
	nvidiaSmiPath = path
}

func shutdownGPU() {}

func collectGPU() (available bool, gpus []GPUStats) {
	if nvidiaSmiPath == "" {
		return false, nil
	}

	out, err := exec.Command(nvidiaSmiPath,
		"--query-gpu=index,name,utilization.gpu,memory.total,memory.used,temperature.gpu",
		"--format=csv,noheader,nounits",
	).Output()
	if err != nil {
		return false, nil
	}

	gpus = parseNvidiaSmiOutput(strings.TrimSpace(string(out)))
	return len(gpus) > 0, gpus
}

func parseNvidiaSmiOutput(output string) []GPUStats {
	if output == "" {
		return nil
	}

	var gpus []GPUStats
	lines := strings.Split(output, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		fields := strings.Split(line, ", ")
		if len(fields) < 6 {
			continue
		}

		var gs GPUStats
		gs.Index, _ = strconv.Atoi(strings.TrimSpace(fields[0]))
		gs.Name = strings.TrimSpace(fields[1])
		gs.Usage, _ = strconv.ParseFloat(strings.TrimSpace(fields[2]), 64)

		totalMB, _ := strconv.ParseUint(strings.TrimSpace(fields[3]), 10, 64)
		usedMB, _ := strconv.ParseUint(strings.TrimSpace(fields[4]), 10, 64)
		gs.MemTotalMB = totalMB
		gs.MemUsedMB = usedMB
		if totalMB > 0 {
			gs.MemUsage = float64(usedMB) / float64(totalMB) * 100
		}

		temp, _ := strconv.ParseUint(strings.TrimSpace(fields[5]), 10, 32)
		gs.Temperature = uint32(temp)

		gpus = append(gpus, gs)
	}

	return gpus
}
