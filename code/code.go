package code

import (
	"encoding/json"
	"os"
	"path/filepath"

	_ "embed"
)

//go:embed _assets/image_formats.json
var defaultImageFormats []byte

//go:embed _assets/video_formats.json
var defaultVideoFormats []byte

//go:embed _assets/resolution_presets.json
var defaultResolutionPresets []byte

// ImageFormat は画像出力フォーマットのコード定義。
// BlenderValue が Blender の -F 引数に渡す値（例: "PNG", "JPEG", "OPEN_EXR"）。
type ImageFormat struct {
	Code         string `json:"code"`
	Label        string `json:"label"`
	Ext          string `json:"ext"`
	BlenderValue string `json:"blender_value"`
}

// VideoFormat は動画出力フォーマットのコード定義。
type VideoFormat struct {
	Code  string `json:"code"`
	Label string `json:"label"`
	Ext   string `json:"ext"`
}

// ResolutionPreset は解像度プリセットのコード定義。
type ResolutionPreset struct {
	Code   string `json:"code"`
	Label  string `json:"label"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
}

func userCodeDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".brender", "code")
}

func load(name string, defaultData []byte, out any) error {
	path := filepath.Join(userCodeDir(), name)
	data, err := os.ReadFile(path)
	if err != nil {
		data = defaultData
	}
	return json.Unmarshal(data, out)
}

func GetImageFormats() ([]ImageFormat, error) {
	var v []ImageFormat
	return v, load("image_formats.json", defaultImageFormats, &v)
}

func GetVideoFormats() ([]VideoFormat, error) {
	var v []VideoFormat
	return v, load("video_formats.json", defaultVideoFormats, &v)
}

func GetResolutionPresets() ([]ResolutionPreset, error) {
	var v []ResolutionPreset
	return v, load("resolution_presets.json", defaultResolutionPresets, &v)
}
