import type { LucideIcon } from 'lucide-react';

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: 'default' | 'brick';
}) {
  return (
    <div className="rounded border border-line bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        <Icon className={`h-4 w-4 ${tone === 'brick' ? 'text-brick' : 'text-signal'}`} />
      </div>
      <p className="mt-2 font-display text-2xl tabular-nums">{value}</p>
    </div>
  );
}
