import { readFileSync } from 'fs';
import { join } from 'path';
import { LegalPageContent } from '@/components/legal/legal-page-content';

export const metadata = {
  title: 'Terms of Service',
};

export default function TermsPage() {
  const filePath = join(process.cwd(), 'content', 'terms-of-service.md');
  const content = readFileSync(filePath, 'utf-8');

  return <LegalPageContent content={content} />;
}
