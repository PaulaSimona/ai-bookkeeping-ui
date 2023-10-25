import { useDispatch, useSelector } from 'react-redux';
import api from '../../utils/api';
import { RootState } from '../../store/store';
import {
  setPackageValues,
  setPackages,
} from '../../store/features/packageSlice';
import { useCallback, useEffect } from 'react';

export const usePackage = () => {
  const { number_of_documents, storage_space, packages } = useSelector(
    (s: RootState) => s.package,
  );
  const dispatch = useDispatch();

  const getUserPackagesStatus = async () => {
    api.get('/api/packages/user_package').then((response) => {
      dispatch(
        setPackageValues({
          number_of_documents:
            response.data.number_of_documents_to_upload_total,
          storage_space: response.data.storage_space_total,
        }),
      );
    });
  };

  const getPackages = useCallback(async () => {
    api.get('/api/packages').then((response) => {
      dispatch(setPackages({ packages: response.data }));
    });
  }, [dispatch]);

  useEffect(() => {
    if (packages.length === 0) {
      getPackages();
    }
  }, [getPackages, packages]);

  return {
    getUserPackagesStatus,
    getPackages,
    number_of_documents,
    storage_space,
    packages,
  };
};
