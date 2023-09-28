import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  user: any;
  inProgress: boolean;
}

const initialState: AuthState = {
  user: null,
  inProgress: true,
};

const AuthSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<any>) => {
      state.user = action.payload;
    },
    setInProgress: (state, action: PayloadAction<any>) => {
      state.inProgress = action.payload;
    },
  },
});

export const { setUser, setInProgress } = AuthSlice.actions;
export default AuthSlice.reducer;
