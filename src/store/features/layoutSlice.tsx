import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface CourseState {
  showToast: boolean;
  toastValue: {
    message: string;
    title: string;
    variant: string;
  };
}

const initialState: CourseState = {
  showToast: false,
  toastValue: {
    message: '',
    title: '',
    variant: '',
  },
};

const slice = createSlice({
  name: 'layout',
  initialState,
  reducers: {
    updateShow: (state, action: PayloadAction<any>) => {
      state.showToast = action.payload;
      state.toastValue = {
        variant: '',
        message: '',
        title: '',
      };
    },
    showMessage: (state, action: PayloadAction<any>) => {
      state.showToast = true;
      state.toastValue = action.payload;
    },
  },
});

export const { updateShow, showMessage } = slice.actions;
export default slice.reducer;
