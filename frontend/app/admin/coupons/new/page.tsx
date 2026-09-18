'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';

export default function NewCouponPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    code: '',
    type: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED_AMOUNT',
    value: '',
    minOrderAmount: '',
    maxDiscountAmount: '',
    usageLimit: '',
    validUntil: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/coupons', {
        code: form.code,
        type: form.type,
        value: Number(form.value),
        minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : undefined,
        maxDiscountAmount: form.maxDiscountAmount ? Number(form.maxDiscountAmount) : undefined,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
        validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : undefined,
      });
      router.push('/admin/coupons');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create coupon');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl">New coupon</h1>
      <form onSubmit={handleSubmit} className="mt-6 flex max-w-md flex-col gap-4">
        <Input
          label="Code"
          required
          value={form.code}
          onChange={(e) => set('code', e.target.value.toUpperCase())}
          placeholder="SUMMER20"
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Type"
            value={form.type}
            onChange={(e) => set('type', e.target.value)}
          >
            <option value="PERCENTAGE">Percentage</option>
            <option value="FIXED_AMOUNT">Fixed amount</option>
          </Select>
          <Input
            label={form.type === 'PERCENTAGE' ? 'Value (%)' : 'Value (USD)'}
            type="number"
            step="0.01"
            required
            value={form.value}
            onChange={(e) => set('value', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Min. order amount"
            type="number"
            step="0.01"
            value={form.minOrderAmount}
            onChange={(e) => set('minOrderAmount', e.target.value)}
          />
          {form.type === 'PERCENTAGE' && (
            <Input
              label="Max discount cap"
              type="number"
              step="0.01"
              value={form.maxDiscountAmount}
              onChange={(e) => set('maxDiscountAmount', e.target.value)}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Usage limit"
            type="number"
            value={form.usageLimit}
            onChange={(e) => set('usageLimit', e.target.value)}
          />
          <Input
            label="Expires"
            type="date"
            value={form.validUntil}
            onChange={(e) => set('validUntil', e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-brick">{error}</p>}

        <Button type="submit" loading={loading} className="mt-2">
          Create coupon
        </Button>
      </form>
    </div>
  );
}
