import { useDispatch, useSelector } from 'react-redux';
import api from '../../utils/api';
import { RootState } from '../../store/store';
import { setPackageValues } from '../../store/features/packageSlice';

export const usePackage = () => {
  const { number_of_documents, storage_space } = useSelector(
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

  return {
    getUserPackagesStatus,
    number_of_documents,
    storage_space,
  };
};
