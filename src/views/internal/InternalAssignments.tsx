import { type FC } from 'react';
import { PageContainer, SectionCard } from '@/components/internal/ui';

// Commit 1 stub — reviewer↔org assignments land in commit 3 (super-user only).
export const InternalAssignments: FC = () => (
  <PageContainer title="Assignments" subtitle="Reviewer access to client organizations.">
    <SectionCard>
      <p className="text-sm text-white/50">Loading assignments…</p>
    </SectionCard>
  </PageContainer>
);
