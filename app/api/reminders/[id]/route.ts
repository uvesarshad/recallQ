import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// PATCH /api/reminders/[id] - Update a reminder
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  
  const { remind_at, channels } = await req.json();
  
  const result = await db.query(
    "UPDATE reminders SET remind_at = $1, channels = $2 WHERE id = $3 AND user_id = $4",
    [remind_at, channels, id, session.user.id]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/reminders/[id] - Delete a reminder
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const result = await db.query(
      "DELETE FROM reminders WHERE id = $1 AND user_id = $2",
      [id, session.user.id]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
  }

  return new Response(null, { status: 204 });
}
