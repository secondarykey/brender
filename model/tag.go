package model

import (
	"errors"

	"golang.org/x/xerrors"
	"gorm.io/gorm"
)

type TagCategory struct {
	ID           uint   `gorm:"primaryKey" json:"id"`
	Name         string `gorm:"uniqueIndex" json:"name"`
	Color        string `json:"color"`
	DisplayOrder int    `gorm:"default:99999" json:"display_order"`
	MetaFields
}

type Tag struct {
	ID         uint   `gorm:"primaryKey" json:"id"`
	Name       string `json:"name"`
	CategoryID *uint  `json:"category_id"`
	Color      string `json:"color"`
	MetaFields
}

type ProjectFileTag struct {
	ProjectFileID string `gorm:"primaryKey" json:"project_file_id"`
	TagID         uint   `gorm:"primaryKey" json:"tag_id"`
}

type TagWithCategory struct {
	ID            uint   `json:"id"`
	Name          string `json:"name"`
	CategoryID    *uint  `json:"category_id"`
	Color         string `json:"color"`
	CategoryName  string `json:"category_name"`
	CategoryColor string `json:"category_color"`
}

type TagUsageCount struct {
	TagID uint  `json:"tag_id"`
	Count int64 `json:"count"`
}

// ── TagCategory CRUD ─────────────────────────────────────

func ListTagCategories() ([]*TagCategory, error) {
	var cats []*TagCategory
	if res := db.Order("display_order asc, name asc").Find(&cats); res.Error != nil {
		return nil, xerrors.Errorf("ListTagCategories: %w", res.Error)
	}
	return cats, nil
}

func ReorderTagCategories(ids []uint) error {
	for i, id := range ids {
		if res := db.Model(&TagCategory{}).Where("id = ?", id).Update("display_order", i); res.Error != nil {
			return xerrors.Errorf("ReorderTagCategories: %w", res.Error)
		}
	}
	return nil
}

func GetTagCategory(id uint) (*TagCategory, error) {
	var c TagCategory
	res := db.First(&c, "id = ?", id)
	if errors.Is(res.Error, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if res.Error != nil {
		return nil, xerrors.Errorf("GetTagCategory: %w", res.Error)
	}
	return &c, nil
}

func GetTagCategoryByName(name string) (*TagCategory, error) {
	var c TagCategory
	res := db.Where("name = ?", name).First(&c)
	if errors.Is(res.Error, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if res.Error != nil {
		return nil, xerrors.Errorf("GetTagCategoryByName: %w", res.Error)
	}
	return &c, nil
}

func CreateTagCategory(name, color string) (*TagCategory, error) {
	c := &TagCategory{Name: name, Color: color}
	if res := db.Create(c); res.Error != nil {
		return nil, xerrors.Errorf("CreateTagCategory: %w", res.Error)
	}
	return c, nil
}

func UpdateTagCategory(id uint, name, color string) (*TagCategory, error) {
	var c TagCategory
	if res := db.First(&c, "id = ?", id); res.Error != nil {
		return nil, xerrors.Errorf("UpdateTagCategory find: %w", res.Error)
	}
	c.Name = name
	c.Color = color
	if res := db.Save(&c); res.Error != nil {
		return nil, xerrors.Errorf("UpdateTagCategory save: %w", res.Error)
	}
	return &c, nil
}

func DeleteTagCategory(id uint) error {
	if res := db.Model(&Tag{}).Where("category_id = ?", id).Update("category_id", nil); res.Error != nil {
		return xerrors.Errorf("DeleteTagCategory detach: %w", res.Error)
	}
	if res := db.Delete(&TagCategory{}, "id = ?", id); res.Error != nil {
		return xerrors.Errorf("DeleteTagCategory: %w", res.Error)
	}
	return nil
}

func MergeTagCategories(sourceID, targetID uint) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var sourceTags []Tag
		if res := tx.Where("category_id = ?", sourceID).Find(&sourceTags); res.Error != nil {
			return xerrors.Errorf("MergeTagCategories find: %w", res.Error)
		}
		for _, st := range sourceTags {
			var targetTag Tag
			res := tx.Where("name = ? AND category_id = ?", st.Name, targetID).First(&targetTag)
			if errors.Is(res.Error, gorm.ErrRecordNotFound) {
				if res := tx.Model(&Tag{}).Where("id = ?", st.ID).Update("category_id", targetID); res.Error != nil {
					return xerrors.Errorf("MergeTagCategories move: %w", res.Error)
				}
			} else if res.Error != nil {
				return xerrors.Errorf("MergeTagCategories lookup: %w", res.Error)
			} else {
				var refs []ProjectFileTag
				tx.Where("tag_id = ?", st.ID).Find(&refs)
				for _, ref := range refs {
					var existing ProjectFileTag
					r := tx.Where("project_file_id = ? AND tag_id = ?", ref.ProjectFileID, targetTag.ID).First(&existing)
					if errors.Is(r.Error, gorm.ErrRecordNotFound) {
						tx.Model(&ProjectFileTag{}).Where("project_file_id = ? AND tag_id = ?", ref.ProjectFileID, st.ID).Update("tag_id", targetTag.ID)
					} else {
						tx.Where("project_file_id = ? AND tag_id = ?", ref.ProjectFileID, st.ID).Delete(&ProjectFileTag{})
					}
				}
				tx.Delete(&Tag{}, "id = ?", st.ID)
			}
		}
		if res := tx.Delete(&TagCategory{}, "id = ?", sourceID); res.Error != nil {
			return xerrors.Errorf("MergeTagCategories delete: %w", res.Error)
		}
		return nil
	})
}

func MergeTags(sourceID, targetID uint) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var sourceRefs []ProjectFileTag
		if res := tx.Where("tag_id = ?", sourceID).Find(&sourceRefs); res.Error != nil {
			return xerrors.Errorf("MergeTags find refs: %w", res.Error)
		}
		for _, ref := range sourceRefs {
			var existing ProjectFileTag
			res := tx.Where("project_file_id = ? AND tag_id = ?", ref.ProjectFileID, targetID).First(&existing)
			if errors.Is(res.Error, gorm.ErrRecordNotFound) {
				if res := tx.Model(&ProjectFileTag{}).Where("project_file_id = ? AND tag_id = ?", ref.ProjectFileID, sourceID).Update("tag_id", targetID); res.Error != nil {
					return xerrors.Errorf("MergeTags move ref: %w", res.Error)
				}
			} else if res.Error != nil {
				return xerrors.Errorf("MergeTags check dup: %w", res.Error)
			} else {
				if res := tx.Where("project_file_id = ? AND tag_id = ?", ref.ProjectFileID, sourceID).Delete(&ProjectFileTag{}); res.Error != nil {
					return xerrors.Errorf("MergeTags delete dup: %w", res.Error)
				}
			}
		}
		if res := tx.Delete(&Tag{}, "id = ?", sourceID); res.Error != nil {
			return xerrors.Errorf("MergeTags delete: %w", res.Error)
		}
		return nil
	})
}

// ── Tag CRUD ─────────────────────────────────────────────

func ListTags() ([]*TagWithCategory, error) {
	var tags []*TagWithCategory
	res := db.Model(&Tag{}).
		Select("tags.id, tags.name, tags.category_id, tags.color, "+
			"COALESCE(tag_categories.name, '') as category_name, "+
			"COALESCE(tag_categories.color, '') as category_color").
		Joins("LEFT JOIN tag_categories ON tag_categories.id = tags.category_id").
		Where("tags.deleted_at IS NULL").
		Order("tags.name asc").
		Find(&tags)
	if res.Error != nil {
		return nil, xerrors.Errorf("ListTags: %w", res.Error)
	}
	return tags, nil
}

func GetTag(id uint) (*Tag, error) {
	var t Tag
	res := db.First(&t, "id = ?", id)
	if errors.Is(res.Error, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if res.Error != nil {
		return nil, xerrors.Errorf("GetTag: %w", res.Error)
	}
	return &t, nil
}

func GetTagByName(name string) (*Tag, error) {
	var t Tag
	res := db.Where("name = ?", name).First(&t)
	if errors.Is(res.Error, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if res.Error != nil {
		return nil, xerrors.Errorf("GetTagByName: %w", res.Error)
	}
	return &t, nil
}

func GetTagByNameAndCategory(name string, categoryID *uint) (*Tag, error) {
	var t Tag
	var res *gorm.DB
	if categoryID != nil {
		res = db.Where("name = ? AND category_id = ?", name, *categoryID).First(&t)
	} else {
		res = db.Where("name = ? AND category_id IS NULL", name).First(&t)
	}
	if errors.Is(res.Error, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if res.Error != nil {
		return nil, xerrors.Errorf("GetTagByNameAndCategory: %w", res.Error)
	}
	return &t, nil
}

func CreateTag(name string, categoryID *uint, color string) (*Tag, error) {
	existing, err := GetTagByNameAndCategory(name, categoryID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, xerrors.New("tag already exists")
	}
	t := &Tag{Name: name, CategoryID: categoryID, Color: color}
	if res := db.Create(t); res.Error != nil {
		return nil, xerrors.Errorf("CreateTag: %w", res.Error)
	}
	return t, nil
}

func UpdateTag(id uint, name string, categoryID *uint, color string) (*Tag, error) {
	var t Tag
	if res := db.First(&t, "id = ?", id); res.Error != nil {
		return nil, xerrors.Errorf("UpdateTag find: %w", res.Error)
	}
	nameChanged := t.Name != name
	catChanged := !uintPtrEqual(t.CategoryID, categoryID)
	if nameChanged || catChanged {
		existing, err := GetTagByNameAndCategory(name, categoryID)
		if err != nil {
			return nil, err
		}
		if existing != nil && existing.ID != id {
			return nil, xerrors.New("tag already exists")
		}
	}
	t.Name = name
	t.CategoryID = categoryID
	t.Color = color
	if res := db.Save(&t); res.Error != nil {
		return nil, xerrors.Errorf("UpdateTag save: %w", res.Error)
	}
	return &t, nil
}

func uintPtrEqual(a, b *uint) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}

func DeleteTag(id uint) error {
	if res := db.Where("tag_id = ?", id).Delete(&ProjectFileTag{}); res.Error != nil {
		return xerrors.Errorf("DeleteTag refs: %w", res.Error)
	}
	if res := db.Delete(&Tag{}, "id = ?", id); res.Error != nil {
		return xerrors.Errorf("DeleteTag: %w", res.Error)
	}
	return nil
}

func SetTagCategory(tagID uint, categoryID *uint) error {
	tag, err := GetTag(tagID)
	if err != nil {
		return err
	}
	if tag == nil {
		return xerrors.New("tag not found")
	}
	existing, err := GetTagByNameAndCategory(tag.Name, categoryID)
	if err != nil {
		return err
	}
	if existing != nil && existing.ID != tagID {
		return xerrors.New("tag already exists in target category")
	}
	if res := db.Model(&Tag{}).Where("id = ?", tagID).Update("category_id", categoryID); res.Error != nil {
		return xerrors.Errorf("SetTagCategory: %w", res.Error)
	}
	return nil
}

// ── ProjectFileTag CRUD ──────────────────────────────────

func AddTagToFile(projectFileID string, tagID uint) error {
	pft := &ProjectFileTag{ProjectFileID: projectFileID, TagID: tagID}
	res := db.Where("project_file_id = ? AND tag_id = ?", projectFileID, tagID).FirstOrCreate(pft)
	if res.Error != nil {
		return xerrors.Errorf("AddTagToFile: %w", res.Error)
	}
	return nil
}

func RemoveTagFromFile(projectFileID string, tagID uint) error {
	if res := db.Where("project_file_id = ? AND tag_id = ?", projectFileID, tagID).Delete(&ProjectFileTag{}); res.Error != nil {
		return xerrors.Errorf("RemoveTagFromFile: %w", res.Error)
	}
	return nil
}

func ListTagsByFile(projectFileID string) ([]*TagWithCategory, error) {
	var tags []*TagWithCategory
	res := db.Model(&Tag{}).
		Select("tags.id, tags.name, tags.category_id, tags.color, "+
			"COALESCE(tag_categories.name, '') as category_name, "+
			"COALESCE(tag_categories.color, '') as category_color").
		Joins("LEFT JOIN tag_categories ON tag_categories.id = tags.category_id").
		Joins("INNER JOIN project_file_tags ON project_file_tags.tag_id = tags.id").
		Where("project_file_tags.project_file_id = ? AND tags.deleted_at IS NULL", projectFileID).
		Order("tags.name asc").
		Find(&tags)
	if res.Error != nil {
		return nil, xerrors.Errorf("ListTagsByFile: %w", res.Error)
	}
	return tags, nil
}

// ── 検索 ─────────────────────────────────────────────────

type FileSearchResult struct {
	ProjectFile
	ProjectName string `json:"project_name"`
	IsFavorite  bool   `gorm:"-" json:"is_favorite"`
}

// FileSearchParams はファイル検索の絞り込み条件。
// UserID はお気に入り判定・お気に入り絞り込み・権限フィルタの対象ユーザ。
type FileSearchParams struct {
	TagIDs   []uint
	Page     int
	PageSize int
	Sort     string
	Dir      string
	Untagged bool
	Keyword  string
	Favorite bool
	UserID   string
}

// applyFileSearchFilters はキーワード・タグ・お気に入りの絞り込みを適用する。
func applyFileSearchFilters(query *gorm.DB, p FileSearchParams) *gorm.DB {
	if p.Keyword != "" {
		like := "%" + p.Keyword + "%"
		query = query.Where("(project_files.name LIKE ? OR projects.name LIKE ?)", like, like)
	}

	if p.Favorite {
		query = query.Where("project_files.id IN (?)",
			db.Model(&FileFavorite{}).Select("project_file_id").Where("user_id = ?", p.UserID))
	}

	if p.Untagged {
		query = query.Where("project_files.id NOT IN (?)",
			db.Model(&ProjectFileTag{}).Select("project_file_id"))
	} else if len(p.TagIDs) > 0 {
		subQuery := db.Model(&ProjectFileTag{}).
			Select("project_file_id").
			Where("tag_id IN ?", p.TagIDs).
			Group("project_file_id").
			Having("COUNT(DISTINCT tag_id) = ?", len(p.TagIDs))
		query = query.Where("project_files.id IN (?)", subQuery)
	}
	return query
}

// finishFileSearch は件数取得・ページング・付随情報の付与をまとめて行う。
func finishFileSearch(query *gorm.DB, p FileSearchParams, label string) ([]*FileSearchResult, int64, error) {
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, xerrors.Errorf("%s count: %w", label, err)
	}

	var files []*FileSearchResult
	offset := (p.Page - 1) * p.PageSize
	if err := query.Order(resolveOrder(p.Sort, p.Dir)).Offset(offset).Limit(p.PageSize).Find(&files).Error; err != nil {
		return nil, 0, xerrors.Errorf("%s: %w", label, err)
	}

	for _, f := range files {
		populateFileInfo(&f.ProjectFile)
	}
	if err := markFavorites(p.UserID, files); err != nil {
		return nil, 0, xerrors.Errorf("%s: %w", label, err)
	}
	return files, total, nil
}

func SearchFilesByTags(p FileSearchParams) ([]*FileSearchResult, int64, error) {
	query := db.Model(&ProjectFile{}).
		Select("project_files.*, projects.name as project_name").
		Joins("INNER JOIN projects ON projects.id = project_files.project_id").
		Where("project_files.deleted_at IS NULL AND projects.deleted_at IS NULL")

	return finishFileSearch(applyFileSearchFilters(query, p), p, "SearchFilesByTags")
}

// SearchFilesByTagsForUser はファイル権限でフィルタしたタグ検索を行う。
func SearchFilesByTagsForUser(p FileSearchParams) ([]*FileSearchResult, int64, error) {
	ids, err := collectTargetIDs(p.UserID)
	if err != nil {
		return nil, 0, err
	}

	query := db.Model(&ProjectFile{}).
		Select("project_files.*, projects.name as project_name").
		Joins("INNER JOIN projects ON projects.id = project_files.project_id").
		Where("project_files.deleted_at IS NULL AND projects.deleted_at IS NULL").
		Where("project_files.id IN (?)",
			db.Model(&FilePermission{}).Select("file_id").Where("target_id IN ?", ids))

	return finishFileSearch(applyFileSearchFilters(query, p), p, "SearchFilesByTagsForUser")
}

// ── 集計 ─────────────────────────────────────────────────

func ListTagUsageCounts() ([]*TagUsageCount, error) {
	var counts []*TagUsageCount
	res := db.Model(&ProjectFileTag{}).
		Select("tag_id, COUNT(*) as count").
		Group("tag_id").
		Find(&counts)
	if res.Error != nil {
		return nil, xerrors.Errorf("ListTagUsageCounts: %w", res.Error)
	}
	return counts, nil
}

// ── カスケード削除 ───────────────────────────────────────

func DeleteTagsByFile(projectFileID string) error {
	if res := db.Where("project_file_id = ?", projectFileID).Delete(&ProjectFileTag{}); res.Error != nil {
		return xerrors.Errorf("DeleteTagsByFile: %w", res.Error)
	}
	return nil
}

func DeleteTagsByProject(projectID string) error {
	subQuery := db.Model(&ProjectFile{}).Select("id").Where("project_id = ?", projectID)
	if res := db.Where("project_file_id IN (?)", subQuery).Delete(&ProjectFileTag{}); res.Error != nil {
		return xerrors.Errorf("DeleteTagsByProject: %w", res.Error)
	}
	return nil
}
