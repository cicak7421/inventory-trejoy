"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function submitStockOpname(warehouseId: string, lines: { item_id: string; qty_system: number; qty_actual: number }[]) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session, error: sessionError } = await supabase
    .from("stock_opname_sessions")
    .insert({ warehouse_id: warehouseId, created_by: user.id, status: "submitted" })
    .select()
    .single();

  if (sessionError || !session) {
    throw new Error(sessionError?.message ?? "Gagal membuat sesi stock opname");
  }

  const rows = lines.map((l) => ({
    session_id: session.id,
    item_id: l.item_id,
    qty_system: l.qty_system,
    qty_actual: l.qty_actual,
  }));

  const { error: linesError } = await supabase.from("stock_opname_lines").insert(rows);
  if (linesError) throw new Error(linesError.message);

  redirect(`/stock-opname/${session.id}`);
}

export async function approveStockOpname(sessionId: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("approve_stock_opname", { p_session_id: sessionId });
  if (error) throw new Error(error.message);
  redirect(`/stock-opname/${sessionId}?approved=1`);
}
