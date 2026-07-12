import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

async function registerUser(formData: FormData) {
  "use server";
  const actor = await getCurrentProfile();
  if (!actor || !["admin", "super_admin"].includes(actor.role)) {
    throw new Error("Tidak diizinkan");
  }

  const email = formData.get("email") as string;
  const fullName = formData.get("full_name") as string;
  const role = formData.get("role") as string;
  const warehouseId = (formData.get("warehouse_id") as string) || null;
  const tempPassword = formData.get("temp_password") as string;

  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError || !created.user) {
    redirect(`/admin/users?error=${encodeURIComponent(createError?.message ?? "Gagal membuat user")}`);
  }

  // Trigger on_auth_user_created sudah membuat row profiles default.
  // Update role & gudang sesuai input admin.
  const { error: updateError } = await admin
    .from("profiles")
    .update({ role, assigned_warehouse_id: warehouseId, full_name: fullName })
    .eq("id", created!.user!.id);

  if (updateError) {
    redirect(`/admin/users?error=${encodeURIComponent(updateError.message)}`);
  }

  redirect("/admin/users?success=1");
}

async function updateUserRole(formData: FormData) {
  "use server";
  const actor = await getCurrentProfile();
  if (!actor || !["admin", "super_admin"].includes(actor.role)) {
    throw new Error("Tidak diizinkan");
  }

  const userId = formData.get("user_id") as string;
  const role = formData.get("role") as string;
  const warehouseId = (formData.get("warehouse_id") as string) || null;
  const isActive = formData.get("is_active") === "on";

  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role, assigned_warehouse_id: warehouseId, is_active: isActive })
    .eq("id", userId);

  if (error) redirect(`/admin/users?error=${encodeURIComponent(error.message)}`);
  redirect("/admin/users?success=1");
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { success?: string; error?: string };
}) {
  const supabase = createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active, warehouses:assigned_warehouse_id(name), assigned_warehouse_id")
    .order("created_at", { ascending: false });

  const { data: warehouses } = await supabase.from("warehouses").select("id, name").eq("is_active", true);

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">Kelola User & Role</h1>
        <p className="text-slate-500 text-sm mt-1">
          Registrasi user baru dan atur tingkatan role serta gudang yang bisa diakses.
        </p>
      </div>

      {searchParams.success && (
        <div className="bg-green-50 text-green-700 border border-green-100 rounded-lg px-3 py-2 text-sm">Berhasil disimpan.</div>
      )}
      {searchParams.error && (
        <div className="bg-red-50 text-red-700 border border-red-100 rounded-lg px-3 py-2 text-sm">Gagal: {searchParams.error}</div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="font-medium mb-4">Registrasi User Baru</h2>
        <form action={registerUser} className="grid grid-cols-2 gap-4">
          <Field label="Nama Lengkap"><input name="full_name" className="input" required /></Field>
          <Field label="Email"><input type="email" name="email" className="input" required /></Field>
          <Field label="Password Sementara"><input type="text" name="temp_password" className="input" required minLength={8} /></Field>
          <Field label="Role">
            <select name="role" className="input" required>
              <option value="staff_gudang">Staff Gudang</option>
              <option value="staff_marketplace">Staff Marketplace</option>
              <option value="admin">Admin</option>
              <option value="owner_viewer">Owner (Viewer)</option>
            </select>
          </Field>
          <Field label="Gudang (untuk Staff Gudang/Marketplace)">
            <select name="warehouse_id" className="input">
              <option value="">-</option>
              {warehouses?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </Field>
          <div className="col-span-2">
            <button className="bg-brand-600 text-white text-sm rounded-lg px-5 py-2.5">Daftarkan User</button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Gudang</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ubah</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u: any) => {
              const formId = `form-user-${u.id}`;
              return (
                <tr key={u.id} className="border-t border-slate-100">
                  {/* form kosong tanpa isi visual — input/select/button di tiap <td> terhubung lewat atribut form={formId} */}
                  <td className="px-4 py-2.5">
                    <form id={formId} action={updateUserRole} />
                    <input type="hidden" name="user_id" value={u.id} form={formId} />
                    {u.full_name}
                  </td>
                  <td className="px-4 py-2.5">
                    <select name="role" form={formId} defaultValue={u.role} className="rounded-md border border-slate-300 text-xs px-2 py-1">
                      <option value="staff_gudang">Staff Gudang</option>
                      <option value="staff_marketplace">Staff Marketplace</option>
                      <option value="admin">Admin</option>
                      <option value="owner_viewer">Owner (Viewer)</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <select name="warehouse_id" form={formId} defaultValue={u.assigned_warehouse_id ?? ""} className="rounded-md border border-slate-300 text-xs px-2 py-1">
                      <option value="">-</option>
                      {warehouses?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <label className="flex items-center gap-1 text-xs">
                      <input type="checkbox" name="is_active" form={formId} defaultChecked={u.is_active} /> Aktif
                    </label>
                  </td>
                  <td className="px-4 py-2.5">
                    <button form={formId} className="text-brand-600 text-xs font-medium">Simpan</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
