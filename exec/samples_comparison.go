package exec

import (
	"os"
	"text/template"

	"golang.org/x/xerrors"
)

type SamplesComparisonRun struct {
	Scene         string
	Frame         int
	SamplesList   string
	IsCycles      bool
	IsEevee       bool
	IsWorkbench   bool
	OutputDir     string
	Camera        string
	HasResolution bool
	ResolutionX   int
	ResolutionY   int
	Engine        string
	Format        string
}

func GetSamplesComparisonPythonFile(dto *SamplesComparisonRun) (string, error) {
	tmpl, err := template.ParseFS(assetsEmb, "_assets/samples_comparison.tmpl")
	if err != nil {
		return "", xerrors.Errorf("template.ParseFS() error: %w", err)
	}

	fp, err := os.CreateTemp("", "brender-samples_*.py")
	if err != nil {
		return "", xerrors.Errorf("os.CreateTemp() error: %w", err)
	}
	defer fp.Close()

	if err = tmpl.Execute(fp, dto); err != nil {
		return "", xerrors.Errorf("tmpl.Execute() error: %w", err)
	}
	return fp.Name(), nil
}
