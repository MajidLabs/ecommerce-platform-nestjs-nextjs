'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Invalid email or password');
        return;
      }
      // Full page navigation (not router.push) so the browser has fully
      // committed the login response's Set-Cookie before the next page's
      // Header mounts and reads it — a client-side route transition can
      // render Header before the cookie is guaranteed visible.
      window.location.href = searchParams.get('next') || '/';
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-12">
      <h1 className="font-display text-2xl">Sign in</h1>
      <p className="mt-1 text-sm text-muted">
        Demo account: <span className="tabular-nums">customer@example.com</span> /{' '}
        <span className="tabular-nums">Customer@12345</span>
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-brick">{error}</p>}
        <Button type="submit" loading={loading} className="mt-2">
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted">
        No account?{' '}
        <Link href="/register" className="text-ink underline hover:text-signal">
          Create one
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}