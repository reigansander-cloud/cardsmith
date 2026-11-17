// Tab order helper. The ordered list of tab identifiers (FolderSupertype names)
// is stored as a JSON array in a RulesDoc record whose folder_id is
// TAB_ORDER_DOC_ID.

export const TAB_ORDER_DOC_ID = '__tab_order__';
// Per-folder tab order key. The global Clans settings still use the original
// TAB_ORDER_DOC_ID so existing order is preserved; each folder gets its own
// key now that supertypes are folder-specific.
export const tabOrderDocId = (folderId) => folderId === '__global__' ? TAB_ORDER_DOC_ID : `__tab_order__:${folderId}`;

// Reconciles a stored order array with the current supertype names.
// - Drops names that no longer exist (deleted supertypes).
// - Appends newly-created supertypes (missing from the stored order) at the end.
export function buildTabOrder(storedOrder, supertypeNames) {
  let order = (storedOrder && storedOrder.length) ? storedOrder : [...supertypeNames];
  order = order.filter((n) => supertypeNames.includes(n));
  const missing = supertypeNames.filter((n) => !order.includes(n));
  if (missing.length) {
    order = [...order, ...missing];
  }
  return order;
}