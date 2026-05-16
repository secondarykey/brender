package exec

import "strings"

// FormatToExt maps a Blender output format name to the actual file extension.
// Blender saves JPEG files with the .jpg extension (not .jpeg).
func FormatToExt(format string) string {
	switch strings.ToUpper(format) {
	case "JPEG":
		return "jpg"
	default:
		return "png"
	}
}

// ExtToFormat maps a file extension back to the Blender format name.
func ExtToFormat(ext string) string {
	switch strings.ToLower(ext) {
	case "jpg", "jpeg":
		return "JPEG"
	default:
		return "PNG"
	}
}
