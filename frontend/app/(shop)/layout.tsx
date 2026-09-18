import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="mx-auto min-h-[70vh] max-w-6xl px-6 py-10">{children}</main>
      <Footer />
    </>
  );
}
