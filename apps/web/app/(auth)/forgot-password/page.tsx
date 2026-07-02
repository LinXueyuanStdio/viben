import { ForgotPasswordPageContent } from '@/components/auth/forgot-password-page-content';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Forgot Password',
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordPageContent />;
}
