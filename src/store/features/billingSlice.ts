import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type InvoiceType = {
  id: string;
  amount: number;
  currency: string;
  description: string;
  status: string;
  qst: number;
  hst: number;
  pst: number;
  gst: number;
  created_at: string;
  items: { name: string; price: number }[];
};

interface BillingState {
  invoices: InvoiceType[];
}

const initialState: BillingState = {
  invoices: [],
};

const BillingSlice = createSlice({
  name: 'billing',
  initialState,
  reducers: {
    setInvoices: (state, action: PayloadAction<any>) => {
      state.invoices = action.payload;
    },
  },
});

export const { setInvoices } = BillingSlice.actions;
export default BillingSlice.reducer;
