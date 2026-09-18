'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';

interface InventoryRow {
  id: string;
  productId: string;
  quantity: number;
  reserved: number;
  reorderLevel: number;
  product: { id: string; name: string; slug: string };
}

const MOVEMENT_TYPES = ['RESTOCK', 'ADJUSTMENT', 'RETURN'] as const;

export default function InventoryPage() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const data = await api.get<InventoryRow[]>('/inventory');
    setRows(data);
    setLoading(false);
  }

  if (loading) return <p className="text-muted">Loading…</p>;

  return (
    <div>
      <h1 className="font-display text-2xl">Inventory</h1>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <th className="pb-3 font-medium">Product</th>
            <th className="pb-3 font-medium text-right">On hand</th>
            <th className="pb-3 font-medium text-right">Reserved</th>
            <th className="pb-3 font-medium text-right">Available</th>
            <th className="pb-3 font-medium text-right">Reorder at</th>
            <th className="pb-3 font-medium" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const available = row.quantity - row.reserved;
            const low = available <= row.reorderLevel;
            return (
              <>
                <tr key={row.id} className="border-b border-line/60 hover:bg-line/10">
                  <td className="py-3 font-medium">
                    {low && <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5 text-brick" />}
                    {row.product.name}
                  </td>
                  <td className="py-3 text-right tabular-nums">{row.quantity}</td>
                  <td className="py-3 text-right tabular-nums text-muted">{row.reserved}</td>
                  <td className={`py-3 text-right tabular-nums ${low ? 'text-brick' : ''}`}>
                    {available}
                  </td>
                  <td className="py-3 text-right tabular-nums text-muted">{row.reorderLevel}</td>
                  <td className="py-3 text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setOpenId(openId === row.id ? null : row.id)}
                    >
                      Adjust
                    </Button>
                  </td>
                </tr>
                {openId === row.id && (
                  <tr className="border-b border-line/60 bg-line/5">
                    <td colSpan={6} className="py-4">
                      <AdjustForm
                        productId={row.productId}
                        onDone={() => {
                          setOpenId(null);
                          load();
                        }}
                      />
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AdjustForm({ productId, onDone }: { productId: string; onDone: () => void }) {
  const [quantityChange, setQuantityChange] = useState('');
  const [type, setType] = useState<(typeof MOVEMENT_TYPES)[number]>('RESTOCK');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.patch(`/inventory/product/${productId}/adjust`, {
        quantityChange: Number(quantityChange),
        type,
        reason: reason || undefined,
      });
      onDone();
    } catch {
      setError('Could not apply adjustment');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3 pl-1">
      <Input
        label="Change (+/-)"
        type="number"
        required
        value={quantityChange}
        onChange={(e) => setQuantityChange(e.target.value)}
        className="w-32"
        placeholder="e.g. 20 or -5"
      />
      <Select label="Type" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
        {MOVEMENT_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </Select>
      <Input
        label="Reason (optional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-56"
      />
      <Button type="submit" size="sm" loading={loading}>
        Apply
      </Button>
      {error && <span className="text-sm text-brick">{error}</span>}
    </form>
  );
}
