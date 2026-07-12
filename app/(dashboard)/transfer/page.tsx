import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function createTransfer(formData: FormData) {
  "use server";
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const itemId = formData.get("item_id") as string;
  const qty = Number(formData.get("qty_pcs"));
  const from = formData.get("warehouse_from_id") as string;
  const to = formData.get("warehouse_to_id") as string;
  const notes = formData.get("notes") as string;

  if (from === to) {
    redirect(`/transfer?error=${encodeURIComponent("Gudang asal dan tujuan tidak boleh sama")}`);
  }

  const { error } = await supabase.from("transactions").insert({
    trx_type: "transfer",
    item_id: itemId,
    qty_pcs: qty,
    warehouse_from_id: from,
    warehouse_to_id: to,
    notes,
    created_by: user.id,
  });

  if (error) redirect(`/transfer?error=${encodeURIComponent(error.message)}`);
  redirect("/transfer?success=1");
}

export default async function TransferPage({
  searchParams,
}: {
  searchParams: { success?: string; error?: string };
}) {
  const profile = await getCurrentProfile();
  const supabase = createClient();

  const { data: items } = await supabase.from("items").select("id, sku, name").eq("is_active", true).order("sku");
  const { data: warehouses } = await supabase.from("warehouses").select("id, name").eq("is_active", true);

  const { data: recent } = await supabase
    .from("transactions")
    .select("trx_date, qty_pcs, notes, items(sku,name), warehouse_from_id, warehouse_to_id, warehouses_from:warehouse_from_id(name), warehouses_to:warehouse_to_id(name)")
    .eq("trx_type", "transfer")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Transfer Antar Gudang</h1>
        <p className="text-slate-500 text-sm mt-1">
          Stok otomatis berkurang di gudang asal dan bertambah di gudang tujuan, tercatat di audit log.
        </p>
      </div>

      {searchParams.success && (
        <div className="bg-green-50 text-green-700 border border-green-100 rounded-lg px-3 py-2 text-sm">
          Transfer berhasil disimpan.
        </div>
      )}
      {searchParams.error && (
        <div className="bg-red-50 text-red-700 border border-red-100 rounded-lg px-3 py-2 text-sm">
          Gagal: {searchParams.error}
        </div>
      )}

      <form action={createTransfer} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Dari Gudang">
            <select name="warehouse_from_id" className="input" required defaultValue={profile?.assigned_warehouse_id ?? ""}>
              <option value="" disabled>Pilih gudang asal</option>
              {warehouses?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </Field>
          <Field label="Ke Gudang">
            <select name="warehouse_to_id" className="input" required>
              <option value="" disabled>Pilih gudang tujuan</option>
              {warehouses?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </Field>
        </div>

        <Field label="SKU / Nama Barang">
          <select name="item_id" className="input" required>
            <option value="" disabled>Pilih barang</option>
            {items?.map((it) => <option key={it.id} value={it.id}>{it.sku} — {it.name}</option>)}
          </select>
        </Field>

        <Field label="Qty (PCS)">
          <input type="number" name="qty_pcs" min="1" step="1" className="input" required />
        </Field>

        <Field label="Catatan">
          <textarea name="notes" className="input" rows={2} placeholder="contoh: 1 Bale" />
        </Field>

        <button className="bg-brand-600 text-white text-sm rounded-lg px-5 py-2.5">Simpan Transfer</button>
      </form>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="font-medium mb-3">10 Transfer Terakhir</h2>
        <div className="space-y-1 text-sm">
          {recent?.map((r: any, i) => (
            <div key={i} className="flex justify-between border-b border-slate-50 py-1.5">
              <span>{r.items?.sku} — {r.items?.name}: {r.warehouses_from?.name} → {r.warehouses_to?.name}</span>
              <span className="text-slate-500">{r.qty_pcs} pcs · {r.trx_date}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
