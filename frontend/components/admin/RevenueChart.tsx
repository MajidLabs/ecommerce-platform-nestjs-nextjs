'use client';

import { useState } from 'react';
import { formatCurrency, formatDate } from '@/lib/format';
import type { RevenuePoint } from '@/lib/types';

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) {
    return <p className="py-16 text-center text-sm text-muted">No revenue in this period yet.</p>;
  }

  const max = Math.max(...data.map((d) => d.revenue), 1);
  const barWidth = 100 / data.length;

  return (
    <div>
      <div className="relative flex h-48 items-end gap-[2px]">
        {data.map((point, i) => {
          const height = Math.max((point.revenue / max) * 100, 2);
          return (
            <div
              key={point.date}
              className="group relative flex-1"
              style={{ height: '100%' }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div className="flex h-full items-end">
                <div
                  className={`w-full rounded-t-sm transition-colors ${
                    hover === i ? 'bg-signal' : 'bg-signal/40'
                  }`}
                  style={{ height: `${height}%` }}
                />
              </div>
              {hover === i && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-ink px-2.5 py-1.5 text-xs text-paper">
                  <p className="font-medium">{formatCurrency(point.revenue)}</p>
                  <p className="text-paper/60">{formatDate(point.date)}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted">
        <span>{formatDate(data[0].date)}</span>
        <span>{formatDate(data[data.length - 1].date)}</span>
      </div>
    </div>
  );
}
