'use client';
import { useState, useTransition } from 'react';
import { createUser } from '@/app/actions/users';
import type { Supplier } from '@/lib/types';

// Admin-only user creation. Suppliers must be linked to a supplier record.
export function CreateUserForm({ suppliers }: { suppliers: Supplier[] }) {
  const [role, setRole] = useState<'admin' | 'staff' | 'supplier'>('staff');
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);

  return (
    <form className="card p-4 grid md:grid-cols-3 gap-3 items-end" onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const form = e.currentTarget;
      start(async () => {
        const res = await createUser(fd);
        if (res.error) setMsg({ ok: false, text: res.error });
        else { setMsg({ ok: true, text: 'User created.' }); form.reset(); setRole('staff'); }
      });
    }}>
      <div><label className="label">Full name</label><input name="full_name" className="input" /></div>
      <div><label className="label">Email</label><input name="email" type="email" className="input" required /></div>
      <div><label className="label">Temporary password</label><input name="password" type="text" className="input" required minLength={8} /></div>
      <div><label className="label">Role</label>
        <select name="role" className="input" value={role} onChange={(e) => setRole(e.target.value as any)}>
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
          <option value="supplier">Supplier</option>
        </select>
      </div>
      {role === 'supplier' && (
        <div><label className="label">Linked supplier</label>
          <select name="supplier_id" className="input" required>
            <option value="">Select supplier…</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}
      <button className="btn-primary" disabled={pending}>{pending ? 'Creating…' : 'Create user'}</button>
      {msg && <p className={`md:col-span-3 text-sm ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</p>}
    </form>
  );
}
