import { db } from "@/lib/db";

type Queryable = {
  query: typeof db.query;
};

export async function recordItemTombstones(
  userId: string,
  itemIds: string[],
  queryable: Queryable = db,
) {
  const uniqueIds = Array.from(new Set(itemIds));
  if (uniqueIds.length === 0) return;

  await queryable.query(
    `INSERT INTO item_tombstones (id, user_id, deleted_at)
     SELECT unnest($1::uuid[]), $2, NOW()
     ON CONFLICT (id) DO UPDATE
     SET user_id = EXCLUDED.user_id,
         deleted_at = EXCLUDED.deleted_at`,
    [uniqueIds, userId],
  );
}
