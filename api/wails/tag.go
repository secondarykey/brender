package wails

import (
	"github.com/ikascrew/brender/api"
	"github.com/ikascrew/brender/model"
)

type Tag struct{}

func NewTag() *Tag { return &Tag{} }

// ── TagCategory ──────────────────────────────────────────

func (t *Tag) ListCategories() ([]*model.TagCategory, error) {
	return api.ListTagCategories()
}

func (t *Tag) CreateCategory(name, color string) (*model.TagCategory, error) {
	return api.CreateTagCategory(name, color)
}

func (t *Tag) UpdateCategory(id uint, name, color string) (*model.TagCategory, error) {
	return api.UpdateTagCategory(id, name, color)
}

func (t *Tag) DeleteCategory(id uint) error {
	return api.DeleteTagCategory(id)
}

func (t *Tag) ReorderCategories(ids []uint) error {
	return api.ReorderTagCategories(ids)
}

func (t *Tag) MergeCategories(sourceID, targetID uint) error {
	return api.MergeTagCategories(sourceID, targetID)
}

func (t *Tag) MergeTags(sourceID, targetID uint) error {
	return api.MergeTags(sourceID, targetID)
}

// ── Tag ──────────────────────────────────────────────────

func (t *Tag) ListTags() ([]*model.TagWithCategory, error) {
	return api.ListTags()
}

func (t *Tag) CreateTag(name string, categoryID uint, color string) (*model.Tag, error) {
	var cid *uint
	if categoryID > 0 {
		cid = &categoryID
	}
	return api.CreateTag(name, cid, color)
}

func (t *Tag) UpdateTag(id uint, name string, categoryID uint, color string) (*model.Tag, error) {
	var cid *uint
	if categoryID > 0 {
		cid = &categoryID
	}
	return api.UpdateTag(id, name, cid, color)
}

func (t *Tag) DeleteTag(id uint) error {
	return api.DeleteTag(id)
}

func (t *Tag) SetTagCategory(tagID uint, categoryID uint) error {
	var cid *uint
	if categoryID > 0 {
		cid = &categoryID
	}
	return api.SetTagCategory(tagID, cid)
}

// ── File tagging ─────────────────────────────────────────

func (t *Tag) AddTagToFile(projectFileID string, tagID uint) error {
	return api.AddTagToFile(projectFileID, tagID)
}

func (t *Tag) RemoveTagFromFile(projectFileID string, tagID uint) error {
	return api.RemoveTagFromFile(projectFileID, tagID)
}

func (t *Tag) GetFileTags(projectFileID string) ([]*model.TagWithCategory, error) {
	return api.GetFileTags(projectFileID)
}

func (t *Tag) AssignTagByInput(projectFileID, input string) (*model.TagWithCategory, error) {
	return api.AssignTagByInput(projectFileID, input)
}

// ── Search ───────────────────────────────────────────────

func (t *Tag) SearchFiles(tagIDs []uint, page, pageSize int, sort, dir string) (*api.FileSearchResponse, error) {
	return api.SearchFiles(tagIDs, page, pageSize, sort, dir)
}

func (t *Tag) ListTagUsageCounts() ([]*model.TagUsageCount, error) {
	return api.ListTagUsageCounts()
}
