import { configureStore } from '@reduxjs/toolkit';
import authReducer from './features/authSlice';
import layoutSlice from './features/layoutSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    layout: layoutSlice,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
