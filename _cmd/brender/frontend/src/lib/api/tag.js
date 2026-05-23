import { isWails, serverCall } from './_client'

const svc = () => import('../../../bindings/github.com/ikascrew/brender/api/wails/tag')

export const TagApi = {
  // ── TagCategory ────────────────────────────────────────

  listCategories: () =>
    isWails() ? svc().then(s => s.ListCategories())
              : serverCall('tag', 'list_categories'),

  createCategory: ({ name, color }) =>
    isWails() ? svc().then(s => s.CreateCategory(name, color || ''))
              : serverCall('tag', 'create_category', { name, color }),

  updateCategory: ({ id, name, color }) =>
    isWails() ? svc().then(s => s.UpdateCategory(id, name, color))
              : serverCall('tag', 'update_category', { id, name, color }),

  deleteCategory: ({ id }) =>
    isWails() ? svc().then(s => s.DeleteCategory(id))
              : serverCall('tag', 'delete_category', { id }),

  mergeCategories: ({ sourceID, targetID }) =>
    isWails() ? svc().then(s => s.MergeCategories(sourceID, targetID))
              : serverCall('tag', 'merge_categories', { source_id: sourceID, target_id: targetID }),

  // ── Tag ────────────────────────────────────────────────

  listTags: () =>
    isWails() ? svc().then(s => s.ListTags())
              : serverCall('tag', 'list_tags'),

  createTag: ({ name, categoryID, color }) =>
    isWails() ? svc().then(s => s.CreateTag(name, categoryID || 0, color || ''))
              : serverCall('tag', 'create_tag', { name, category_id: categoryID, color }),

  updateTag: ({ id, name, categoryID, color }) =>
    isWails() ? svc().then(s => s.UpdateTag(id, name, categoryID || 0, color || ''))
              : serverCall('tag', 'update_tag', { id, name, category_id: categoryID, color }),

  deleteTag: ({ id }) =>
    isWails() ? svc().then(s => s.DeleteTag(id))
              : serverCall('tag', 'delete_tag', { id }),

  setTagCategory: ({ tagID, categoryID }) =>
    isWails() ? svc().then(s => s.SetTagCategory(tagID, categoryID || 0))
              : serverCall('tag', 'set_tag_category', { tag_id: tagID, category_id: categoryID }),

  // ── File tagging ───────────────────────────────────────

  addTagToFile: ({ projectFileID, tagID }) =>
    isWails() ? svc().then(s => s.AddTagToFile(projectFileID, tagID))
              : serverCall('tag', 'add_tag_to_file', { project_file_id: projectFileID, tag_id: tagID }),

  removeTagFromFile: ({ projectFileID, tagID }) =>
    isWails() ? svc().then(s => s.RemoveTagFromFile(projectFileID, tagID))
              : serverCall('tag', 'remove_tag_from_file', { project_file_id: projectFileID, tag_id: tagID }),

  getFileTags: ({ projectFileID }) =>
    isWails() ? svc().then(s => s.GetFileTags(projectFileID))
              : serverCall('tag', 'get_file_tags', { project_file_id: projectFileID }),

  assignTagByInput: ({ projectFileID, input }) =>
    isWails() ? svc().then(s => s.AssignTagByInput(projectFileID, input))
              : serverCall('tag', 'assign_tag_by_input', { project_file_id: projectFileID, input }),

  // ── Search ─────────────────────────────────────────────

  searchFiles: ({ tagIDs, page, pageSize, sort, dir }) =>
    isWails() ? svc().then(s => s.SearchFiles(tagIDs || [], page || 1, pageSize || 20, sort || '', dir || ''))
              : serverCall('tag', 'search_files', { tag_ids: tagIDs, page, page_size: pageSize, sort, dir }),

  listTagUsageCounts: () =>
    isWails() ? svc().then(s => s.ListTagUsageCounts())
              : serverCall('tag', 'list_tag_usage_counts'),
}
