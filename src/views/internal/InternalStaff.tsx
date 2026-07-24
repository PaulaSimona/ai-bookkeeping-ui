import { type FC } from 'react';
import { PageContainer, SectionCard } from '@/components/internal/ui';

// Commit 1 stub — staff administration lands in commit 3 (super-user only).
export const InternalStaff: FC = () => (
  <PageContainer title="Staff" subtitle="Internal reviewer accounts.">
    <SectionCard>
      <p className="text-sm text-white/50">Loading staff…</p>
    </SectionCard>
  </PageContainer>
);
