// Sales-invoice shared types (§INV UI, S41). Mirrors the backend
// SalesInvoiceReadSerializer / write shapes. Money values are backend Decimal
// STRINGS — display-only, never arithmetic in JS.

export type InvoiceKind = 'invoice' | 'credit_note';
export type InvoiceStatus =
  | 'draft' | 'issued' | 'sent' | 'partial' | 'paid' | 'voided';
export type TaxTreatment = 'taxable' | 'zero_rated' | 'exempt';

export interface SalesInvoiceLine {
  id: string;
  position: number;
  description: string;
  quantity: string;
  unit_price: string;
  account: string;
  account_code: string;
  account_name: string;
  tax_treatment: TaxTreatment;
  tax_rate: string | null;
  tax_amount: string | null;
}

export interface SalesInvoicePayment {
  id: string;
  amount: string;
  payment_date: string;
  method: string;
  bank_transaction: string | null;
  notes: string;
  created_at: string;
}

export interface SalesInvoice {
  id: string;
  kind: InvoiceKind;
  counterparty: string;
  related_invoice: string | null;
  status: InvoiceStatus;
  invoice_number: number | null;
  issue_date: string | null;
  due_date: string | null;
  payment_terms: string;
  currency: string;
  subtotal: string | null;
  tax_total: string | null;
  total: string | null;
  payment_instructions: string;
  notes: string;
  journal_entry: string | null;
  created_at: string;
  updated_at: string;
  lines: SalesInvoiceLine[];
  payments: SalesInvoicePayment[];
  is_overdue: boolean;
}

// Client-authored line input — the server computes all money. The client NEVER
// sends totals/status/number.
export interface InvoiceLineInput {
  description: string;
  quantity: string;
  unit_price: string;
  account: string; // account UUID
  tax_treatment: TaxTreatment;
}

export interface InvoiceCreatePayload {
  counterparty: string;
  payment_terms?: string;
  issue_date?: string | null;
  notes?: string;
  payment_instructions?: string;
  lines: InvoiceLineInput[];
}

export interface PaymentPayload {
  amount: string;
  payment_date: string;
  method?: string;
}
