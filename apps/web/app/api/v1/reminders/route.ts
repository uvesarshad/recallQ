import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST /api/reminders - Create a new reminder
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { item_id, remind_at, channels } = await req.json();

  if (!item_id || !remind_at) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Ensure user owns the item
  const itemResult = await db.query("SELECT id FROM items WHERE id = $1 AND user_id = $2", [item_id, session.user.id]);
  if (itemResult.rowCount === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const result = await db.query(
    "INSERT INTO reminders (item_id, user_id, remind_at, channels) VALUES ($1, $2, $3, $4) RETURNING id",
    [item_id, session.user.id, remind_at, channels || ['email']]
  );

  await db.query(
    "UPDATE items SET reminder_at = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3",
    [remind_at, item_id, session.user.id]
  );

  return NextResponse.json({ success: true, id: result.rows[0].id });
}

// GET /api/reminders - Get all reminders (for potential UI)
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await db.query("SELECT * FROM reminders WHERE user_id = $1 ORDER BY remind_at DESC", [session.user.id]);
    return NextResponse.json(result.rows);
}
