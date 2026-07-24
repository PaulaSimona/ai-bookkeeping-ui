import { type FC } from 'react';
import { PageContainer, SectionCard } from '@/components/internal/ui';

// Commit 1 stub — assigned-clients view lands in commit 2.
export const InternalClients: FC = () => (
  <PageContainer title="Assigned clients" subtitle="Client organizations you review.">
    <SectionCard>
      <p className="text-sm text-white/50">Loading assigned clients…</p>
    </SectionCard>
  </PageContainer>
);
