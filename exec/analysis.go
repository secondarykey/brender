package exec

type Analysis int

// 1 フレームに何秒かかるか？
// サンプル数
// 全ログの経過時間
const (
	NoneAnalysis   Analysis = -1
	SampleAnalysis Analysis = 0
	AllAnalysis    Analysis = 1
)

// ログファイルのシーン内の処理
type Scene struct {
	Layers []ViewLayer
}

type ViewLayer struct {
}
