import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { Sidebar } from '@/components/admin/Sidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Middleware already blocks non-admin/staff at the edge; this is a second,
  // server-side check in case someone reaches a Server Component render
  // path that bypasses it (defense in depth, not the primary gate).
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'STAFF')) {
    redirect('/');
  }

  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar />
      <div className="flex-1 overflow-x-hidden px-10 py-8">{children}</div>
    </div>
  );
}
