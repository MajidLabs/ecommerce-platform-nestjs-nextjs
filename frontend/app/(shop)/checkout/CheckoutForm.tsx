'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { getStripe } from '@/lib/stripe';
import { api, ApiError } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/format';
import type { Order } from '@/lib/types';

type Step = 'shipping' | 'payment';

export default function CheckoutForm() {
  const [step, setStep] = useState<Step>('shipping');
  const [order, setOrder] = useState<Order | null>(null);
  const [clientSecret, setClientSecret] = useState('');
  const [shipping, setShipping] = useState({
    shippingLine1: '',
    shippingCity: '',
    shippingState: '',
    shippingPostal: '',
    shippingCountry: 'US',
  });
  const [couponCode, setCouponCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function setField<K extends keyof typeof shipping>(key: K, value: string) {
    setShipping((s) => ({ ...s, [key]: value }));
  }

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const createdOrder = await api.post<Order>('/orders', {
        ...shipping,
        couponCode: couponCode || undefined,
      });
      const { clientSecret: secret } = await api.post<{ clientSecret: string }>(
        `/payments/intent/${createdOrder.id}`,
      );
      setOrder(createdOrder);
      setClientSecret(secret);
      setStep('payment');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create order');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'payment' && clientSecret && order) {
    return (
      <Elements
        stripe={getStripe()}
        options={{ clientSecret, appearance: { variables: { colorPrimary: '#2B5D4F' } } }}
      >
        <PaymentStep order={order} />
      </Elements>
    );
  }

  return (
    <form onSubmit={handleCreateOrder} className="max-w-lg">
      <h2 className="font-display text-xl">Shipping address</h2>
      <div className="mt-5 flex flex-col gap-4">
        <Input
          label="Address"
          required
          value={shipping.shippingLine1}
          onChange={(e) => setField('shippingLine1', e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="City"
            required
            value={shipping.shippingCity}
            onChange={(e) => setField('shippingCity', e.target.value)}
          />
          <Input
            label="State / region"
            value={shipping.shippingState}
            onChange={(e) => setField('shippingState', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Postal code"
            required
            value={shipping.shippingPostal}
            onChange={(e) => setField('shippingPostal', e.target.value)}
          />
          <Input
            label="Country"
            required
            value={shipping.shippingCountry}
            onChange={(e) => setField('shippingCountry', e.target.value)}
          />
        </div>

        <Input
          label="Coupon code (optional)"
          placeholder="WELCOME10"
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
        />

        {error && <p className="text-sm text-brick">{error}</p>}

        <Button type="submit" loading={loading} className="mt-2">
          Continue to payment
        </Button>
      </div>
    </form>
  );
}

function PaymentStep({ order }: { order: Order }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError('');

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/success?orderId=${order.id}`,
      },
    });

    if (confirmError) {
      setError(confirmError.message || 'Payment failed');
      setLoading(false);
    }
    // On success Stripe redirects to return_url automatically.
  }

  return (
    <form onSubmit={handlePay} className="max-w-lg">
      <h2 className="font-display text-xl">Payment</h2>
      <p className="mt-1 text-sm text-muted">
        Test mode — use card{' '}
        <span className="tabular-nums text-ink">4242 4242 4242 4242</span>, any future date,
        any CVC.
      </p>

      <div className="mt-5">
        <PaymentElement />
      </div>

      <div className="mt-5 flex items-baseline justify-between border-t border-line pt-4">
        <span className="text-sm text-muted">Total</span>
        <span className="text-lg tabular-nums">{formatCurrency(order.totalAmount)}</span>
      </div>

      {error && <p className="mt-3 text-sm text-brick">{error}</p>}

      <Button type="submit" loading={loading} disabled={!stripe} className="mt-5 w-full">
        Pay {formatCurrency(order.totalAmount)}
      </Button>
    </form>
  );
}
