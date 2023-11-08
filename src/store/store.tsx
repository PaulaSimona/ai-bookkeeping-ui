import { configureStore } from '@reduxjs/toolkit';
import authReducer from './features/authSlice';
import layoutSlice from './features/layoutSlice';
import ProfileSlice from './features/profileSlice';
import packageSlice from './features/packageSlice';
import paymentSlice from './features/paymentSlice';
import billingSlice from './features/billingSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    layout: layoutSlice,
    profile: ProfileSlice,
    package: packageSlice,
    payments: paymentSlice,
    blilling: billingSlice,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
