package model

import (
	"errors"

	"golang.org/x/xerrors"
	"gorm.io/gorm"
)

type TagCategory struct {
	ID    uint   `gorm:"primaryKey" json:"id"`
	Name  string `gorm:"uniqueIndex" json:"name"`
	Color string `json:"color"`
	MetaFields
}

type Tag struct {
	ID         uint   `gorm:"primaryKey" json:"id"`
	Name       string `gorm:"uniqueIndex" json:"name"`
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
	if res := db.Order("name asc").Find(&cats); res.Error != nil {
		return nil, xerrors.Errorf("ListTagCategories: %w", res.Error)
	}
	return cats, nil
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
		if res := tx.Model(&Tag{}).Where("category_id = ?", sourceID).Update("category_id", targetID); res.Error != nil {
			return xerrors.Errorf("MergeTagCategories move: %w", res.Error)
		}
		if res := tx.Delete(&TagCategory{}, "id = ?", sourceID); res.Error != nil {
			return xerrors.Errorf("MergeTagCategories delete: %w", res.Error)
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

func CreateTag(name string, categoryID *uint, color string) (*Tag, error) {
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
	t.Name = name
	t.CategoryID = categoryID
	t.Color = color
	if res := db.Save(&t); res.Error != nil {
		return nil, xerrors.Errorf("UpdateTag save: %w", res.Error)
	}
	return &t, nil
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
}

func SearchFilesByTags(tagIDs []uint, page, pageSize int, sort, dir string) ([]*FileSearchResult, int64, error) {
	query := db.Model(&ProjectFile{}).
		Select("project_files.*, projects.name as project_name").
		Joins("INNER JOIN projects ON projects.id = project_files.project_id").
		Where("project_files.deleted_at IS NULL AND projects.deleted_at IS NULL")

	if len(tagIDs) > 0 {
		subQuery := db.Model(&ProjectFileTag{}).
			Select("project_file_id").
			Where("tag_id IN ?", tagIDs).
			Group("project_file_id").
			Having("COUNT(DISTINCT tag_id) = ?", len(tagIDs))
		query = query.Where("project_files.id IN (?)", subQuery)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, xerrors.Errorf("SearchFilesByTags count: %w", err)
	}

	var files []*FileSearchResult
	offset := (page - 1) * pageSize
	if err := query.Order(resolveOrder(sort, dir)).Offset(offset).Limit(pageSize).Find(&files).Error; err != nil {
		return nil, 0, xerrors.Errorf("SearchFilesByTags: %w", err)
	}

	for _, f := range files {
		populateFileInfo(&f.ProjectFile)
	}
	return files, total, nil
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
