export const ARCHIVE_ITEM_CREATED_EVENT = "recall:item-created";
export const ARCHIVE_ITEMS_CHANGED_EVENT = "recall:items-changed";

export function dispatchArchiveItemCreated(itemId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(ARCHIVE_ITEM_CREATED_EVENT, {
      detail: { itemId },
    }),
  );
}

export function dispatchArchiveItemsChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(ARCHIVE_ITEMS_CHANGED_EVENT));
}
