import { readFileSync } from 'fs';
import { join } from 'path';
import { LegalPageContent } from '@/components/legal/legal-page-content';

export const metadata = {
  title: 'Privacy Statement',
};

export default function PrivacyPage() {
  const filePath = join(process.cwd(), 'content', 'privacy-statement.md');
  const content = readFileSync(filePath, 'utf-8');

  return <LegalPageContent content={content} />;
}
