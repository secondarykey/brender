package api

import (
	"context"
	"math/rand"
	"strings"

	"github.com/secondarykey/brender/model"
	"golang.org/x/xerrors"
)

var defaultColors = []string{
	"#4a7cdc", "#e74c3c", "#2ecc71", "#f39c12",
	"#9b59b6", "#1abc9c", "#e67e22", "#3498db",
}

func randomColor() string {
	return defaultColors[rand.Intn(len(defaultColors))]
}

// ── TagCategory ──────────────────────────────────────────

func ListTagCategories() ([]*model.TagCategory, error) {
	return model.ListTagCategories()
}

func CreateTagCategory(name, color string) (*model.TagCategory, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, xerrors.New("category name is required")
	}
	if color == "" {
		color = randomColor()
	}
	return model.CreateTagCategory(name, color)
}

func UpdateTagCategory(id uint, name, color string) (*model.TagCategory, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, xerrors.New("category name is required")
	}
	return model.UpdateTagCategory(id, name, color)
}

func DeleteTagCategory(id uint) error {
	return model.DeleteTagCategory(id)
}

func ReorderTagCategories(ids []uint) error {
	return model.ReorderTagCategories(ids)
}

func MergeTagCategories(sourceID, targetID uint) error {
	if sourceID == targetID {
		return xerrors.New("cannot merge a category into itself")
	}
	return model.MergeTagCategories(sourceID, targetID)
}

func MergeTags(sourceID, targetID uint) error {
	if sourceID == targetID {
		return xerrors.New("cannot merge a tag into itself")
	}
	return model.MergeTags(sourceID, targetID)
}

// ── Tag ──────────────────────────────────────────────────

func ListTags() ([]*model.TagWithCategory, error) {
	return model.ListTags()
}

func CreateTag(name string, categoryID *uint, color string) (*model.Tag, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, xerrors.New("tag name is required")
	}
	return model.CreateTag(name, categoryID, color)
}

func UpdateTag(id uint, name string, categoryID *uint, color string) (*model.Tag, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, xerrors.New("tag name is required")
	}
	return model.UpdateTag(id, name, categoryID, color)
}

func DeleteTag(id uint) error {
	return model.DeleteTag(id)
}

func SetTagCategory(tagID uint, categoryID *uint) error {
	return model.SetTagCategory(tagID, categoryID)
}

// ── File tagging ─────────────────────────────────────────

func AddTagToFile(projectFileID string, tagID uint) error {
	return model.AddTagToFile(projectFileID, tagID)
}

func RemoveTagFromFile(projectFileID string, tagID uint) error {
	return model.RemoveTagFromFile(projectFileID, tagID)
}

func GetFileTags(projectFileID string) ([]*model.TagWithCategory, error) {
	return model.ListTagsByFile(projectFileID)
}

// AssignTagByInput はプレフィクス記法（"カテゴリ:タグ名" or "タグ名"）を解析し、
// 必要に応じてカテゴリ・タグを自動作成してファイルに紐付ける。
func AssignTagByInput(projectFileID, input string) (*model.TagWithCategory, error) {
	input = strings.TrimSpace(input)
	if input == "" {
		return nil, xerrors.New("tag input is required")
	}

	var categoryName, tagName string
	if idx := strings.Index(input, ":"); idx >= 0 {
		categoryName = strings.TrimSpace(input[:idx])
		tagName = strings.TrimSpace(input[idx+1:])
	} else {
		tagName = input
	}

	if tagName == "" {
		return nil, xerrors.New("tag name is required")
	}

	var categoryID *uint

	if categoryName != "" {
		cat, err := model.GetTagCategoryByName(categoryName)
		if err != nil {
			return nil, xerrors.Errorf("AssignTagByInput category lookup: %w", err)
		}
		if cat == nil {
			cat, err = model.CreateTagCategory(categoryName, randomColor())
			if err != nil {
				return nil, xerrors.Errorf("AssignTagByInput category create: %w", err)
			}
		}
		categoryID = &cat.ID
	}

	tag, err := model.GetTagByNameAndCategory(tagName, categoryID)
	if err != nil {
		return nil, xerrors.Errorf("AssignTagByInput tag lookup: %w", err)
	}
	if tag == nil {
		tag, err = model.CreateTag(tagName, categoryID, "")
		if err != nil {
			return nil, xerrors.Errorf("AssignTagByInput tag create: %w", err)
		}
	}

	if err := model.AddTagToFile(projectFileID, tag.ID); err != nil {
		return nil, xerrors.Errorf("AssignTagByInput add to file: %w", err)
	}

	tags, err := model.ListTagsByFile(projectFileID)
	if err != nil {
		return nil, err
	}
	for _, t := range tags {
		if t.ID == tag.ID {
			return t, nil
		}
	}
	return &model.TagWithCategory{
		ID:   tag.ID,
		Name: tag.Name,
	}, nil
}

// ── 検索 ─────────────────────────────────────────────────

type FileSearchResponse struct {
	Files []*model.FileSearchResult `json:"files"`
	Total int64                     `json:"total"`
}

func SearchFiles(ctx context.Context, p model.FileSearchParams) (*FileSearchResponse, error) {
	if p.Page < 1 {
		p.Page = 1
	}
	if p.PageSize < 1 {
		p.PageSize = 20
	}
	p.Keyword = strings.TrimSpace(p.Keyword)
	p.UserID = currentUser(ctx)

	var files []*model.FileSearchResult
	var total int64
	var err error
	if fullAccess(ctx) {
		files, total, err = model.SearchFilesByTags(p)
	} else {
		files, total, err = model.SearchFilesByTagsForUser(p)
	}
	if err != nil {
		return nil, err
	}
	if files == nil {
		files = []*model.FileSearchResult{}
	}
	return &FileSearchResponse{Files: files, Total: total}, nil
}

func ListTagUsageCounts() ([]*model.TagUsageCount, error) {
	return model.ListTagUsageCounts()
}
