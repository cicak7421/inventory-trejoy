"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { submitStockOpname } from "@/lib/actions/stockOpname";

type ItemRow = { item_id: string; sku: string; name: string; qty_system: number; qty_actual: string };

export default function NewOpnameForm({
  warehouses,
  defaultWarehouseId,
}: {
  warehouses: { id: string; name: string }[];
  defaultWarehouseId?: string;
}) {
  const supabase = createClient();
  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId ?? "");
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadItems(whId: string) {
    setWarehouseId(whId);
    setRows([]);
    if (!whId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("v_inventory_summary")
      .select("sku,name,qty_pcs")
      .eq("warehouse_id", whId)
      .order("sku");
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    // ambil item_id via join manual (view tidak expose item_id langsung di sini -> query items lagi)
    const { data: items } = await supabase.from("items").select("id, sku");
    const skuToId = new Map(items?.map((i) => [i.sku, i.id]));

    setRows(
      (data ?? []).map((r: any) => ({
        item_id: skuToId.get(r.sku) ?? "",
        sku: r.sku,
        name: r.name,
        qty_system: Number(r.qty_pcs),
        qty_actual: String(r.qty_pcs),
      }))
    );
  }

  const totalSelisih = useMemo(
    () => rows.reduce((sum, r) => sum + ((Number(r.qty_actual) || 0) - r.qty_system), 0),
    [rows]
  );

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await submitStockOpname(
        warehouseId,
        rows.map((r) => ({
          item_id: r.item_id,
          qty_system: r.qty_system,
          qty_actual: Number(r.qty_actual) || 0,
        }))
      );
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="max-w-xs">
        <label className="block text-xs font-medium text-slate-500 mb-1">Pilih Gudang</label>
        <select className="input" value={warehouseId} onChange={(e) => loadItems(e.target.value)}>
          <option value="">Pilih gudang</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </div>

      {error && <div className="bg-red-50 text-red-700 border border-red-100 rounded-lg px-3 py-2 text-sm">{error}</div>}
      {loading && <p className="text-sm text-slate-400">Memuat data stok...</p>}

      {rows.length > 0 && (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Nama Barang</th>
                  <th className="px-4 py-3 text-right">Stok Sistem</th>
                  <th className="px-4 py-3 text-right">Stok Aktual (Input)</th>
                  <th className="px-4 py-3 text-right">Selisih</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const selisih = (Number(r.qty_actual) || 0) - r.qty_system;
                  return (
                    <tr key={r.item_id} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-medium">{r.sku}</td>
                      <td className="px-4 py-2">{r.name}</td>
                      <td className="px-4 py-2 text-right text-slate-500">{r.qty_system}</td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          value={r.qty_actual}
                          onChange={(e) => {
                            const v = e.target.value;
                            setRows((prev) => prev.map((p, i) => (i === idx ? { ...p, qty_actual: v } : p)));
                          }}
                          className="w-24 text-right rounded-md border border-slate-300 px-2 py-1"
                        />
                      </td>
                      <td className={`px-4 py-2 text-right font-medium ${selisih === 0 ? "text-slate-400" : selisih > 0 ? "text-green-600" : "text-red-600"}`}>
                        {selisih > 0 ? `+${selisih}` : selisih}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Total selisih: <span className={`font-medium ${totalSelisih === 0 ? "text-slate-600" : totalSelisih > 0 ? "text-green-600" : "text-red-600"}`}>{totalSelisih}</span> pcs
            </p>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-brand-600 text-white text-sm rounded-lg px-5 py-2.5 disabled:opacity-60"
            >
              {submitting ? "Menyimpan..." : "Submit untuk Approval"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
