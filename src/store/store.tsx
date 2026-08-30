import { configureStore } from '@reduxjs/toolkit';
import authReducer from './features/authSlice';
import layoutSlice from './features/layoutSlice';
import ProfileSlice from './features/profileSlice';
import packageSlice from './features/packageSlice';
import paymentSlice from './features/paymentSlice';
import billingSlice from './features/billingSlice';

// O-S61-1: a factory so the SSR prerender entry can build a FRESH default
// (logged-out) store per render pass, independent of the app's singleton.
export const makeStore = () =>
  configureStore({
    reducer: {
      auth: authReducer,
      layout: layoutSlice,
      profile: ProfileSlice,
      package: packageSlice,
      payments: paymentSlice,
      billing: billingSlice,
    },
  });

export const store = makeStore();

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
