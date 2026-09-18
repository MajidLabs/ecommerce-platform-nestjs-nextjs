'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useTransition, useEffect } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import type { Category } from '@/lib/types';

export function Filters({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(searchParams.get('search') || '');

  useEffect(() => {
    setSearch(searchParams.get('search') || '');
  }, [searchParams]);

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page');
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    update('search', search);
  }

  return (
    <div className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${isPending ? 'opacity-60' : ''}`}>
      <form onSubmit={onSearchSubmit} className="flex-1 max-w-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products"
            className="pl-9"
          />
        </div>
      </form>

      <div className="flex flex-wrap items-end gap-3">
        <Select
          value={searchParams.get('category') || ''}
          onChange={(e) => update('category', e.target.value)}
          className="min-w-[10rem]"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </Select>

        <Select
          value={searchParams.get('sort') || 'newest'}
          onChange={(e) => update('sort', e.target.value)}
          className="min-w-[9rem]"
        >
          <option value="newest">Newest</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </Select>

        <div className="flex items-center gap-2 text-muted">
          <SlidersHorizontal className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
