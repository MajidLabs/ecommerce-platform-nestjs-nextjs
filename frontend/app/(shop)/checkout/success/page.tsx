import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: { orderId?: string };
}) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <CheckCircle2 className="mx-auto h-12 w-12 text-signal" />
      <h1 className="mt-5 font-display text-2xl">Order placed</h1>
      <p className="mt-2 text-muted">
        Thanks — we've received your order
        {searchParams.orderId && (
          <>
            {' '}
            (<span className="font-mono text-sm">{searchParams.orderId.slice(0, 8)}</span>)
          </>
        )}
        . A confirmation will show up in your order history shortly.
      </p>
      <Link href="/account/orders">
        <Button className="mt-8">View my orders</Button>
      </Link>
    </div>
  );
}
