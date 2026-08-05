'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { NotFoundContent } from '@/components/not-found-content';

export default function NotFound() {
  return (
    <DashboardShell>
      <NotFoundContent />
    </DashboardShell>
  );
}
