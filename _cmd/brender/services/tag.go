package services

import (
	"context"
	"github.com/secondarykey/brender/api"
	"github.com/secondarykey/brender/model"
)

type Tag struct{}

func NewTag() *Tag { return &Tag{} }

// ── TagCategory ──────────────────────────────────────────

func (t *Tag) ListCategories(ctx context.Context) ([]*model.TagCategory, error) {
	return api.ListTagCategories()
}

func (t *Tag) CreateCategory(ctx context.Context, name, color string) (*model.TagCategory, error) {
	return api.CreateTagCategory(ctx, name, color)
}

func (t *Tag) UpdateCategory(ctx context.Context, id uint, name, color string) (*model.TagCategory, error) {
	return api.UpdateTagCategory(ctx, id, name, color)
}

func (t *Tag) DeleteCategory(ctx context.Context, id uint) error {
	return api.DeleteTagCategory(ctx, id)
}

func (t *Tag) ReorderCategories(ctx context.Context, ids []uint) error {
	return api.ReorderTagCategories(ctx, ids)
}

func (t *Tag) MergeCategories(ctx context.Context, sourceID, targetID uint) error {
	return api.MergeTagCategories(ctx, sourceID, targetID)
}

func (t *Tag) MergeTags(ctx context.Context, sourceID, targetID uint) error {
	return api.MergeTags(ctx, sourceID, targetID)
}

// ── Tag ──────────────────────────────────────────────────

func (t *Tag) ListTags(ctx context.Context) ([]*model.TagWithCategory, error) {
	return api.ListTags()
}

func (t *Tag) CreateTag(ctx context.Context, name string, categoryID uint, color string) (*model.Tag, error) {
	var cid *uint
	if categoryID > 0 {
		cid = &categoryID
	}
	return api.CreateTag(ctx, name, cid, color)
}

func (t *Tag) UpdateTag(ctx context.Context, id uint, name string, categoryID uint, color string) (*model.Tag, error) {
	var cid *uint
	if categoryID > 0 {
		cid = &categoryID
	}
	return api.UpdateTag(ctx, id, name, cid, color)
}

func (t *Tag) DeleteTag(ctx context.Context, id uint) error {
	return api.DeleteTag(ctx, id)
}

func (t *Tag) SetTagCategory(ctx context.Context, tagID uint, categoryID uint) error {
	var cid *uint
	if categoryID > 0 {
		cid = &categoryID
	}
	return api.SetTagCategory(ctx, tagID, cid)
}

// ── File tagging ─────────────────────────────────────────

func (t *Tag) AddTagToFile(ctx context.Context, projectFileID string, tagID uint) error {
	return api.AddTagToFile(ctx, projectFileID, tagID)
}

func (t *Tag) RemoveTagFromFile(ctx context.Context, projectFileID string, tagID uint) error {
	return api.RemoveTagFromFile(ctx, projectFileID, tagID)
}

func (t *Tag) GetFileTags(ctx context.Context, projectFileID string) ([]*model.TagWithCategory, error) {
	return api.GetFileTags(ctx, projectFileID)
}

func (t *Tag) AssignTagByInput(ctx context.Context, projectFileID, input string) (*model.TagWithCategory, error) {
	return api.AssignTagByInput(ctx, projectFileID, input)
}

// ── Search ───────────────────────────────────────────────

func (t *Tag) SearchFiles(ctx context.Context, tagIDs []uint, page, pageSize int, sort, dir string, untagged bool, keyword string, favorite bool) (*api.FileSearchResponse, error) {
	return api.SearchFiles(ctx, model.FileSearchParams{
		TagIDs:   tagIDs,
		Page:     page,
		PageSize: pageSize,
		Sort:     sort,
		Dir:      dir,
		Untagged: untagged,
		Keyword:  keyword,
		Favorite: favorite,
	})
}

func (t *Tag) ListTagUsageCounts(ctx context.Context) ([]*model.TagUsageCount, error) {
	return api.ListTagUsageCounts()
}
