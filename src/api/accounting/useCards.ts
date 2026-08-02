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
