import { type FC } from 'react';
import { Link } from 'react-router-dom';
import { directionLabel, taxKindLabel } from '@/components/internal/taxReviewLabels';
import {
  CenteredSpinner,
  EmptyState,
  ErrorBanner,
  PageContainer,
  Pill,
  SectionCard,
  formatAge,
} from '@/components/internal/ui';
import { useOrgsList } from '@/hooks/useInternalAdmin';
import { type TaxReviewRow, useStaffTaxReviewList } from '@/hooks/useStaffTaxReview';

/**
 * Tax review — the list (S98 P1d item 3). STAFF ONLY: the bank rows that wait
 * for a tax decision, as the server lists them with tax_review=1. Every value
 * is the server's own: the amount is its string, shown as sent. A row opens
 * its tax-review file, where the decision is made.
 */

const pagerCls =
  'rounded-md border border-white/15 px-3 py-1.5 text-white/80 hover:bg-white/5 disabled:opacity-40';

export const TAX_REVIEW_EMPTY = 'No bank rows are waiting for a tax decision.';

// The feed's name and the last four digits of its mask, never more.
const feedLabel = (row: TaxReviewRow): string => {
  const name = row.bank_account_name ?? '—';
  const lastFour = row.feed_mask ? row.feed_mask.slice(-4) : '';
  return lastFour ? `${name} ····${lastFour}` : name;
};

export const InternalTaxReview: FC = () => {
  const { items, count, page, setPage, pageSize, isLoading, error, refetch } =
    useStaffTaxReviewList();
  const { data: orgs } = useOrgsList();
  // A viewer of one org needs no Org column.
  const spansOrgs = orgs.length > 1;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <PageContainer
      wide
      title="Tax review"
      subtitle={
        isLoading
          ? 'Loading…'
          : `${count} bank ${count === 1 ? 'row' : 'rows'} waiting for a tax decision.`
      }
    >
      {error && <ErrorBanner message={error} onRetry={refetch} />}

      {isLoading ? (
        <SectionCard>
          <CenteredSpinner label="Loading tax review…" />
        </SectionCard>
      ) : items.length === 0 ? (
        !error && (
          <SectionCard>
            <EmptyState title={TAX_REVIEW_EMPTY} />
          </SectionCard>
        )
      ) : (
        <SectionCard className="overflow-hidden" title={`Tax review (${count})`}>
          <div className="overflow-x-auto -m-5">
            <table className="w-full min-w-[64rem] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-white/30 border-b border-white/10">
                  <th className="py-2 px-5 font-medium">Date</th>
                  {spansOrgs && <th className="py-2 px-3 font-medium">Org</th>}
                  <th className="py-2 px-3 font-medium">Feed</th>
                  <th className="py-2 px-3 font-medium text-right">Amount</th>
                  <th className="py-2 px-3 font-medium">Kinds</th>
                  <th className="py-2 px-3 font-medium">Held since</th>
                  <th className="py-2 px-3 font-medium">Receipt</th>
                  <th className="py-2 px-5 font-medium">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const evidence = row.tax_evidence_summary ?? '';
                  return (
                    <tr key={row.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-2.5 px-5 whitespace-nowrap">
                        <Link
                          to={`/internal/tax-review/${row.id}`}
                          className="text-[#4DA6FF] hover:underline"
                          aria-label={`Open the tax-review file of ${row.date}, ${row.amount} ${row.currency}`}
                        >
                          {row.date}
                        </Link>
                      </td>
                      {spansOrgs && (
                        <td className="py-2.5 px-3 text-white/70 truncate max-w-[10rem]">
                          {row.org_name ?? '—'}
                          {row.org_id && (
                            <span className="ml-2 font-mono text-xs text-white/40">
                              {row.org_id.slice(0, 8)}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="py-2.5 px-3 text-white/70">
                        <span className="block max-w-[14rem] truncate" title={feedLabel(row)}>
                          {feedLabel(row)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <span className="text-xs text-white/40">{directionLabel(row.direction)}</span>{' '}
                        <span className="text-white/90 tabular-nums">{`${row.amount} ${row.currency}`}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="flex flex-wrap gap-1">
                          {(row.tax_condition_kinds ?? []).map((kind) => (
                            <Pill key={kind} tone="warning">
                              {taxKindLabel(kind)}
                            </Pill>
                          ))}
                        </span>
                      </td>
                      <td
                        className="py-2.5 px-3 text-white/70 whitespace-nowrap"
                        title={row.tax_condition_raised_at ?? undefined}
                      >
                        {row.tax_condition_raised_at
                          ? `${row.tax_condition_raised_at.slice(0, 10)} (${formatAge(row.tax_condition_raised_at)})`
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-white/70">
                        {row.tax_matched_document_id != null ? 'Yes' : 'No'}
                      </td>
                      <td className="py-2.5 px-5 w-full max-w-0">
                        {evidence ? (
                          <span className="block truncate text-white/60" title={evidence}>
                            {evidence}
                          </span>
                        ) : (
                          <span className="text-white/30">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {count > pageSize && (
        <div className="flex items-center justify-between text-sm text-white/60">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className={pagerCls}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className={pagerCls}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </PageContainer>
  );
};
