package exec

import (
	"image"
	"image/draw"
	_ "image/png"
	"os"

	"github.com/BurntSushi/graphics-go/graphics"
	gdraw "golang.org/x/image/draw"
	"golang.org/x/xerrors"
)

const (
	BlurStdDev = 20.0
	BlurSize   = 30
)

//画像のアスペクト比をそのままで指定サイズの中に縮小（拡大）して、
//余った部分をBlurした画像で加工する
func CreateAroundImage(name string, w int, h int) (image.Image, error) {

	fp, err := os.Open(name)
	if err != nil {
		return nil, xerrors.Errorf("os.Open() error: %w", err)
	}
	defer fp.Close()

	src, _, err := image.Decode(fp)
	if err != nil {
		return nil, xerrors.Errorf("image.Decode() error: %w", err)
	}

	//基準の画像を生成
	base, err := createBaseImage(src, w, h)
	if err != nil {
		return nil, xerrors.Errorf("createBaseImage() error: %w", err)
	}

	//基準に合わせた画像を生成
	scale, err := createScaleImage(src, w, h)
	if err != nil {
		return nil, xerrors.Errorf("createScale() error: %w", err)
	}

	//張り合わせる
	err = pasteCenter(base, scale, w, h)
	if err != nil {
		return nil, xerrors.Errorf("paste() error: %w", err)
	}

	return base, nil
}

//指定サイズの画像を生成、
func createBaseImage(src image.Image, width int, height int) (draw.Image, error) {

	org := image.NewRGBA(image.Rect(0, 0, width, height))
	gdraw.CatmullRom.Scale(org, org.Bounds(), src, src.Bounds(), draw.Over, nil)

	dst := image.NewRGBA(image.Rect(0, 0, width, height))

	err := graphics.Blur(dst, org, &graphics.BlurOptions{BlurStdDev, BlurSize})
	if err != nil {
		return nil, xerrors.Errorf("graphics.Blur() error: %w", err)
	}

	return dst, nil
}

func createScaleImage(src image.Image, width int, height int) (image.Image, error) {
	w, h := getSize(src)
	sw := float64(width) / w
	sh := float64(height) / h

	ww := float64(width)
	hh := sw * h

	if sh < sw {
		ww = sh * w
		hh = float64(height)
	}

	dst := image.NewRGBA(image.Rect(0, 0, int(ww), int(hh)))
	gdraw.CatmullRom.Scale(dst, dst.Bounds(), src, src.Bounds(), draw.Over, nil)

	return dst, nil
}

func pasteCenter(base draw.Image, p image.Image, width int, height int) error {

	w, h := getSize(p)
	x, y := 0, 0

	if width == int(w) {
		y = int(float64(height/2) - (h / 2.0))
	} else {
		x = int(float64(width/2) - (w / 2.0))
	}

	draw.Draw(
		base,
		image.Rect(x, y, int(w)+x, int(h)+y),
		p,
		image.Point{0, 0},
		draw.Over,
	)

	return nil
}

func getSize(img image.Image) (float64, float64) {
	b := img.Bounds()
	return float64(b.Dx()), float64(b.Dy())
}
