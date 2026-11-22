import { type FC, type ReactNode, useRef, useState } from 'react';
import { ActionRefusal, noticeCls } from '@/components/internal/ActionRefusal';
import { taxKindLabel } from '@/components/internal/taxReviewLabels';
import {
  ErrorBanner,
  Pill,
  PrimaryButton,
  SecondaryButton,
  humanizeCode,
} from '@/components/internal/ui';
import { useStaffAccountPurposes } from '@/hooks/useStaffAccountPurposes';
import { useStaffOrgProjects } from '@/hooks/useStaffOrgProjects';
import { type RemediationRefusal } from '@/hooks/useStaffResolution';
import {
  JOB_COST_CATEGORIES,
  TAX_BREAKDOWN_KINDS,
  TAX_DECISION_MAX_LINES,
  TAX_DECISION_REASON_MAX,
  type TaxDecisionBody,
  type TaxDecisionPlan,
  type TaxPeriod,
  type TaxPlanLine,
  type TaxReviewFile,
  useStaffTaxDecision,
} from '@/hooks/useStaffTaxReview';
import { enteredVsTarget, isPositiveMoneyString, normaliseMoneyString } from '@/utils/moneyString';

/**
 * The tax decision of one bank row (S98 P1d item 6). STAFF ONLY.
 *
 * B confirms the treatment as it stands; A corrects it with target lines and
 * a tax breakdown. Nothing is worked out here: the server's dry run is the
 * only source of the result (outcome, entry lines, ITC debit, dates), and it
 * is shown exactly as sent. Every amount is typed, checked and sent as a
 * string.
 *
 * A preview is one dry run, sent only when the reviewer asks (dry runs count
 * toward the hourly limit). Its answer is kept as ONE unit — the preview
 * token, the exact body that was sent, and a new idempotency key — and ANY
 * edit drops the unit and the plan. Confirm sends that same body with the
 * token and the key; a retry after a request that got no answer resends all
 * three unchanged, so the server can recognise the repeat.
 *
 * The accounts a line may name are the server's: the client's active accounts
 * that are allowed for allocation, and the file's active ITC accounts. No
 * account code is written in this file.
 */

export const TAX_DECISION_GONE = 'This bank row is gone, or it is not one you can review.';
export const TAX_DECISION_NOT_EXECUTED = 'The server did not carry this out. Preview again, then confirm.';
export const PREVIEW_AGAIN = 'Preview again, then confirm.';
export const ITC_GROUP = 'Tax credit (ITC)';
export const ALLOCATION_GROUP = 'Allocation accounts';
export const ITC_INACTIVE_NOTE =
  'This client’s ITC account is inactive, so it is not offered. The server refuses a tax-credit line until the account is active (no_active_itc_account).';
export const LEDGER_HEADING = 'What the client will see in their ledger';

// One refusal code → one staff sentence. The code itself is printed beneath
// by ActionRefusal, and the server's own detail after it. A code this map
// does not know is shown in the server's words.
export const TAX_DECISION_REFUSALS: ReadonlyMap<string, string> = new Map([
  ['not_in_tax_review', 'This bank row is no longer in tax review. Reload the file.'],
  [
    'conditions_mismatch',
    'The open conditions changed after this file was loaded. Reload the file, then decide again.',
  ],
  ['invalid_lines', 'Give 1 to 20 target lines, and at most 20 tax parts.'],
  ['invalid_amount', 'Every amount must be above zero, with at most 2 decimals.'],
  [
    'account_not_allowed',
    'A line is on an account that cannot take a purchase allocation. Choose another account, or change that account’s purpose first.',
  ],
  ['project_not_allowed', 'A line names a project this client does not have.'],
  ['total_mismatch', 'The target lines must total the current treatment.'],
  ['itc_not_supported', 'The receipt and the tax breakdown do not support this tax credit.'],
  ['not_registered', 'This client is not registered for GST/HST, so no tax can be recovered.'],
  ['transaction_date_required', 'The document has no date. Enter the transaction date.'],
  ['qst_recoverable_phase2', 'A recoverable QST cannot be decided yet. Leave this row open.'],
  [
    'no_active_itc_account',
    'This client has no active ITC account, so no tax credit can be posted.',
  ],
  ['period_locked', 'The books are locked for the posting date, so nothing can be posted.'],
  [
    'reclassification_invalid',
    'The correction would not balance off the bank line. Check the target lines.',
  ],
  [
    'idempotency_key_reused',
    'This confirmation was already used for another decision. Preview again, then confirm.',
  ],
  ['preview_invalid', PREVIEW_AGAIN],
  ['preview_expired', PREVIEW_AGAIN],
  ['preview_stale', PREVIEW_AGAIN],
  ['invalid_accounts', 'The entry names an account that cannot be posted to.'],
  ['unbalanced', 'The entry would not balance.'],
  ['already_reversed', 'The earlier adjustment was already reversed. Reload the file.'],
  ['already_corrected', 'The entry was already corrected. Reload the file.'],
]);

const fieldCls =
  'rounded-lg bg-[#0A1628] border border-white/15 px-3 py-2 text-sm text-white ' +
  'focus:outline-none focus:ring-1 focus:ring-[#0066FF] [color-scheme:dark] disabled:opacity-50';
const labelCls = 'text-[11px] uppercase tracking-wide text-white/30';
const thCls = 'py-2 px-3 font-medium';
const headRowCls =
  'text-left text-[11px] uppercase tracking-wide text-white/30 border-b border-white/10';
const errorCls = 'text-xs text-red-300';

interface LineDraft {
  key: number;
  accountId: string;
  // What the books call the account now, for the note when it is not offered.
  accountLabel: string;
  amount: string;
  projectId: string;
  category: string;
}

interface TaxDraft {
  key: number;
  kind: string;
  amount: string;
  recoverable: boolean;
}

// The preview, kept as one unit. `body` is the exact object that was sent.
interface Previewed {
  body: TaxDecisionBody;
  token: string;
  idempotencyKey: string;
  plan: TaxDecisionPlan;
}

type FieldErrors = Partial<Record<string, string>>;

const accountText = (code: string | null | undefined, name: string | null | undefined): string =>
  [code, name].filter(Boolean).join(' ') || '—';

const periodText = (period: TaxPeriod | null): string =>
  period ? `${period.label} (${period.start} to ${period.end}, ${period.frequency})` : '—';

const OUTCOMES = new Map<string, string>([
  ['reclassification_posted', 'One reclassification entry will be posted.'],
  ['adjustment_reversed', 'The earlier tax adjustment will be reversed.'],
  ['no_entry', 'No entry will be posted.'],
]);

const FieldError: FC<{ id: string; message: string | undefined }> = ({ id, message }) =>
  message ? (
    <p id={id} role="alert" className={errorCls}>
      {message}
    </p>
  ) : null;

const PlanLines: FC<{ label: string; lines: TaxPlanLine[]; entry?: boolean }> = ({
  label,
  lines,
  entry = false,
}) => (
  <table className="w-full text-sm" aria-label={label}>
    <thead>
      <tr className={headRowCls}>
        <th className={thCls}>Account</th>
        {entry ? (
          <>
            <th className={`${thCls} text-right`}>Dr</th>
            <th className={`${thCls} text-right`}>Cr</th>
          </>
        ) : (
          <th className={`${thCls} text-right`}>Amount</th>
        )}
        <th className={thCls}>Job cost</th>
      </tr>
    </thead>
    <tbody>
      {lines.map((line, index) => (
        // Plan lines carry no id; their order is the server's.
        <tr key={index} className="border-b border-white/5">
          <td className="py-1.5 px-3 text-white/80">
            {accountText(line.account_code, line.account_name)}
          </td>
          {entry ? (
            <>
              <td className="py-1.5 px-3 text-right tabular-nums text-white/80">
                {line.debit ?? '—'}
              </td>
              <td className="py-1.5 px-3 text-right tabular-nums text-white/80">
                {line.credit ?? '—'}
              </td>
            </>
          ) : (
            <td className="py-1.5 px-3 text-right tabular-nums text-white/80">
              {line.amount ?? '—'}
            </td>
          )}
          <td className="py-1.5 px-3 text-white/50">
            {line.job_cost_category ? humanizeCode(line.job_cost_category) : '—'}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

const PlanFact: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div>
    <dt className={labelCls}>{label}</dt>
    <dd className="text-white/80 break-words">{children}</dd>
  </div>
);

// The server's plan, exactly as sent. Nothing here is computed.
const PlanView: FC<{ plan: TaxDecisionPlan }> = ({ plan }) => (
  <div
    role="region"
    aria-label="Server plan"
    className="space-y-4 rounded-lg border border-[#0066FF]/40 bg-[#0066FF]/5 p-4"
  >
    <div>
      <p className={labelCls}>Outcome</p>
      <p className="text-sm text-white">
        {OUTCOMES.get(plan.outcome) ?? humanizeCode(plan.outcome)}{' '}
        <span className="font-mono text-xs text-white/40">{plan.outcome}</span>
      </p>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <p className={`${labelCls} mb-1`}>Current</p>
        <PlanLines label="Plan current lines" lines={plan.current_lines} />
      </div>
      <div>
        <p className={`${labelCls} mb-1`}>Target</p>
        {plan.target_lines ? (
          <PlanLines label="Plan target lines" lines={plan.target_lines} />
        ) : (
          <p className="text-sm text-white/50">Unchanged: the treatment is confirmed as it is.</p>
        )}
      </div>
    </div>
    <div>
      <p className={`${labelCls} mb-1`}>Entry lines</p>
      {plan.entry_lines.length > 0 ? (
        <PlanLines label="Plan entry lines" lines={plan.entry_lines} entry />
      ) : (
        <p className="text-sm text-white/50">No entry lines.</p>
      )}
    </div>
    <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
      <PlanFact label="ITC debit">
        <span className="tabular-nums">{plan.itc_debit ?? '—'}</span>
      </PlanFact>
      <PlanFact label="Transaction date">
        {plan.transaction_date ?? '—'}
        {plan.transaction_date_source && (
          <span className="ml-2 text-xs text-white/40">
            from the {plan.transaction_date_source}
          </span>
        )}
      </PlanFact>
      <PlanFact label="Original tax period">{periodText(plan.original_tax_period)}</PlanFact>
      <PlanFact label="Adjustment date">{plan.adjustment_date ?? '—'}</PlanFact>
      <PlanFact label="Adjustment tax period">{periodText(plan.adjustment_tax_period)}</PlanFact>
      <PlanFact label="Books locked through">{plan.locked_through_date ?? '—'}</PlanFact>
    </dl>
    <div>
      <h3 className="text-sm font-semibold text-white">{LEDGER_HEADING}</h3>
      <p className="mt-1 text-sm text-white/80">
        {plan.entry_description ?? 'Nothing new: no entry is posted.'}
      </p>
    </div>
  </div>
);

// The server's refusal: a staff sentence for its code (ActionRefusal prints
// the code), then the server's own words, which carry the specifics.
const DecisionRefusal: FC<{ refusal: RemediationRefusal; onReload: () => void }> = ({
  refusal,
  onReload,
}) => {
  const sentence = refusal.code ? TAX_DECISION_REFUSALS.get(refusal.code) : undefined;
  return (
    <div className="space-y-1">
      <ActionRefusal
        refusal={sentence ? { ...refusal, detail: sentence } : refusal}
        gone={TAX_DECISION_GONE}
        onRefresh={onReload}
      />
      {sentence && refusal.detail && refusal.detail !== sentence && (
        <p className="text-xs text-white/50">Server: {refusal.detail}</p>
      )}
    </div>
  );
};

// The fields a 400 names that have a place on the form; the rest are shown
// together above the buttons.
const FORM_FIELDS = new Set([
  'decision',
  'kinds',
  'reason',
  'transaction_date',
  'lines',
  'tax_breakdown',
]);

const serverFieldErrors = (refusal: RemediationRefusal | null): FieldErrors => {
  if (refusal?.status !== 400) return {};
  const errors: FieldErrors = {};
  for (const [field, message] of Object.entries(refusal.context)) {
    if (typeof message === 'string' && message !== '') errors[field] = message;
  }
  return errors;
};

export const TaxDecisionForm: FC<{
  rowId: string;
  file: TaxReviewFile;
  // The confirmed decision's plan (executed === true).
  onDecided: (plan: TaxDecisionPlan) => void;
  // Reads the file again (a refusal says the file is out of date).
  onReload: () => void;
}> = ({ rowId, file, onDecided, onReload }) => {
  const purposes = useStaffAccountPurposes(file.org_id);
  const projects = useStaffOrgProjects(file.org_id);
  const { preview: sendPreview, confirm: sendConfirm } = useStaffTaxDecision(rowId);

  const nextKey = useRef(0);
  const newKey = () => {
    nextKey.current += 1;
    return nextKey.current;
  };

  // Seeded once, from the file the form opened with. A later read of the file
  // (a receipt reload) never overwrites what the reviewer typed.
  const filedDate = file.dates.transaction_date ?? '';
  const [decision, setDecision] = useState<'A' | 'B' | null>(null);
  const [reason, setReason] = useState('');
  const [transactionDate, setTransactionDate] = useState(filedDate);
  const [seedDate] = useState(filedDate);
  const [lines, setLines] = useState<LineDraft[]>(() =>
    file.current_treatment.map((line) => ({
      key: newKey(),
      accountId: line.account_id,
      accountLabel: accountText(line.account_code, line.account_name),
      amount: line.amount,
      projectId: line.project_id ?? '',
      category: line.job_cost_category ?? '',
    })),
  );
  const [taxes, setTaxes] = useState<TaxDraft[]>([]);
  const [previewed, setPreviewed] = useState<Previewed | null>(null);
  const [refusal, setRefusal] = useState<RemediationRefusal | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [localErrors, setLocalErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState<'preview' | 'confirm' | null>(null);
  // One request at a time, whatever the clicks: set before the first await.
  const inFlight = useRef(false);

  // Every open kind, each once, in the server's order. Read-only.
  const kinds = [...new Set(file.open_conditions.map((condition) => condition.kind))];
  // A preview of other kinds than the file now shows is no preview.
  const live = previewed && previewed.body.kinds.join('|') === kinds.join('|') ? previewed : null;

  // ANY edit drops the token, the body, the key and the plan together.
  const edited = () => {
    setPreviewed(null);
    setRefusal(null);
    setNotice(null);
    setLocalErrors({});
  };

  // The accounts a line may name — the server's two lists, nothing else.
  const itcIds = new Set(file.itc_accounts.map((account) => account.id));
  const itcOffered = file.itc_accounts.filter((account) => account.is_active);
  const allocationOffered = purposes.accounts.filter(
    (account) => account.is_active && account.allowed_for_allocation && !itcIds.has(account.id),
  );
  const offeredIds = new Set([
    ...allocationOffered.map((account) => account.id),
    ...itcOffered.map((account) => account.id),
  ]);
  const accountsReady = !purposes.isLoading && purposes.error === null;
  const itcAllInactive = file.itc_accounts.length > 0 && itcOffered.length === 0;

  const changeLine = (key: number, patch: Partial<LineDraft>) => {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
    edited();
  };
  const changeTax = (key: number, patch: Partial<TaxDraft>) => {
    setTaxes((current) => current.map((tax) => (tax.key === key ? { ...tax, ...patch } : tax)));
    edited();
  };

  // On blur a valid amount is written out to 2 decimals ("7" → "7.00"), by
  // string operations. Not an edit: it is the amount the body carries anyway.
  const tidyLine = (key: number, raw: string) => {
    const tidy = normaliseMoneyString(raw);
    if (tidy === null || tidy === raw) return;
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, amount: tidy } : line)),
    );
  };
  const tidyTax = (key: number, raw: string) => {
    const tidy = normaliseMoneyString(raw);
    if (tidy === null || tidy === raw) return;
    setTaxes((current) => current.map((tax) => (tax.key === key ? { ...tax, amount: tidy } : tax)));
  };

  // The request body, or the reasons there is none. Amounts go as strings.
  const build = (): { body: TaxDecisionBody } | { errors: FieldErrors } => {
    const errors: FieldErrors = {};
    if (decision === null) errors.decision = 'Choose A or B.';
    const trimmed = reason.trim();
    if (trimmed === '') errors.reason = 'A reason is required.';
    else if (trimmed.length > TAX_DECISION_REASON_MAX)
      errors.reason = `The reason is at most ${TAX_DECISION_REASON_MAX} characters.`;
    if (kinds.length === 0) errors.kinds = 'This bank row has no open condition.';

    const body: TaxDecisionBody = { decision: decision ?? 'B', kinds, reason: trimmed };
    // The date goes only when the reviewer changed it: left as filed, the
    // server keeps using the document's own date.
    if (transactionDate !== '' && transactionDate !== seedDate) {
      body.transaction_date = transactionDate;
    }

    if (decision === 'A') {
      if (!accountsReady) errors.lines = 'The accounts are not loaded yet.';
      else if (lines.length < 1 || lines.length > TAX_DECISION_MAX_LINES)
        errors.lines = `Give 1 to ${TAX_DECISION_MAX_LINES} target lines.`;
      else if (lines.some((line) => !offeredIds.has(line.accountId)))
        errors.lines = 'Choose an account on every line.';
      else if (lines.some((line) => !isPositiveMoneyString(line.amount)))
        errors.lines = 'Every amount must be above zero, with at most 2 decimals.';
      if (taxes.length > TAX_DECISION_MAX_LINES)
        errors.tax_breakdown = `The tax breakdown has at most ${TAX_DECISION_MAX_LINES} parts.`;
      else if (taxes.some((tax) => !isPositiveMoneyString(tax.amount)))
        errors.tax_breakdown = 'Every amount must be above zero, with at most 2 decimals.';

      body.lines = lines.map((line) => ({
        account_id: line.accountId,
        amount: normaliseMoneyString(line.amount) ?? line.amount,
        ...(line.projectId ? { project_id: line.projectId } : {}),
        ...(line.category ? { job_cost_category: line.category } : {}),
      }));
      body.tax_breakdown = taxes.map((tax) => ({
        kind: tax.kind,
        amount: normaliseMoneyString(tax.amount) ?? tax.amount,
        recoverable: tax.recoverable,
      }));
    }
    return Object.keys(errors).length > 0 ? { errors } : { body };
  };

  const onPreview = async () => {
    if (inFlight.current) return;
    const built = build();
    setPreviewed(null);
    setRefusal(null);
    setNotice(null);
    if ('errors' in built) {
      setLocalErrors(built.errors);
      return;
    }
    setLocalErrors({});
    inFlight.current = true;
    setPending('preview');
    try {
      const outcome = await sendPreview(built.body);
      if (!outcome.ok) {
        setRefusal(outcome.refusal);
      } else if (outcome.executed || outcome.previewToken === null) {
        // A dry run that claims to have run, or hands back no token, is not
        // a preview to confirm.
        setNotice('The server did not answer with a preview. Preview again.');
      } else {
        setPreviewed({
          body: built.body,
          token: outcome.previewToken,
          idempotencyKey: crypto.randomUUID(),
          plan: outcome.plan,
        });
      }
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  };

  const onConfirm = async () => {
    if (inFlight.current || !live) return;
    inFlight.current = true;
    setPending('confirm');
    setRefusal(null);
    setNotice(null);
    try {
      // The identical body, with the token and the key of ITS preview.
      const outcome = await sendConfirm(live.body, live.token, live.idempotencyKey);
      if (outcome.ok && outcome.executed) {
        onDecided(outcome.plan);
        return;
      }
      if (outcome.ok) {
        // Answered, and not carried out: never a success.
        setPreviewed(null);
        setNotice(TAX_DECISION_NOT_EXECUTED);
        return;
      }
      setRefusal(outcome.refusal);
      const { status } = outcome.refusal;
      // No answer, a rate limit or a server fault: the same body, token and
      // key stay, so the retry is the same request. A request the server
      // answered and refused needs a new preview.
      const retryable = status === undefined || status === 429 || status >= 500;
      if (!retryable) setPreviewed(null);
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  };

  const serverErrors = serverFieldErrors(refusal);
  const errors: FieldErrors = { ...serverErrors, ...localErrors };
  const otherErrors = Object.entries(serverErrors).filter(([field]) => !FORM_FIELDS.has(field));
  const busy = pending !== null;
  const reasonLeft = TAX_DECISION_REASON_MAX - reason.length;

  // DISPLAY ONLY: what was entered beside what the books carry. Never sent,
  // never a gate — the server's dry run decides.
  const currentTotal = enteredVsTarget(
    file.current_treatment.map((line) => line.amount),
    '0.00',
  )?.entered;
  const hint =
    decision === 'A' && currentTotal
      ? enteredVsTarget(
          lines.map((line) => line.amount),
          currentTotal,
        )
      : null;

  const knownProjectIds = new Set(projects.projects.map((project) => project.id));

  return (
    <div className="space-y-5">
      <div>
        <p className={labelCls}>Kinds decided</p>
        <p className="mt-1 flex flex-wrap gap-1" aria-label="Kinds decided">
          {kinds.map((kind) => (
            <Pill key={kind} tone="warning">
              {taxKindLabel(kind)}
            </Pill>
          ))}
        </p>
        <FieldError id="tax-decision-kinds-error" message={errors.kinds} />
      </div>

      <fieldset className="space-y-2" disabled={busy}>
        <legend className={labelCls}>Decision</legend>
        <label className="flex items-center gap-2 text-sm text-white/80">
          <input
            type="radio"
            name="tax-decision"
            checked={decision === 'B'}
            onChange={() => {
              setDecision('B');
              edited();
            }}
          />
          B — Confirm the treatment as it is
        </label>
        <label className="flex items-center gap-2 text-sm text-white/80">
          <input
            type="radio"
            name="tax-decision"
            checked={decision === 'A'}
            onChange={() => {
              setDecision('A');
              edited();
            }}
          />
          A — Correct the treatment
        </label>
        <FieldError id="tax-decision-decision-error" message={errors.decision} />
      </fieldset>

      {decision === 'A' && (
        <div className="space-y-5">
          <div className="space-y-2">
            <p className={labelCls}>Target lines</p>
            {purposes.error !== null && (
              <ErrorBanner message={purposes.error} onRetry={purposes.refetch} />
            )}
            {itcAllInactive && (
              <p role="note" className={noticeCls}>
                {ITC_INACTIVE_NOTE}
              </p>
            )}
            {projects.error !== null && <p className={errorCls}>{projects.error}</p>}
            {projects.count > projects.projects.length && (
              <p className="text-xs text-white/40">
                Showing {projects.projects.length} of {projects.count} projects.
              </p>
            )}
            <ul className="space-y-2">
              {lines.map((line, index) => {
                const number = index + 1;
                const offered = offeredIds.has(line.accountId);
                return (
                  <li
                    key={line.key}
                    aria-label={`Target line ${number}`}
                    className="space-y-1 rounded-lg border border-white/10 p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        aria-label={`Account of line ${number}`}
                        className={`${fieldCls} min-w-[16rem]`}
                        value={offered ? line.accountId : ''}
                        disabled={busy || !accountsReady}
                        onChange={(e) => changeLine(line.key, { accountId: e.target.value })}
                      >
                        <option value="">
                          {purposes.isLoading ? 'Loading accounts…' : 'Choose an account'}
                        </option>
                        <optgroup label={ALLOCATION_GROUP}>
                          {allocationOffered.map((account) => (
                            <option key={account.id} value={account.id}>
                              {accountText(account.code, account.name)}
                            </option>
                          ))}
                        </optgroup>
                        {itcOffered.length > 0 && (
                          <optgroup label={ITC_GROUP}>
                            {itcOffered.map((account) => (
                              <option key={account.id} value={account.id}>
                                {accountText(account.code, account.name)}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`Amount of line ${number}`}
                        className={`${fieldCls} w-32 text-right tabular-nums`}
                        value={line.amount}
                        disabled={busy}
                        onChange={(e) => changeLine(line.key, { amount: e.target.value })}
                        onBlur={(e) => tidyLine(line.key, e.target.value)}
                      />
                      <select
                        aria-label={`Project of line ${number}`}
                        className={fieldCls}
                        value={line.projectId}
                        disabled={busy}
                        onChange={(e) => changeLine(line.key, { projectId: e.target.value })}
                      >
                        <option value="">No project</option>
                        {line.projectId !== '' && !knownProjectIds.has(line.projectId) && (
                          <option value={line.projectId}>
                            Current project {line.projectId.slice(0, 8)}
                          </option>
                        )}
                        {projects.projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {[project.reference, project.name].filter(Boolean).join(' ')}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label={`Job-cost category of line ${number}`}
                        className={fieldCls}
                        value={line.category}
                        disabled={busy}
                        onChange={(e) => changeLine(line.key, { category: e.target.value })}
                      >
                        <option value="">Category as in the books</option>
                        {JOB_COST_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {humanizeCode(category)}
                          </option>
                        ))}
                      </select>
                      <SecondaryButton
                        disabled={busy || lines.length <= 1}
                        onClick={() => {
                          setLines((current) => current.filter((l) => l.key !== line.key));
                          edited();
                        }}
                      >
                        Remove line {number}
                      </SecondaryButton>
                    </div>
                    {accountsReady && !offered && line.accountId !== '' && (
                      <p className="text-xs text-amber-200">
                        {line.accountLabel || 'The current account'} is not offered: it is inactive
                        or not allowed for allocation. Choose an account.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              <SecondaryButton
                disabled={busy || lines.length >= TAX_DECISION_MAX_LINES}
                onClick={() => {
                  setLines((current) => [
                    ...current,
                    {
                      key: newKey(),
                      accountId: '',
                      accountLabel: '',
                      amount: '',
                      projectId: '',
                      category: '',
                    },
                  ]);
                  edited();
                }}
              >
                Add a line
              </SecondaryButton>
              {hint && (
                <span
                  className={`text-xs ${hint.matches ? 'text-emerald-300' : 'text-amber-200'}`}
                  aria-label="Entered against the current treatment"
                >
                  Entered {hint.entered} of {hint.target} (a hint only; the server decides)
                </span>
              )}
            </div>
            <FieldError id="tax-decision-lines-error" message={errors.lines} />
          </div>

          <div className="space-y-2">
            <p className={labelCls}>Tax breakdown</p>
            {taxes.length === 0 && <p className="text-sm text-white/50">No tax part.</p>}
            <ul className="space-y-2">
              {taxes.map((tax, index) => {
                const number = index + 1;
                return (
                  <li
                    key={tax.key}
                    aria-label={`Tax part ${number}`}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <select
                      aria-label={`Kind of tax part ${number}`}
                      className={fieldCls}
                      value={tax.kind}
                      disabled={busy}
                      onChange={(e) => changeTax(tax.key, { kind: e.target.value })}
                    >
                      {TAX_BREAKDOWN_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {kind === 'other' ? 'Other' : kind.toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label={`Amount of tax part ${number}`}
                      className={`${fieldCls} w-32 text-right tabular-nums`}
                      value={tax.amount}
                      disabled={busy}
                      onChange={(e) => changeTax(tax.key, { amount: e.target.value })}
                      onBlur={(e) => tidyTax(tax.key, e.target.value)}
                    />
                    <label className="flex items-center gap-2 text-sm text-white/80">
                      <input
                        type="checkbox"
                        aria-label={`Tax part ${number} is recoverable`}
                        checked={tax.recoverable}
                        disabled={busy}
                        onChange={(e) => changeTax(tax.key, { recoverable: e.target.checked })}
                      />
                      Recoverable
                    </label>
                    <SecondaryButton
                      disabled={busy}
                      onClick={() => {
                        setTaxes((current) => current.filter((t) => t.key !== tax.key));
                        edited();
                      }}
                    >
                      Remove tax part {number}
                    </SecondaryButton>
                  </li>
                );
              })}
            </ul>
            <SecondaryButton
              disabled={busy || taxes.length >= TAX_DECISION_MAX_LINES}
              onClick={() => {
                setTaxes((current) => [
                  ...current,
                  { key: newKey(), kind: TAX_BREAKDOWN_KINDS[0], amount: '', recoverable: false },
                ]);
                edited();
              }}
            >
              Add a tax part
            </SecondaryButton>
            <FieldError id="tax-decision-taxes-error" message={errors.tax_breakdown} />
          </div>
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor="tax-decision-date" className={labelCls}>
          Transaction date (optional)
        </label>
        <div>
          <input
            id="tax-decision-date"
            type="date"
            aria-describedby={errors.transaction_date ? 'tax-decision-date-error' : undefined}
            className={fieldCls}
            value={transactionDate}
            disabled={busy}
            onChange={(e) => {
              setTransactionDate(e.target.value);
              edited();
            }}
          />
        </div>
        <FieldError id="tax-decision-date-error" message={errors.transaction_date} />
      </div>

      <div className="space-y-1">
        <label htmlFor="tax-decision-reason" className={labelCls}>
          Reason
        </label>
        <textarea
          id="tax-decision-reason"
          aria-describedby={errors.reason ? 'tax-decision-reason-error' : undefined}
          className={`${fieldCls} w-full`}
          rows={2}
          maxLength={TAX_DECISION_REASON_MAX}
          value={reason}
          disabled={busy}
          onChange={(e) => {
            setReason(e.target.value);
            edited();
          }}
        />
        <p className="text-xs text-white/40" aria-label="Characters left">
          {reasonLeft} of {TAX_DECISION_REASON_MAX} left
        </p>
        <FieldError id="tax-decision-reason-error" message={errors.reason} />
      </div>

      {otherErrors.length > 0 && (
        <div role="alert" className={errorCls}>
          {otherErrors.map(([field, message]) => (
            <p key={field}>
              <span className="font-mono">{field}</span>: {message}
            </p>
          ))}
        </div>
      )}
      {refusal && refusal.status !== 400 && (
        <DecisionRefusal refusal={refusal} onReload={onReload} />
      )}
      {notice && (
        <div role="alert" className={noticeCls}>
          {notice}
        </div>
      )}

      {live && <PlanView plan={live.plan} />}

      <div className="flex flex-wrap items-center gap-3">
        <SecondaryButton onClick={() => void onPreview()} disabled={busy}>
          {pending === 'preview' ? 'Previewing…' : 'Preview'}
        </SecondaryButton>
        {live && (
          <PrimaryButton onClick={() => void onConfirm()} disabled={busy} busy={pending === 'confirm'}>
            Confirm decision
          </PrimaryButton>
        )}
      </div>
    </div>
  );
};
