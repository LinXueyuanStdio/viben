import { RegisterPageContent } from '@/components/auth/register-page-content';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Sign Up',
};

export default function RegisterPage() {
  return <RegisterPageContent />;
}
