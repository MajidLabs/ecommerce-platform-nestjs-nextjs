'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { Select } from '@/components/ui/Select';
import type { Paginated, Role, User } from '@/lib/types';

const ROLES: Role[] = ['CUSTOMER', 'STAFF', 'ADMIN'];

export default function AdminCustomersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const data = await api.get<Paginated<User>>('/users?limit=100');
    setUsers(data.items);
    setLoading(false);
  }

  async function updateRole(id: string, role: Role) {
    setSavingId(id);
    try {
      await api.patch(`/users/${id}/role`, { role });
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <p className="text-muted">Loading…</p>;

  return (
    <div>
      <h1 className="font-display text-2xl">Customers</h1>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <th className="pb-3 font-medium">Name</th>
            <th className="pb-3 font-medium">Email</th>
            <th className="pb-3 font-medium">Joined</th>
            <th className="pb-3 font-medium">Role</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-line/60 hover:bg-line/10">
              <td className="py-3 font-medium">
                {u.firstName} {u.lastName}
              </td>
              <td className="py-3 text-muted">{u.email}</td>
              <td className="py-3 text-muted">{formatDate(u.createdAt)}</td>
              <td className="py-3">
                <Select
                  value={u.role}
                  disabled={savingId === u.id}
                  onChange={(e) => updateRole(u.id, e.target.value as Role)}
                  className="w-32"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
