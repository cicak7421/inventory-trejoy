import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function createTransaction(formData: FormData) {
  "use server";
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const trxType = formData.get("trx_type") as "masuk" | "keluar";
  const itemId = formData.get("item_id") as string;
  const qty = Number(formData.get("qty_pcs"));
  const warehouseId = formData.get("warehouse_id") as string;
  const supplierId = formData.get("supplier_id") as string | null;
  const notes = formData.get("notes") as string;

  const payload: Record<string, unknown> = {
    trx_type: trxType,
    item_id: itemId,
    qty_pcs: qty,
    notes,
    created_by: user.id,
  };

  if (trxType === "masuk") {
    payload.warehouse_to_id = warehouseId;
    payload.supplier_id = supplierId || null;
  } else {
    payload.warehouse_from_id = warehouseId;
  }

  const { error } = await supabase.from("transactions").insert(payload);
  if (error) {
    // Ditampilkan lewat query string sederhana; untuk produksi bisa pakai toast/state client
    redirect(`/transaksi?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/transaksi?success=1");
}

export default async function TransaksiPage({
  searchParams,
}: {
  searchParams: { success?: string; error?: string };
}) {
  const profile = await getCurrentProfile();
  const supabase = createClient();

  const { data: items } = await supabase.from("items").select("id, sku, name").eq("is_active", true).order("sku");
  const { data: suppliers } = await supabase.from("suppliers").select("id, name");
  const { data: warehouses } = await supabase.from("warehouses").select("id, name").eq("is_active", true);

  const { data: recent } = await supabase
    .from("transactions")
    .select("trx_date, trx_type, qty_pcs, notes, items(sku,name), warehouse_from_id, warehouse_to_id")
    .in("trx_type", ["masuk", "keluar"])
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Input Barang Masuk / Keluar</h1>
        <p className="text-slate-500 text-sm mt-1">
          Setiap transaksi otomatis menambah/mengurangi stok gudang dan tercatat permanen di audit log.
        </p>
      </div>

      {searchParams.success && (
        <div className="bg-green-50 text-green-700 border border-green-100 rounded-lg px-3 py-2 text-sm">
          Transaksi berhasil disimpan.
        </div>
      )}
      {searchParams.error && (
        <div className="bg-red-50 text-red-700 border border-red-100 rounded-lg px-3 py-2 text-sm">
          Gagal: {searchParams.error}
        </div>
      )}

      <form action={createTransaction} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Jenis Transaksi">
            <select name="trx_type" className="input" required>
              <option value="masuk">Barang Masuk</option>
              <option value="keluar">Barang Keluar</option>
            </select>
          </Field>
          <Field label="Gudang">
            <select name="warehouse_id" className="input" required
              defaultValue={profile?.assigned_warehouse_id ?? ""}>
              <option value="" disabled>Pilih gudang</option>
              {warehouses?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </Field>
        </div>

        <Field label="SKU / Nama Barang">
          <select name="item_id" className="input" required>
            <option value="" disabled>Pilih barang</option>
            {items?.map((it) => (
              <option key={it.id} value={it.id}>{it.sku} — {it.name}</option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Qty (PCS)">
            <input type="number" name="qty_pcs" min="1" step="1" className="input" required />
          </Field>
          <Field label="Supplier (khusus Barang Masuk)">
            <select name="supplier_id" className="input">
              <option value="">-</option>
              {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Catatan">
          <textarea name="notes" className="input" rows={2} />
        </Field>

        <button className="bg-brand-600 text-white text-sm rounded-lg px-5 py-2.5">Simpan Transaksi</button>
      </form>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="font-medium mb-3">10 Transaksi Terakhir</h2>
        <div className="space-y-1 text-sm">
          {recent?.map((r: any, i) => (
            <div key={i} className="flex justify-between border-b border-slate-50 py-1.5">
              <span>{r.trx_type === "masuk" ? "📥" : "📤"} {r.items?.sku} — {r.items?.name}</span>
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
