package exec


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
	return createScript("samples_comparison.tmpl", "samples_*.py", dto)
}
