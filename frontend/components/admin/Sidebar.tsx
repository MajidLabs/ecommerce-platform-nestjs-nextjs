'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingCart,
  Users,
  Ticket,
  BarChart3,
  ArrowLeft,
} from 'lucide-react';

const items = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/inventory', label: 'Inventory', icon: Boxes },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/admin/customers', label: 'Customers', icon: Users },
  { href: '/admin/coupons', label: 'Coupons', icon: Ticket },
  { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-line/20 bg-ink text-paper">
      <div className="px-5 py-6">
        <Link href="/" className="flex items-center gap-2 text-sm text-paper/70 hover:text-paper">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to store
        </Link>
        <p className="mt-4 font-display text-lg">Admin</p>
      </div>

      <nav className="flex-1 px-3">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mb-1 flex items-center gap-3 rounded px-3 py-2.5 text-sm transition-colors ${
                active ? 'bg-paper/10 text-paper' : 'text-paper/60 hover:bg-paper/5 hover:text-paper'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
