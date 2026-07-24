import { type FC } from 'react';
import { PageContainer, SectionCard } from '@/components/internal/ui';

// Commit 1 stub — the pending review queue + detail pane lands in commit 2.
export const InternalQueue: FC = () => (
  <PageContainer title="Pending queue" subtitle="Journal entries awaiting review.">
    <SectionCard>
      <p className="text-sm text-white/50">Loading the review queue…</p>
    </SectionCard>
  </PageContainer>
);
