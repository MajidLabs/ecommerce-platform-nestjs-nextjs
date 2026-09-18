import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Northfield — everyday goods, honestly stocked',
  description: 'A demo e-commerce storefront.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
