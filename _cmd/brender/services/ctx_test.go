package services

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
)

// サービスのメソッドは全部ブラウザからも呼べる（Wails の Transport。Skill brender-access-control）。
// 権限の判定は api の関数が ctx の利用者で行うので、サービスが ctx を渡し忘れると守りが抜ける。
// このテストはサービスのソースを読み、次の2つを確かめる。
//
//  1. メソッドが ctx を使っている（使わないなら ctxFreeMethods に理由を書いて足す）
//  2. api パッケージの関数を呼ぶときは第1引数に ctx を渡している
//     （渡さない呼び出しは ctxFreeAPICalls に理由を書いて足す）
//
// 足すときは「ブラウザのだれが呼んでも困らないか」を確かめてから足すこと。

// ctxFreeMethods は ctx を使わなくてよいメソッド（"型.メソッド"）と、その理由。
var ctxFreeMethods = map[string]string{
	// 権限の画面で利用者・グループを選ぶため、ログインしている人には見せる（パスワードのハッシュは JSON に出ない）
	"Auth.ListUsers":        "権限の画面で選ぶ",
	"Auth.GetUser":          "権限の画面で選ぶ",
	"Auth.ListGroups":       "権限の画面で選ぶ",
	"Auth.GetGroup":         "権限の画面で選ぶ",
	"Auth.ListGroupsByUser": "権限の画面で選ぶ",
	"Auth.ListUsersByGroup": "権限の画面で選ぶ",

	// Blender の一覧・エンジンはワークスペースの設定で全員が選ぶ
	"Blender.List":        "ワークスペースの設定で選ぶ",
	"Blender.GetEngines":  "ワークスペースの設定で選ぶ",
	"Blender.Warnings":    "起動時の検証の結果（パスの消失など）",
	"Blender.CheckPaths":  "登録した Blender のパスがあるか",
	"Blender.GetCPUCount": "スレッド数の上限",

	"Codes.GetImageFormats":      "選択肢",
	"Codes.GetVideoFormats":      "選択肢",
	"Codes.GetResolutionPresets": "選択肢",
	"Codes.GenerateID":           "ID を作るだけ",

	"Environment.Get":          "画面の分かれ道（サーバモードか・ユーザ管理が有効か）に全員が使う",
	"Environment.GetVersion":   "版",
	"Environment.GetLicenses":  "ライセンス",
	"Environment.GetLogLevel":  "ログのレベルの名前（変えるのは SetLogLevel で admin だけ）",
	"Environment.GetLogLevels": "ログのレベルの名前の一覧",

	// キューは利用者みんなで分け合うもの。ListItems（キューの画面）も絞らずに全部見せている
	"Queue.List": "キューは全員に見せる",

	"SysMon.Get":  "CPU・メモリ・GPU の使用率",
	"SysMon.Keep": "システムモニタを動かし続ける",

	// タグの名前の一覧はファイルに付けるときに全員が選ぶ
	"Tag.ListCategories":     "タグを付けるときに選ぶ",
	"Tag.ListTags":           "タグを付けるときに選ぶ",
	"Tag.ListTagUsageCounts": "検索の画面のタグごとの件数",

	// プロジェクトの作業ディレクトリを選ぶときに使う
	"WorkDir.List": "プロジェクトの設定で選ぶ",
}

// ctxFreeAPICalls は ctx を渡さなくてよい api の呼び出し（"型.メソッド→api.関数"）と、その理由。
var ctxFreeAPICalls = map[string]string{
	// ウィンドウ（owner）だけが通る分かれ道の先。ブラウザは api.FromBrowser(ctx) で URL 版へ行く
	"Project.GetFileThumbnail→api.GetFileThumbnail":       "ウィンドウだけ",
	"Project.GetProjectThumbnail→api.GetProjectThumbnail": "ウィンドウだけ",
	"Workspace.GetThumbnail→api.GetWorkspaceThumbnail":    "ウィンドウだけ",

	"Auth.ListUsers→api.ListUsers":                  "ctxFreeMethods と同じ",
	"Auth.GetUser→api.GetUser":                      "ctxFreeMethods と同じ",
	"Auth.ListGroups→api.ListGroups":                "ctxFreeMethods と同じ",
	"Auth.GetGroup→api.GetGroup":                    "ctxFreeMethods と同じ",
	"Auth.ListGroupsByUser→api.ListGroupsByUser":    "ctxFreeMethods と同じ",
	"Auth.ListUsersByGroup→api.ListUsersByGroup":    "ctxFreeMethods と同じ",
	"Blender.List→api.ListBlenders":                 "ctxFreeMethods と同じ",
	"Blender.GetEngines→api.GetEngines":             "ctxFreeMethods と同じ",
	"Blender.Warnings→api.BlenderWarnings":          "ctxFreeMethods と同じ",
	"Blender.CheckPaths→api.MissingBlenderPaths":    "ctxFreeMethods と同じ",
	"Environment.Get→api.GetEnvironment":            "ctxFreeMethods と同じ",
	"Queue.List→api.ListQueues":                     "ctxFreeMethods と同じ",
	"SysMon.Get→api.GetSystemStats":                 "ctxFreeMethods と同じ",
	"SysMon.Keep→api.KeepSystemMonitor":             "ctxFreeMethods と同じ",
	"Tag.ListCategories→api.ListTagCategories":      "ctxFreeMethods と同じ",
	"Tag.ListTags→api.ListTags":                     "ctxFreeMethods と同じ",
	"Tag.ListTagUsageCounts→api.ListTagUsageCounts": "ctxFreeMethods と同じ",
	"WorkDir.List→api.ListWorkDirs":                 "ctxFreeMethods と同じ",

	// 関数ではなくイベントのフック（関数の変数）。動画ができたことを知らせるだけ
	"Workspace.CreateMovie→api.MovieCreatedHook": "イベントのフック",
}

func TestServiceMethodsPassCtx(t *testing.T) {
	files, err := filepath.Glob("*.go")
	if err != nil {
		t.Fatal(err)
	}
	fset := token.NewFileSet()
	seen := map[string]bool{}
	var problems []string

	for _, name := range files {
		if strings.HasSuffix(name, "_test.go") {
			continue
		}
		src, err := os.ReadFile(name)
		if err != nil {
			t.Fatal(err)
		}
		f, err := parser.ParseFile(fset, name, src, 0)
		if err != nil {
			t.Fatal(err)
		}
		for _, decl := range f.Decls {
			fn, ok := decl.(*ast.FuncDecl)
			if !ok || fn.Recv == nil || fn.Body == nil || !fn.Name.IsExported() {
				continue
			}
			recv := receiverName(fn)
			if recv == "" {
				continue
			}
			method := recv + "." + fn.Name.Name
			seen[method] = true

			if !firstParamIsCtx(fn) {
				problems = append(problems, method+": 第1引数が ctx context.Context ではない")
				continue
			}

			usesCtx := false
			ast.Inspect(fn.Body, func(n ast.Node) bool {
				if id, ok := n.(*ast.Ident); ok && id.Name == "ctx" {
					usesCtx = true
				}
				call, ok := n.(*ast.CallExpr)
				if !ok {
					return true
				}
				sel, ok := call.Fun.(*ast.SelectorExpr)
				if !ok {
					return true
				}
				pkg, ok := sel.X.(*ast.Ident)
				if !ok || pkg.Name != "api" {
					return true
				}
				if len(call.Args) > 0 && isCtxArg(call.Args[0]) {
					return true
				}
				key := method + "→api." + sel.Sel.Name
				if _, ok := ctxFreeAPICalls[key]; !ok {
					problems = append(problems, key+": api に ctx を渡していない（権限の判定が抜ける）")
				}
				return true
			})
			if !usesCtx {
				if _, ok := ctxFreeMethods[method]; !ok {
					problems = append(problems, method+": ctx を使っていない（権限の判定が抜ける）")
				}
			}
		}
	}

	// 消したメソッドが許可リストに残っていないか
	for _, list := range []map[string]string{ctxFreeMethods, ctxFreeAPICalls} {
		for key := range list {
			method, _, _ := strings.Cut(key, "→")
			if !seen[method] {
				problems = append(problems, key+": 許可リストにあるがメソッドが無い（リストから消す）")
			}
		}
	}

	sort.Strings(problems)
	for _, p := range problems {
		t.Error(p)
	}
}

// receiverName はレシーバの型名を返す（*T でも T でも T）。
func receiverName(fn *ast.FuncDecl) string {
	if len(fn.Recv.List) == 0 {
		return ""
	}
	typ := fn.Recv.List[0].Type
	if star, ok := typ.(*ast.StarExpr); ok {
		typ = star.X
	}
	if id, ok := typ.(*ast.Ident); ok {
		return id.Name
	}
	return ""
}

// firstParamIsCtx は第1引数が ctx context.Context かを返す。
func firstParamIsCtx(fn *ast.FuncDecl) bool {
	params := fn.Type.Params.List
	if len(params) == 0 || len(params[0].Names) == 0 || params[0].Names[0].Name != "ctx" {
		return false
	}
	sel, ok := params[0].Type.(*ast.SelectorExpr)
	if !ok {
		return false
	}
	pkg, ok := sel.X.(*ast.Ident)
	return ok && pkg.Name == "context" && sel.Sel.Name == "Context"
}

// isCtxArg は引数が ctx（または ctx から作ったもの。例: context.WithoutCancel(ctx)）かを返す。
func isCtxArg(e ast.Expr) bool {
	found := false
	ast.Inspect(e, func(n ast.Node) bool {
		if id, ok := n.(*ast.Ident); ok && id.Name == "ctx" {
			found = true
		}
		return !found
	})
	return found
}
