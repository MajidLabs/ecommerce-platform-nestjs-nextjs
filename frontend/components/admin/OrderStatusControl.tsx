'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import type { OrderStatus } from '@/lib/types';

const STATUSES: OrderStatus[] = [
  'PENDING',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
];

export function OrderStatusControl({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: OrderStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);

  async function handleUpdate() {
    setLoading(true);
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-end gap-3">
      <Select
        label="Status"
        value={status}
        onChange={(e) => setStatus(e.target.value as OrderStatus)}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>
      <Button size="sm" loading={loading} disabled={status === currentStatus} onClick={handleUpdate}>
        Update
      </Button>
    </div>
  );
}
