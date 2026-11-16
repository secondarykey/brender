package api

// 作業ディレクトリの移動（プロジェクトを別の作業ディレクトリへ移す・作業ディレクトリのパスを変える）。
//
// データを失わないための決まり:
//   - 先に全部コピーし、全部できてから DB を1つのトランザクションで切り替え、最後に旧パスを消す。
//     コピーか DB の書き換えに失敗したら、作ったコピーだけを消す（DB と旧パスはそのまま）
//   - 移動中のプロジェクトには書き込ませない（投入・動画作成を断る。checkProjectNotMoving）。
//     キューにジョブ（待ち・実行中）があるプロジェクトは移動しない
//   - 同じプロジェクト・同じ作業ディレクトリにかかわる移動を同時に走らせない
//   - 移動先が同じ場所・元の中・元を含む場所なら移動しない。移動先に同じプロジェクトのフォルダがあれば移動しない

import (
	"context"
	"errors"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sync"

	"github.com/secondarykey/brender/log"
	"github.com/secondarykey/brender/model"
	"golang.org/x/xerrors"
)

var (
	// movingMu は下の 3 つを守る。enqueueMu と一緒に取るときは enqueueMu を先に取る
	movingMu         sync.Mutex
	movingProjects   = map[string]bool{} // 移動中のプロジェクト
	movingWorkDirs   = map[uint]int{}    // 作業ディレクトリごとの、そこから・そこへ移しているプロジェクトの数
	changingWorkDirs = map[uint]bool{}   // パスを変えている作業ディレクトリ
)

var errProjectMoving = errors.New("プロジェクトのデータを移動中です。移動が終わってから実行してください")

// checkProjectNotMoving は、プロジェクトのデータを移動中ならエラーを返す。
// 投入（enqueueMu を取ったあと）と動画作成から呼ぶ。
func checkProjectNotMoving(projectID string) error {
	p, err := model.SelectProject(projectID)
	if err != nil || p == nil {
		return xerrors.Errorf("project not found: %w", err)
	}
	movingMu.Lock()
	defer movingMu.Unlock()
	if movingProjects[projectID] || changingWorkDirs[p.WorkDirID] {
		return errProjectMoving
	}
	return nil
}

// checkNoQueues は、プロジェクトのどれかにキュー（待ち・実行中）があればエラーを返す。
func checkNoQueues(projectIDs []string) error {
	n, err := model.CountQueuesByProjects(projectIDs)
	if err != nil {
		return xerrors.Errorf("CountQueuesByProjects: %w", err)
	}
	if n > 0 {
		return xerrors.New("キューにジョブがあるため移動できません。ジョブが終わってから実行してください")
	}
	return nil
}

func beginProjectMove(projectID string, from, to uint) error {
	enqueueMu.Lock()
	defer enqueueMu.Unlock()
	movingMu.Lock()
	defer movingMu.Unlock()
	if movingProjects[projectID] {
		return errProjectMoving
	}
	if changingWorkDirs[from] || changingWorkDirs[to] {
		return xerrors.New("作業ディレクトリのパスを変更中です。終わってから実行してください")
	}
	if err := checkNoQueues([]string{projectID}); err != nil {
		return err
	}
	movingProjects[projectID] = true
	movingWorkDirs[from]++
	movingWorkDirs[to]++
	return nil
}

func endProjectMove(projectID string, from, to uint) {
	movingMu.Lock()
	defer movingMu.Unlock()
	delete(movingProjects, projectID)
	for _, id := range []uint{from, to} {
		if movingWorkDirs[id]--; movingWorkDirs[id] <= 0 {
			delete(movingWorkDirs, id)
		}
	}
}

// beginWorkDirChange は作業ディレクトリのパス変更を始め、そこにあるプロジェクトの ID を返す。
func beginWorkDirChange(id uint) ([]string, error) {
	enqueueMu.Lock()
	defer enqueueMu.Unlock()
	movingMu.Lock()
	defer movingMu.Unlock()
	if changingWorkDirs[id] || movingWorkDirs[id] > 0 {
		return nil, xerrors.New("この作業ディレクトリのデータを移動中です。終わってから実行してください")
	}
	projects, err := model.ListProjectsByWorkDir(id)
	if err != nil {
		return nil, xerrors.Errorf("ListProjectsByWorkDir: %w", err)
	}
	ids := make([]string, 0, len(projects))
	for _, p := range projects {
		ids = append(ids, p.ID)
	}
	if err := checkNoQueues(ids); err != nil {
		return nil, err
	}
	changingWorkDirs[id] = true
	for _, pid := range ids {
		movingProjects[pid] = true
	}
	return ids, nil
}

func endWorkDirChange(id uint, projectIDs []string) {
	movingMu.Lock()
	defer movingMu.Unlock()
	delete(changingWorkDirs, id)
	for _, pid := range projectIDs {
		delete(movingProjects, pid)
	}
}

// StartMigrateProjectWorkDir はプロジェクトを別の作業ディレクトリへ非同期で移す。進み具合は MigrationHook で知らせる。
func StartMigrateProjectWorkDir(ctx context.Context, projectID string, newWorkDirID uint) error {
	// Owner のみ作業ディレクトリの変更が可能
	if err := requireProjectRole(ctx, projectID, model.RoleOwner); err != nil {
		return err
	}
	// WorkDirID が未設定なら既定を割り当てさせる
	if _, err := GetProjectBaseDir(projectID); err != nil {
		return xerrors.Errorf("StartMigrateProjectWorkDir: %w", err)
	}
	p, err := model.SelectProject(projectID)
	if err != nil || p == nil {
		return xerrors.Errorf("StartMigrateProjectWorkDir: project not found: %w", err)
	}
	from := p.WorkDirID
	if from == newWorkDirID {
		return nil
	}
	newWd, err := model.GetWorkDir(newWorkDirID)
	if err != nil || newWd == nil {
		return xerrors.Errorf("StartMigrateProjectWorkDir: new work_dir not found")
	}

	if err := beginProjectMove(projectID, from, newWorkDirID); err != nil {
		return err
	}
	ok := false
	defer func() {
		if !ok {
			endProjectMove(projectID, from, newWorkDirID)
		}
	}()

	// 始める前に別の移動が終わっていたら、読んだ値が古い
	if p, err = model.SelectProject(projectID); err != nil || p == nil || p.WorkDirID != from {
		return xerrors.New("ほかの移動と重なりました。もう一度実行してください")
	}
	oldWd, err := model.GetWorkDir(from)
	if err != nil || oldWd == nil {
		return xerrors.Errorf("StartMigrateProjectWorkDir: work_dir not found: %w", err)
	}
	oldBase, newBase := oldWd.Path, newWd.Path
	items, err := planMove(oldBase, newBase, []string{projectID})
	if err != nil {
		return err
	}

	ok = true
	go func() {
		defer endProjectMove(projectID, from, newWorkDirID)
		notify := func(status string, pct float64) {
			if MigrationHook != nil {
				MigrationHook(projectID, status, pct)
			}
		}
		err := runMove(items, func(pct float64) { notify("running", pct) }, func() error {
			return model.MoveProjectWorkDir(projectID, newWorkDirID, oldBase, newBase)
		})
		if err != nil {
			log.Errorf("StartMigrateProjectWorkDir %s: %v", projectID, err)
			notify("error", 0)
			return
		}
		notify("done", 1.0)
	}()
	return nil
}

// StartChangeWorkDir は作業ディレクトリのパスを変え、そこにあるプロジェクトのデータを非同期で移す。
// 進み具合は WorkDirChangeDirHook で知らせる。
func StartChangeWorkDir(ctx context.Context, id uint, newPath string) error {
	if err := requireAdmin(ctx); err != nil {
		return err
	}
	if newPath == "" {
		return xerrors.New("作業ディレクトリのパスが必要です")
	}
	wd, err := model.GetWorkDir(id)
	if err != nil || wd == nil {
		return xerrors.New("作業ディレクトリが見つかりません")
	}
	// 文字列が同じなら何もしない（画面は変わったときだけ呼ぶ）。区切りなどが違うだけの同じ場所は、
	// コピーせずにパスだけ書き換える（planMove が同じ場所と見て、コピーも削除もしない）
	if wd.Path == newPath {
		return nil
	}
	if err := os.MkdirAll(newPath, 0755); err != nil {
		return xerrors.Errorf("新しいパスの作成に失敗しました: %w", err)
	}

	projectIDs, err := beginWorkDirChange(id)
	if err != nil {
		return err
	}
	ok := false
	defer func() {
		if !ok {
			endWorkDirChange(id, projectIDs)
		}
	}()

	// 始める前に別の変更が終わっていたら、読んだ値が古い
	if wd, err = model.GetWorkDir(id); err != nil || wd == nil {
		return xerrors.New("作業ディレクトリが見つかりません")
	}
	oldPath := wd.Path
	items, err := planMove(oldPath, newPath, projectIDs)
	if err != nil {
		return err
	}

	ok = true
	go func() {
		defer endWorkDirChange(id, projectIDs)
		notify := func(status string, pct float64) {
			if WorkDirChangeDirHook != nil {
				WorkDirChangeDirHook(id, status, pct)
			}
		}
		err := runMove(items, func(pct float64) { notify("running", pct) }, func() error {
			return model.ChangeWorkDirPath(id, oldPath, newPath, projectIDs)
		})
		if err != nil {
			log.Errorf("StartChangeWorkDir %d: %v", id, err)
			notify("error", 0)
			return
		}
		notify("done", 1.0)
	}()
	return nil
}

// moveItem は1つのプロジェクトのフォルダの移動。copy が false なら（元が無い・同じ場所）コピーも削除もしない。
type moveItem struct {
	src, dst string
	copy     bool
}

// planMove は {oldBase}/{projectID} を {newBase}/{projectID} へ移す計画を作り、移せないものがあればエラーを返す。
func planMove(oldBase, newBase string, projectIDs []string) ([]moveItem, error) {
	same := samePath(oldBase, newBase)
	items := make([]moveItem, 0, len(projectIDs))
	for _, pid := range projectIDs {
		it := moveItem{src: filepath.Join(oldBase, pid), dst: filepath.Join(newBase, pid)}
		if same {
			items = append(items, it)
			continue
		}
		if model.PathWithin(it.dst, it.src) || model.PathWithin(it.src, it.dst) {
			return nil, xerrors.Errorf("移動先が移動元と重なっています: %s → %s", it.src, it.dst)
		}
		if info, err := os.Stat(it.src); err != nil {
			if !errors.Is(err, fs.ErrNotExist) {
				return nil, xerrors.Errorf("移動元を確かめられません: %w", err)
			}
			// まだ何も出力していないプロジェクト。DB を書き換えるだけ
			items = append(items, it)
			continue
		} else if !info.IsDir() {
			return nil, xerrors.Errorf("移動元がフォルダではありません: %s", it.src)
		}
		if nonEmpty, err := dirHasEntries(it.dst); err != nil {
			return nil, xerrors.Errorf("移動先を確かめられません: %w", err)
		} else if nonEmpty {
			return nil, xerrors.Errorf("移動先に同じプロジェクトのフォルダがすでにあります: %s", it.dst)
		}
		it.copy = true
		items = append(items, it)
	}
	return items, nil
}

// runMove は items をコピーし、全部できたら commit（DB の切り替え）を呼び、最後に元を消す。
// コピーか commit に失敗したら作ったコピーを消してエラーを返す（元と DB はそのまま）。
// 元の削除の失敗はログに残すだけにする（データは移動先にあり、DB もそちらを指している）。
func runMove(items []moveItem, progress func(float64), commit func() error) error {
	total := 0
	for _, it := range items {
		if it.copy {
			total += countFiles(it.src)
		}
	}
	done := 0
	onFile := func() {
		done++
		if total > 0 {
			progress(float64(done) / float64(total))
		}
	}

	var created []string
	removeCopies := func() {
		for _, dst := range created {
			if err := os.RemoveAll(dst); err != nil {
				log.Errorf("runMove: remove the copy %s: %v", dst, err)
			}
		}
	}
	for _, it := range items {
		if !it.copy {
			continue
		}
		created = append(created, it.dst)
		if err := copyTree(it.src, it.dst, onFile); err != nil {
			removeCopies()
			return xerrors.Errorf("copy %s: %w", it.src, err)
		}
	}
	if err := commit(); err != nil {
		removeCopies()
		return xerrors.Errorf("commit: %w", err)
	}
	for _, it := range items {
		if !it.copy {
			continue
		}
		if err := os.RemoveAll(it.src); err != nil {
			log.Warnf("runMove: remove the old %s: %v", it.src, err)
		}
	}
	return nil
}

func copyTree(src, dst string, onFile func()) error {
	return filepath.WalkDir(src, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		target := filepath.Join(dst, rel)
		if d.IsDir() {
			return os.MkdirAll(target, 0755)
		}
		if err := copyFile(path, target); err != nil {
			return err
		}
		onFile()
		return nil
	})
}

// copyFile は src を dst へコピーする。dst がすでにあれば上書きせずにエラーにする。
func copyFile(src, dst string) error {
	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		return err
	}
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.OpenFile(dst, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0644)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	// 書き込みの失敗が Close で分かることがある（ネットワークドライブなど）ので捨てない
	return out.Close()
}

func countFiles(dir string) int {
	count := 0
	filepath.WalkDir(dir, func(_ string, d fs.DirEntry, err error) error {
		if err == nil && !d.IsDir() {
			count++
		}
		return nil
	})
	return count
}

// dirHasEntries は dir に何か入っているかを返す。dir が無ければ false。
func dirHasEntries(dir string) (bool, error) {
	f, err := os.Open(dir)
	if errors.Is(err, fs.ErrNotExist) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	defer f.Close()
	names, err := f.Readdirnames(1)
	if errors.Is(err, io.EOF) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return len(names) > 0, nil
}

// samePath は a と b が同じ場所かを返す（区切り・大文字小文字（Windows）・リンクの違いを吸収する）。
func samePath(a, b string) bool {
	if model.PathWithin(a, b) && model.PathWithin(b, a) {
		return true
	}
	ia, errA := os.Stat(a)
	ib, errB := os.Stat(b)
	return errA == nil && errB == nil && os.SameFile(ia, ib)
}
