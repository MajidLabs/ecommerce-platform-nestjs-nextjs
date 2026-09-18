'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
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
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Could not create account');
        return;
      }
      router.push('/');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-12">
      <h1 className="font-display text-2xl">Create account</h1>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="First name"
            required
            value={form.firstName}
            onChange={(e) => set('firstName', e.target.value)}
          />
          <Input
            label="Last name"
            required
            value={form.lastName}
            onChange={(e) => set('lastName', e.target.value)}
          />
        </div>
        <Input
          label="Email"
          type="email"
          required
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
        />
        <Input
          label="Password"
          type="password"
          required
          minLength={8}
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
        />
        {error && <p className="text-sm text-brick">{error}</p>}
        <Button type="submit" loading={loading} className="mt-2">
          Create account
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="text-ink underline hover:text-signal">
          Sign in
        </Link>
      </p>
    </div>
  );
}
