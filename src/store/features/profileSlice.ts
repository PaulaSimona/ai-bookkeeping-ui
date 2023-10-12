import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface ProfileState {
  profile: null | {
    id: string;
    email: string;
    role: string;
    first_name: string;
    last_name: string;
    phone_number: string;
    is_active: boolean;
    company_name: string;
    company_business_number: string;
    company_address: string;
    company_number: string;
    company_province: string;
    company_city: string;
    company_postal_code: string;
  };
  inProgress: boolean;
}

const initialState: ProfileState = {
  profile: null,
  inProgress: true,
};

const ProfileSlice = createSlice({
  name: 'Profile',
  initialState,
  reducers: {
    setProfile: (state, action: PayloadAction<any>) => {
      state.profile = action.payload;
    },
    setInProgress: (state, action: PayloadAction<any>) => {
      state.inProgress = action.payload;
    },
  },
});

export const { setProfile, setInProgress } = ProfileSlice.actions;
export default ProfileSlice.reducer;
