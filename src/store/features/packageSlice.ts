import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type PackageType = {
  name: string;
  description: null;
  price: number;
  number_of_documents: number;
  storage_space: number;
  id: any;
};

interface PackageState {
  number_of_documents: number;
  storage_space: number;
  packages: PackageType[];
}

const initialState: PackageState = {
  number_of_documents: 0,
  storage_space: 0,
  packages: [],
};

const PackageSlice = createSlice({
  name: 'package',
  initialState,
  reducers: {
    setPackageValues: (state, action: PayloadAction<any>) => {
      state.number_of_documents = action.payload.number_of_documents;
      state.storage_space = action.payload.storage_space;
    },
    setPackages: (state, action: PayloadAction<any>) => {
      state.packages = action.payload.packages;
    },
  },
});

export const { setPackageValues, setPackages } = PackageSlice.actions;
export default PackageSlice.reducer;
