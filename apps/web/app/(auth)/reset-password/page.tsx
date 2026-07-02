import { ResetPasswordPageContent } from '@/components/auth/reset-password-page-content';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Reset Password',
};

export default function ResetPasswordPage() {
  return <ResetPasswordPageContent />;
}
