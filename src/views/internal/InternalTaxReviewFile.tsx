import { type FC, type ReactNode, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ReceiptViewer } from '@/components/internal/ReceiptViewer';
import { TaxDecisionForm } from '@/components/internal/TaxDecisionForm';
import { directionLabel, taxKindLabel } from '@/components/internal/taxReviewLabels';
import {
  CenteredSpinner,
  ErrorBanner,
  PageContainer,
  Pill,
  SectionCard,
  humanizeCode,
} from '@/components/internal/ui';
import {
  type TaxCondition,
  type TaxDecisionPlan,
  type TaxGuardCheck,
  type TaxPeriod,
  type TaxReviewEntry,
  type TaxReviewFile,
  useStaffTaxReviewFile,
} from '@/hooks/useStaffTaxReview';
import { formatEntryNumber } from '@/utils/entryStatus';

/**
 * Tax review — one bank row's file (S98 P1d item 4). STAFF ONLY.
 *
 * Everything on this page is the server's file, shown as sent: amounts are
 * its strings, the org is its org_id, and nothing is worked out here. Each
 * read of the file is audited by the server and signs a new receipt link, so
 * the file is read once when the page opens and again only when staff ask.
 * A row that is not in tax review is shown read-only: the decision form is
 * there only while the server says the row is in tax review.
 */

export const TAX_FILE_GONE = 'This bank row is gone, or it is not one you can review.';
export const TAX_FILE_NOT_IN_REVIEW = 'Not in tax review';
export const TAX_FILE_DECIDED = 'Decision recorded.';

const labelCls = 'text-[11px] uppercase tracking-wide text-white/30';
const thCls = 'py-2 px-3 font-medium';
const headRowCls =
  'text-left text-[11px] uppercase tracking-wide text-white/30 border-b border-white/10';

const ENTRY_ROLES = new Map<string, string>([
  ['bank_draft', 'Bank draft'],
  ['correction', 'Correction'],
  ['adjustment', 'Tax adjustment'],
  ['reclassification', 'Reclassification'],
  ['reversal', 'Reversal'],
]);
const entryRoleLabel = (role: string): string => ENTRY_ROLES.get(role) ?? humanizeCode(role);

const Detail: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div>
    <dt className={labelCls}>{label}</dt>
    <dd className="text-white/80 break-words">{children}</dd>
  </div>
);

const dash = (value: string | number | null | undefined): string =>
  value == null || value === '' ? '—' : String(value);

// A value of unknown shape, exactly as the server sent it.
const Json: FC<{ value: unknown; label: string }> = ({ value, label }) => (
  <pre
    aria-label={label}
    className="max-h-64 overflow-auto rounded-md bg-black/30 p-2 text-xs text-white/70 whitespace-pre-wrap break-words"
  >
    {JSON.stringify(value ?? null, null, 2)}
  </pre>
);

const periodText = (period: TaxPeriod | null): string =>
  period ? `${period.label} (${period.start} to ${period.end}, ${period.frequency})` : '—';

const accountText = (code: string | null, name: string | null): string =>
  [code, name].filter(Boolean).join(' ') || '—';

const ConditionCard: FC<{ condition: TaxCondition }> = ({ condition }) => (
  <li className="rounded-lg border border-white/10 p-3 space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      <Pill tone={condition.status === 'open' ? 'warning' : 'neutral'}>
        {taxKindLabel(condition.kind)}
      </Pill>
      <span className="font-mono text-xs text-white/40">{condition.kind}</span>
      <span className="text-xs text-white/50">{humanizeCode(condition.status)}</span>
    </div>
    <dl className="grid grid-cols-2 gap-3 text-sm">
      <Detail label="Raised">{dash(condition.raised_at)}</Detail>
      <Detail label="Raised by">{dash(condition.raised_by)}</Detail>
      {condition.resolved_at && <Detail label="Resolved">{condition.resolved_at}</Detail>}
      {condition.resolved_by && <Detail label="Resolved by">{condition.resolved_by}</Detail>}
    </dl>
    <div>
      <p className={labelCls}>Evidence</p>
      <Json value={condition.evidence} label={`Evidence of ${condition.kind}`} />
    </div>
    {condition.resolution != null && (
      <div>
        <p className={labelCls}>Resolution</p>
        <Json value={condition.resolution} label={`Resolution of ${condition.kind}`} />
      </div>
    )}
  </li>
);

const GuardCheck: FC<{ name: string; check: TaxGuardCheck | null }> = ({ name, check }) => (
  <div className="space-y-1">
    <p className={labelCls}>{name}</p>
    {check ? (
      <>
        <p className="text-sm text-white/80">
          {check.allowed ? 'Allowed' : 'Held'}
          {check.hold_reason && (
            <span className="ml-2 font-mono text-xs text-white/50">{check.hold_reason}</span>
          )}
        </p>
        <Json value={check.evidence} label={`${name} evidence`} />
      </>
    ) : (
      <p className="text-sm text-white/50">Not run</p>
    )}
  </div>
);

const EntryCard: FC<{ entry: TaxReviewEntry }> = ({ entry }) => (
  <li className="rounded-lg border border-white/10 p-3 space-y-2" aria-label={`Entry ${entry.id}`}>
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-semibold text-white">{entryRoleLabel(entry.role)}</span>
      <span className="font-mono text-white/70">
        {formatEntryNumber(entry.entry_number) ?? 'No number'}
      </span>
      <span className="text-white/50">{dash(entry.entry_date)}</span>
      <Pill tone={entry.is_live ? 'success' : 'neutral'}>{entry.is_live ? 'Live' : 'Not live'}</Pill>
      <span className="text-xs text-white/50">{humanizeCode(entry.status)}</span>
      {/* Staff read the raw source: which route posted the entry. */}
      <span className="font-mono text-xs text-white/40">{entry.source}</span>
    </div>
    {entry.description && <p className="text-sm text-white/60">{entry.description}</p>}
    {(entry.corrects_entry_id || entry.reverses_entry_id) && (
      <p className="text-xs text-white/40">
        {entry.corrects_entry_id && (
          <span className="mr-3">
            Corrects <span className="font-mono">{entry.corrects_entry_id.slice(0, 8)}</span>
          </span>
        )}
        {entry.reverses_entry_id && (
          <span>
            Reverses <span className="font-mono">{entry.reverses_entry_id.slice(0, 8)}</span>
          </span>
        )}
      </p>
    )}
    <table className="w-full text-sm">
      <thead>
        <tr className={headRowCls}>
          <th className={thCls}>Account</th>
          <th className={`${thCls} text-right`}>Debit</th>
          <th className={`${thCls} text-right`}>Credit</th>
          <th className={thCls}>Job cost</th>
        </tr>
      </thead>
      <tbody>
        {entry.lines.map((line, index) => (
          // A chain entry's lines carry no id; their order is the server's.
          <tr key={index} className="border-b border-white/5">
            <td className="py-1.5 px-3 text-white/80">
              {accountText(line.account_code, line.account_name)}
            </td>
            <td className="py-1.5 px-3 text-right tabular-nums text-white/80">{dash(line.debit)}</td>
            <td className="py-1.5 px-3 text-right tabular-nums text-white/80">{dash(line.credit)}</td>
            <td className="py-1.5 px-3 text-white/50">
              {line.job_cost_category ? humanizeCode(line.job_cost_category) : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </li>
);

// What a confirmed decision posted, in the file's own entry numbers. The
// plan names entries by id; the number is read from the reloaded file's
// chain, and is left out until the chain carries the entry.
const DecidedNotice: FC<{ plan: TaxDecisionPlan; file: TaxReviewFile }> = ({ plan, file }) => {
  const numberOf = (entryId: string): string | null => {
    const entry = file.entry_chain.find((candidate) => candidate.id === entryId);
    return entry ? formatEntryNumber(entry.entry_number) : null;
  };
  const posted = plan.entry_id ? numberOf(plan.entry_id) : null;
  const reversal = plan.reversal_entry_id ? numberOf(plan.reversal_entry_id) : null;
  return (
    <div
      role="status"
      aria-label="Decision result"
      className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
    >
      {TAX_FILE_DECIDED}
      {plan.entry_id && (posted ? ` Entry ${posted} was posted.` : ' An entry was posted.')}
      {plan.reversal_entry_id &&
        (reversal
          ? ` Entry ${reversal} reversed the earlier adjustment.`
          : ' The earlier adjustment was reversed.')}
      {!plan.entry_id && !plan.reversal_entry_id && ' No entry was posted.'}
    </div>
  );
};

const FileSections: FC<{
  rowId: string;
  file: TaxReviewFile;
  reloading: boolean;
  onReload: () => void;
}> = ({ rowId, file, reloading, onReload }) => {
  const { bank_row: row, ticket, extraction, guard, dates } = file;
  const [decided, setDecided] = useState<TaxDecisionPlan | null>(null);
  // A confirmed decision starts the form again; a reload of the file (a new
  // receipt link) never does, so nothing the reviewer typed is lost to it.
  const [formEpoch, setFormEpoch] = useState(0);
  return (
    <>
      {decided && <DecidedNotice plan={decided} file={file} />}
      {!file.in_tax_review && (
        <div
          role="status"
          className="rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/80"
        >
          <p className="font-semibold text-white">{TAX_FILE_NOT_IN_REVIEW}</p>
          <p className="mt-1 text-white/60">
            This bank row has no open tax condition. The file is read-only.
          </p>
        </div>
      )}

      <SectionCard
        title="Bank row and ticket"
        actions={
          <Link
            to={`/internal/clients/${file.org_id}/account-purposes`}
            className="text-xs text-[#4DA6FF] hover:underline"
          >
            Account purposes of this client
          </Link>
        }
      >
        <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Detail label="Date">{row.date}</Detail>
          <Detail label="Amount">
            {directionLabel(row.direction)} <span className="tabular-nums">{row.amount}</span>
          </Detail>
          <Detail label="Bank text">{dash(row.description)}</Detail>
          <Detail label="Client">
            <span className="font-mono text-xs">{file.org_id.slice(0, 8)}</span>
          </Detail>
          <Detail label="Ticket">{ticket ? humanizeCode(ticket.status) : 'No ticket'}</Detail>
          <Detail label="Routing reason">
            {ticket?.routing_reason ? humanizeCode(ticket.routing_reason) : '—'}
          </Detail>
          <Detail label="Ticket adjustment entry">
            {ticket?.adjustment_entry_id ? (
              <span className="font-mono text-xs">{ticket.adjustment_entry_id.slice(0, 8)}</span>
            ) : (
              '—'
            )}
          </Detail>
        </dl>
      </SectionCard>

      <SectionCard
        title="Receipt"
        description={file.document_id != null ? `Document ${file.document_id}` : undefined}
      >
        <ReceiptViewer receipt={file.receipt} onReload={onReload} reloading={reloading} />
      </SectionCard>

      <SectionCard title="Extraction and guard decision">
        <div className="grid gap-6 md:grid-cols-2">
          <div aria-label="Extraction" role="group">
            <p className="mb-2 text-sm font-semibold text-white">Extraction</p>
            {extraction ? (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Detail label="Total">{dash(extraction.total_amount)}</Detail>
                <Detail label="Tax">{dash(extraction.tax_amount)}</Detail>
                <Detail label="Tax type">{dash(extraction.tax_type)}</Detail>
                <Detail label="Document date">{dash(extraction.document_date)}</Detail>
                <Detail label="Currency">{dash(extraction.currency)}</Detail>
              </dl>
            ) : (
              <p className="text-sm text-white/50">No extraction</p>
            )}
          </div>
          <div aria-label="Guard decision" role="group" className="space-y-3">
            <p className="text-sm font-semibold text-white">Guard decision</p>
            {guard ? (
              <>
                <dl className="text-sm">
                  <Detail label="Tax mode">{dash(guard.tax_mode)}</Detail>
                </dl>
                <GuardCheck name="Automated treatment" check={guard.automated} />
                <GuardCheck name="Unexplained amount" check={guard.unexplained_amount} />
              </>
            ) : (
              <p className="text-sm text-white/50">No guard decision</p>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard title={`Open conditions (${file.open_conditions.length})`}>
        {file.open_conditions.length === 0 ? (
          <p className="text-sm text-white/50">No open condition.</p>
        ) : (
          <ul className="space-y-3">
            {file.open_conditions.map((condition) => (
              <ConditionCard key={condition.id} condition={condition} />
            ))}
          </ul>
        )}
        {file.closed_conditions.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-white/60">
              Closed conditions ({file.closed_conditions.length})
            </summary>
            <ul className="mt-3 space-y-3">
              {file.closed_conditions.map((condition) => (
                <ConditionCard key={condition.id} condition={condition} />
              ))}
            </ul>
          </details>
        )}
      </SectionCard>

      <SectionCard title="Entry chain and current treatment">
        {file.entry_chain.length === 0 ? (
          <p className="text-sm text-white/50">No entry.</p>
        ) : (
          <ul className="space-y-3">
            {file.entry_chain.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
        <p className="mt-5 mb-2 text-sm font-semibold text-white">Current treatment</p>
        {file.current_treatment.length === 0 ? (
          <p className="text-sm text-white/50">No current treatment.</p>
        ) : (
          <table className="w-full text-sm" aria-label="Current treatment">
            <thead>
              <tr className={headRowCls}>
                <th className={thCls}>Account</th>
                <th className={`${thCls} text-right`}>Amount</th>
                <th className={thCls}>Job cost</th>
              </tr>
            </thead>
            <tbody>
              {file.current_treatment.map((line, index) => (
                <tr key={index} className="border-b border-white/5">
                  <td className="py-1.5 px-3 text-white/80">
                    {accountText(line.account_code, line.account_name)}
                  </td>
                  <td className="py-1.5 px-3 text-right tabular-nums text-white/80">{line.amount}</td>
                  <td className="py-1.5 px-3 text-white/50">
                    {line.job_cost_category ? humanizeCode(line.job_cost_category) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {file.live_adjustment_entry_id && (
          <p className="mt-3 text-xs text-white/50">
            Live tax adjustment entry{' '}
            <span className="font-mono">{file.live_adjustment_entry_id.slice(0, 8)}</span>
          </p>
        )}
      </SectionCard>

      <SectionCard title="Bank match">
        {file.bank_matches.length === 0 ? (
          <p className="text-sm text-white/50">No bank match.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {file.bank_matches.map((match) => (
              <li key={match.id} className="flex flex-wrap items-center gap-3 text-white/80">
                <Pill tone="info">{humanizeCode(match.state)}</Pill>
                <span>Account {dash(match.account_code)}</span>
                {match.entry_id && (
                  <span className="text-white/50">
                    Entry <span className="font-mono text-xs">{match.entry_id.slice(0, 8)}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Dates and periods">
        <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
          <Detail label="Transaction date">{dash(dates.transaction_date)}</Detail>
          <Detail label="Original tax period">{periodText(dates.original_tax_period)}</Detail>
          <Detail label="Adjustment date">
            {dash(dates.adjustment_date)}
            {dates.adjustment_date_locked && (
              <span className="ml-2 text-xs text-amber-300">in a locked period</span>
            )}
          </Detail>
          <Detail label="Adjustment tax period">{periodText(dates.adjustment_tax_period)}</Detail>
          <Detail label="Books locked through">{dash(dates.locked_through_date)}</Detail>
        </dl>
      </SectionCard>

      {file.in_tax_review && (
        <SectionCard
          title="Decision"
          description="Preview shows the server's plan. Nothing is written until you confirm."
        >
          <TaxDecisionForm
            key={`${rowId}:${formEpoch}`}
            rowId={rowId}
            file={file}
            onDecided={(plan) => {
              setDecided(plan);
              setFormEpoch((epoch) => epoch + 1);
              onReload();
            }}
            onReload={onReload}
          />
        </SectionCard>
      )}

      <SectionCard title="Audit history" description="Oldest first.">
        {file.audit_history.length === 0 ? (
          <p className="text-sm text-white/50">No audit row.</p>
        ) : (
          <ol className="space-y-3">
            {file.audit_history.map((audit) => (
              <li key={audit.id} className="rounded-lg border border-white/10 p-3 space-y-2">
                <p className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-mono text-white/80">{audit.action}</span>
                  <span className="text-white/50">{dash(audit.actor)}</span>
                  <span className="text-white/40">{audit.created_at}</span>
                  <span className="text-xs text-white/30">{audit.entity_type}</span>
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className={labelCls}>Before</p>
                    <Json value={audit.before} label={`Before of audit ${audit.id}`} />
                  </div>
                  <div>
                    <p className={labelCls}>After</p>
                    <Json value={audit.after} label={`After of audit ${audit.id}`} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </SectionCard>
    </>
  );
};

const BackLink: FC = () => (
  <Link to="/internal/tax-review" className="text-sm text-[#4DA6FF] hover:underline">
    Back to tax review
  </Link>
);

export const InternalTaxReviewFile: FC = () => {
  const { rowId = '' } = useParams();
  const { state, reloading, reload } = useStaffTaxReviewFile(rowId);

  return (
    <PageContainer title="Tax review file" actions={<BackLink />}>
      {state.kind === 'loading' && (
        <SectionCard>
          <CenteredSpinner label="Loading the tax-review file…" />
        </SectionCard>
      )}
      {state.kind === 'gone' && (
        <SectionCard>
          <div role="alert" className="space-y-2 text-sm text-white/80">
            <p>{TAX_FILE_GONE}</p>
            <BackLink />
          </div>
        </SectionCard>
      )}
      {state.kind === 'error' && <ErrorBanner message={state.message} onRetry={reload} />}
      {state.kind === 'ready' && (
        <FileSections
          key={rowId}
          rowId={rowId}
          file={state.file}
          reloading={reloading}
          onReload={reload}
        />
      )}
    </PageContainer>
  );
};
