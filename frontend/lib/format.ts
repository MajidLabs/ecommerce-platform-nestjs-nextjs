export function formatCurrency(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(n);
}

export function formatDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

export function formatDateTime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

// Product.images stores backend-relative paths (e.g. "/uploads/products/x.jpg")
// so the data itself stays portable across environments (dev/staging/prod
// each have a different backend origin). Rendering it as-is in an <img src>
// would resolve against the *frontend's* origin instead — the file only
// actually lives on the backend, which serves it via ServeStaticModule. This
// prefixes the stored path with the backend's public origin at render time.
// Already-absolute URLs (e.g. https://cdn.example.com/x.jpg, for anyone who
// swaps in S3/a CDN later) pass through unchanged.
export function resolveImageUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const backendOrigin = (
    process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000/api/v1'
  ).replace(/\/api\/v1\/?$/, '');
  return `${backendOrigin}${path}`;
}
