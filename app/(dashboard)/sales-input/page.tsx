import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function createSale(formData: FormData) {
  "use server";
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const itemId = formData.get("item_id") as string;
  const qty = Number(formData.get("qty_pcs"));
  const warehouseId = formData.get("warehouse_from_id") as string;
  const marketplaceId = formData.get("marketplace_id") as string;
  const orderNo = formData.get("order_no") as string;
  const notes = formData.get("notes") as string;

  const { error } = await supabase.from("transactions").insert({
    trx_type: "penjualan_marketplace",
    item_id: itemId,
    qty_pcs: qty,
    warehouse_from_id: warehouseId,
    marketplace_id: marketplaceId,
    order_no: orderNo,
    notes,
    created_by: user.id,
  });

  if (error) redirect(`/sales-input?error=${encodeURIComponent(error.message)}`);
  redirect("/sales-input?success=1");
}

export default async function SalesInputPage({
  searchParams,
}: {
  searchParams: { success?: string; error?: string };
}) {
  const profile = await getCurrentProfile();
  const supabase = createClient();

  const { data: items } = await supabase.from("items").select("id, sku, name").eq("is_active", true).order("sku");
  const { data: warehouses } = await supabase.from("warehouses").select("id, name").eq("is_active", true);
  const { data: marketplaces } = await supabase.from("marketplaces").select("id, name");

  const { data: recent } = await supabase
    .from("transactions")
    .select("trx_date, qty_pcs, order_no, items(sku,name), marketplaces(name), warehouses:warehouse_from_id(name)")
    .eq("trx_type", "penjualan_marketplace")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Input Penjualan Marketplace</h1>
        <p className="text-slate-500 text-sm mt-1">
          Setiap order yang diinput langsung mengurangi stok gudang terkait secara otomatis.
        </p>
      </div>

      {searchParams.success && (
        <div className="bg-green-50 text-green-700 border border-green-100 rounded-lg px-3 py-2 text-sm">
          Penjualan berhasil disimpan dan stok sudah dikurangi.
        </div>
      )}
      {searchParams.error && (
        <div className="bg-red-50 text-red-700 border border-red-100 rounded-lg px-3 py-2 text-sm">
          Gagal: {searchParams.error}
        </div>
      )}

      <form action={createSale} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Marketplace">
            <select name="marketplace_id" className="input" required>
              <option value="" disabled>Pilih marketplace</option>
              {marketplaces?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="Gudang Pengiriman">
            <select name="warehouse_from_id" className="input" required defaultValue={profile?.assigned_warehouse_id ?? ""}>
              <option value="" disabled>Pilih gudang</option>
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

        <div className="grid grid-cols-2 gap-4">
          <Field label="Qty Terjual (PCS)">
            <input type="number" name="qty_pcs" min="1" step="1" className="input" required />
          </Field>
          <Field label="No. Order / Resi">
            <input type="text" name="order_no" className="input" />
          </Field>
        </div>

        <Field label="Catatan">
          <textarea name="notes" className="input" rows={2} />
        </Field>

        <button className="bg-brand-600 text-white text-sm rounded-lg px-5 py-2.5">Simpan Penjualan</button>
      </form>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="font-medium mb-3">10 Penjualan Terakhir</h2>
        <div className="space-y-1 text-sm">
          {recent?.map((r: any, i) => (
            <div key={i} className="flex justify-between border-b border-slate-50 py-1.5">
              <span>{r.marketplaces?.name} · {r.items?.sku} — {r.items?.name} ({r.warehouses?.name})</span>
              <span className="text-slate-500">{r.qty_pcs} pcs · {r.order_no}</span>
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
