import { ApiKeyManagement } from '@/components/admin/api-keys';

export const metadata = {
  title: 'API 密钥管理',
};

export default function ApiKeysPage() {
  return <ApiKeyManagement />;
}
