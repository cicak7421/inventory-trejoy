import { createClient } from "@/lib/supabase/server";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: { action?: string };
}) {
  const supabase = createClient();

  let query = supabase
    .from("audit_log")
    .select("created_at, action, table_name, detail, profiles:actor_id(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (searchParams.action) query = query.eq("action", searchParams.action);

  const { data: logs } = await query;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <p className="text-slate-500 text-sm mt-1">
          Catatan seluruh aktivitas penting sistem. Log ini permanen — tidak dapat diedit atau dihapus oleh siapa pun, termasuk admin.
        </p>
      </div>

      <form className="flex gap-3">
        <select name="action" defaultValue={searchParams.action ?? ""} className="input max-w-xs">
          <option value="">Semua Aktivitas</option>
          <option value="CREATE_TRANSACTION">Transaksi Barang</option>
          <option value="CREATE_USER">User Baru</option>
          <option value="UPDATE_USER">Perubahan User/Role</option>
          <option value="APPROVE_STOCK_OPNAME">Approval Stock Opname</option>
        </select>
        <button className="bg-brand-600 text-white text-sm rounded-lg px-4 py-2">Filter</button>
      </form>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3">Waktu</th>
              <th className="px-4 py-3">Aktivitas</th>
              <th className="px-4 py-3">Oleh</th>
              <th className="px-4 py-3">Detail</th>
            </tr>
          </thead>
          <tbody>
            {logs?.map((l: any, i) => (
              <tr key={i} className="border-t border-slate-100 align-top">
                <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                  {new Date(l.created_at).toLocaleString("id-ID")}
                </td>
                <td className="px-4 py-2.5">{ACTION_LABEL[l.action] ?? l.action}</td>
                <td className="px-4 py-2.5">{l.profiles?.full_name ?? "-"}</td>
                <td className="px-4 py-2.5 text-slate-500 max-w-md truncate" title={JSON.stringify(l.detail)}>
                  {JSON.stringify(l.detail)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!logs || logs.length === 0) && (
          <p className="text-center text-sm text-slate-400 py-8">Belum ada aktivitas.</p>
        )}
      </div>
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = {
  CREATE_TRANSACTION: "Transaksi Barang Dibuat",
  CREATE_USER: "User Baru Dibuat",
  UPDATE_USER: "User/Role Diubah",
  APPROVE_STOCK_OPNAME: "Stock Opname Disetujui",
};
