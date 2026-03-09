import { HomePage } from './components/home-page';

// Force dynamic rendering to avoid SSG timeout with client-side i18n
export const dynamic = 'force-dynamic';

export default function Page() {
  return <HomePage />;
}
