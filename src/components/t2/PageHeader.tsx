// t2/PageHeader — page title + subtitle with an optional right-aligned action
// slot (§14, D-14C2-13). Presentational only.
import { type FC, type ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  right?: ReactNode; // optional actions (buttons, filters) aligned to the right
}

export const PageHeader: FC<PageHeaderProps> = ({ title, subtitle, right }) => (
  <div className="flex items-start justify-between gap-4">
    <div className="min-w-0">
      <h1 className="text-[26px] font-semibold tracking-[-0.025em] text-gray-900">
        {title}
      </h1>
      {subtitle && <p className="mt-1 text-[14.5px] text-gray-500">{subtitle}</p>}
    </div>
    {right && <div className="shrink-0">{right}</div>}
  </div>
);
