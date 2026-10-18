const svc = () => import('../../../bindings/main/services/tag')

export const TagApi = {
  // ── TagCategory ────────────────────────────────────────

  listCategories: () =>
    svc().then(s => s.ListCategories()),

  createCategory: ({ name, color }) =>
    svc().then(s => s.CreateCategory(name, color || '')),

  updateCategory: ({ id, name, color }) =>
    svc().then(s => s.UpdateCategory(id, name, color)),

  deleteCategory: ({ id }) =>
    svc().then(s => s.DeleteCategory(id)),

  reorderCategories: ({ ids }) =>
    svc().then(s => s.ReorderCategories(ids)),

  mergeCategories: ({ sourceID, targetID }) =>
    svc().then(s => s.MergeCategories(sourceID, targetID)),

  // ── Tag ────────────────────────────────────────────────

  listTags: () =>
    svc().then(s => s.ListTags()),

  createTag: ({ name, categoryID, color }) =>
    svc().then(s => s.CreateTag(name, categoryID || 0, color || '')),

  updateTag: ({ id, name, categoryID, color }) =>
    svc().then(s => s.UpdateTag(id, name, categoryID || 0, color || '')),

  deleteTag: ({ id }) =>
    svc().then(s => s.DeleteTag(id)),

  setTagCategory: ({ tagID, categoryID }) =>
    svc().then(s => s.SetTagCategory(tagID, categoryID || 0)),

  mergeTags: ({ sourceID, targetID }) =>
    svc().then(s => s.MergeTags(sourceID, targetID)),

  // ── File tagging ───────────────────────────────────────

  addTagToFile: ({ projectFileID, tagID }) =>
    svc().then(s => s.AddTagToFile(projectFileID, tagID)),

  removeTagFromFile: ({ projectFileID, tagID }) =>
    svc().then(s => s.RemoveTagFromFile(projectFileID, tagID)),

  getFileTags: ({ projectFileID }) =>
    svc().then(s => s.GetFileTags(projectFileID)),

  assignTagByInput: ({ projectFileID, input }) =>
    svc().then(s => s.AssignTagByInput(projectFileID, input)),

  // ── Search ─────────────────────────────────────────────

  searchFiles: ({ tagIDs, page, pageSize, sort, dir, untagged, keyword, favorite }) =>
    svc().then(s => s.SearchFiles(tagIDs || [], page || 1, pageSize || 20, sort || '', dir || '', !!untagged, keyword || '', !!favorite)),

  listTagUsageCounts: () =>
    svc().then(s => s.ListTagUsageCounts()),
}
