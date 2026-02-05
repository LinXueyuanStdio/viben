import Link from 'next/link';
import { Package } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <Package className="h-8 w-8 text-primary" />
        <span className="font-serif text-2xl font-semibold">Viben</span>
      </Link>
      {children}
    </div>
  );
}
