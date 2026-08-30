// Card registry — client lane (O-S31-1 C3, Session 31).
//
// Consumes the SHIPPED s29 endpoints exactly; no new backend surface:
//   GET   /api/accounting/cards/        (paginated, OrgCardClientSerializer)
//   PATCH /api/accounting/cards/<pk>/   (classification, label)
//
// The client lane is classify-only by design — there is no create and no
// delete (card_views.py:16-18): cards are DETECTED by the settlement
// recognizer or registered by staff, and retirement (is_active) stays
// staff-side. So this module exposes a list read and one classify mutation.
import { useCallback, useState } from 'react';
import api from '@/utils/api';
import { usePaginatedList } from '@/hooks/usePaginatedList';

export type CardNetwork = 'visa' | 'mastercard' | 'amex' | 'other';
export type CardClassification = 'unidentified' | 'business' | 'personal';
export type CardSource = 'plaid' | 'detected' | 'manual';

// Mirrors OrgCardClientSerializer's field list. last4 / network / source /
// is_active are read-only server-side — facts about the card, not choices.
export interface OrgCard {
  id: string;
  last4: string;
  network: CardNetwork;
  label: string;
  classification: CardClassification;
  mapped_account: string | null;
  mapped_account_code: string | null;
  mapped_account_name: string | null;
  source: CardSource;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// O-S33-4: mapped_account is NOT part of this payload. The server resolves the
// account from the classification, and the API rejects a client-supplied
// mapped_account with a 400 — so sending it would break the call, not merely
// be ignored. Typed out deliberately rather than left optional: the type is
// what stops a future caller re-adding it.
export interface ClassifyPayload {
  classification: Exclude<CardClassification, 'unidentified'>;
  label?: string;
}

export type ClassifyResult =
  | { ok: true; data: OrgCard }
  | { ok: false; error: string };

export const CARDS_URL = '/api/accounting/cards/';

export const useCards = () => usePaginatedList<OrgCard>(CARDS_URL);

// Pull a DRF error body into one human sentence. Two shapes reach this lane,
// both already written as customer-facing copy, so both are shown verbatim
// rather than replaced with a generic failure line:
//   409 {detail: "…Our team can set it up for you."}  — O-S33-4, no account
//       can be resolved; the card stays unidentified and staff finish it.
//   400 {classification: ["…"]}                        — the model invariant.
const errorMessage = (data: unknown): string => {
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    const body = data as Record<string, unknown>;
    if (typeof body.detail === 'string') return body.detail;
    const firstKey = Object.keys(body)[0];
    const first = firstKey ? body[firstKey] : undefined;
    if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
    if (typeof first === 'string') return first;
  }
  return 'Could not save the card. Please try again.';
};

export const useClassifyCard = () => {
  const [savingId, setSavingId] = useState<string | null>(null);

  const classify = useCallback(
    async (cardId: string, payload: ClassifyPayload): Promise<ClassifyResult> => {
      setSavingId(cardId);
      try {
        // Same interceptor contract as every other Tier 2 hook: non-401 HTTP
        // errors RESOLVE (the interceptor returns error.response) and
        // cancellations resolve to null — so status-check, never assume.
        const res = await api.patch(`${CARDS_URL}${cardId}/`, payload);
        if (res == null) return { ok: false, error: 'Request cancelled.' };
        if (res.status === 200) return { ok: true, data: res.data as OrgCard };
        return { ok: false, error: errorMessage(res.data) };
      } catch (err: unknown) {
        const resp = (err as { response?: { data?: unknown } })?.response;
        return { ok: false, error: errorMessage(resp?.data) };
      } finally {
        setSavingId(null);
      }
    },
    [],
  );

  return { classify, savingId };
};

// ─── Create (S62, O-S62-2) ────────────────────────────────────────────────────
// POST /api/accounting/cards/ — the client REGISTERS a card it holds. Until S62
// a card existed only once the settlement recognizer saw a payment to it, so a
// card the owner held but had not yet paid from was invisible.
//
// The client states FACTS; the server maps. Same division of labour as the
// classify lane above, and the same defence: mapped_account is NOT a member of
// this type. That is deliberate and load-bearing — the backend rejects a
// supplied mapped_account with a 400 (it is never silently dropped), so the
// type is what stops a future caller from writing the call that would break.
// Unknown fields are refused server-side too, so this type is the whole
// contract, not a convenient subset of it.
export interface CreateCardPayload {
  network: CardNetwork;
  last4: string;
  classification: Exclude<CardClassification, 'unidentified'>;
  label?: string;
}

// The 201 body (OrgCardClientCreatedSerializer). Deliberately NARROWER than
// OrgCard: it carries no mapped_account, no mapped_account_code and no
// mapped_account_name, because the client lane never learns which ledger
// account its answer resolved to (O-S33-2 / O-S33-4).
export interface CreatedCard {
  id: string;
  last4: string;
  network: CardNetwork;
  label: string;
  classification: CardClassification;
  source: CardSource;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CreateResult =
  | { ok: true; data: CreatedCard }
  | { ok: false; error: string; fieldErrors: Record<string, string> };

// DRF field errors, flattened to one sentence per field for inline rendering.
// `detail` is excluded: it is the whole-request message (409 conflict, 409
// unresolvable account, 429 throttle) and is surfaced as `error` instead.
const fieldErrorsOf = (data: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (key === 'detail') continue;
      if (Array.isArray(value) && typeof value[0] === 'string') out[key] = value[0];
      else if (typeof value === 'string') out[key] = value;
    }
  }
  return out;
};

export const useCreateCard = () => {
  const [saving, setSaving] = useState(false);

  const create = useCallback(async (payload: CreateCardPayload): Promise<CreateResult> => {
    setSaving(true);
    try {
      // Same interceptor contract as every other Tier 2 hook: non-401 HTTP
      // errors RESOLVE (the interceptor returns error.response) and
      // cancellations resolve to null — so status-check, never assume.
      const res = await api.post(CARDS_URL, payload);
      if (res == null) {
        return { ok: false, error: 'Request cancelled.', fieldErrors: {} };
      }
      if (res.status === 201) return { ok: true, data: res.data as CreatedCard };
      if (res.status === 429) {
        // The throttle body is machine copy; say the useful thing instead.
        return {
          ok: false,
          error: 'Too many cards added just now. Please try again later.',
          fieldErrors: {},
        };
      }
      // 400 → inline field errors; 409 (duplicate, or no resolvable account) →
      // the server's own factual sentence, shown verbatim. Neither names an
      // account.
      return {
        ok: false,
        error: errorMessage(res.data),
        fieldErrors: fieldErrorsOf(res.data),
      };
    } catch (err: unknown) {
      const resp = (err as { response?: { data?: unknown } })?.response;
      return {
        ok: false,
        error: errorMessage(resp?.data),
        fieldErrors: fieldErrorsOf(resp?.data),
      };
    } finally {
      setSaving(false);
    }
  }, []);

  return { create, saving };
};
