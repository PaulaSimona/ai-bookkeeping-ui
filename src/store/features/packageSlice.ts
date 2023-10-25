import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface PackageState {
  number_of_documents: number;
  storage_space: number;
}

const initialState: PackageState = {
  number_of_documents: 0,
  storage_space: 0,
};

const PackageSlice = createSlice({
  name: 'package',
  initialState,
  reducers: {
    setPackageValues: (state, action: PayloadAction<any>) => {
      console.log('setPackageValues');
      console.log(action.payload);
      state.number_of_documents = action.payload.number_of_documents;
      state.storage_space = action.payload.storage_space;
    },
  },
});

export const { setPackageValues } = PackageSlice.actions;
export default PackageSlice.reducer;
