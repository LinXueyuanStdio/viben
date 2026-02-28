import Link from 'next/link';
import { VibenLogo } from '@/components/shared/viben-logo';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <VibenLogo size={32} />
        <span className="font-serif text-2xl font-semibold">Viben</span>
      </Link>
      {children}
    </div>
  );
}
