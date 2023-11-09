import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type PaymentsType = {
  id: string;
  card_brand: string;
  card_last4: string;
  card_exp_month: string;
  card_exp_year: string;
  name_payment_method: string;
  is_primary: boolean;
};

interface PaymentsState {
  paymentsMethods: PaymentsType[] | null;
}

const initialState: PaymentsState = {
  paymentsMethods: null,
};

const PaymentsSlice = createSlice({
  name: 'package',
  initialState,
  reducers: {
    setPaymentsMethodsValues: (state, action: PayloadAction<any>) => {
      state.paymentsMethods = action.payload.payments;
    },
  },
});

export const { setPaymentsMethodsValues } = PaymentsSlice.actions;
export default PaymentsSlice.reducer;
