import Link from 'next/link';
import { getSession } from '@/lib/auth/cookies';
import { UserMenu } from '@/components/layout/user-menu';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { Button } from '@/components/ui/button';

export async function Header() {
  const session = await getSession();

  return (
    <header className="flex h-16 items-center justify-between border-b px-6">
      <div>{/* Breadcrumbs or search could go here */}</div>

      <div className="flex items-center gap-4">
        <LanguageSwitcher />
        <ThemeToggle />
        {session ? (
          <UserMenu session={session} />
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Sign up</Link>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
