import { useDispatch } from 'react-redux';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import { setPackageValues } from '../../store/features/packageSlice';

export const useBuyPackage = () => {
  const { showToast } = useToast();
  const dispatch = useDispatch();

  const buyPackage = async (packageId: number, paymentMethodId: string) => {
    const data = {
      package_id: packageId,
      payment_method_id: paymentMethodId,
    };

    return api.post('/api/packages/buy_package', data).then((response) => {
      if (response.status === 201) {
        dispatch(
          setPackageValues({
            number_of_documents:
              response.data.number_of_documents_to_upload_total,
            storage_space: response.data.storage_space_total,
          }),
        );
        showToast({
          title: 'Package bought',
          message: 'Package was bought successfully',
          variant: 'success',
        });
      } else {
        showToast({
          title: 'Package not bought',
          message: response.data.message,
          variant: 'danger',
        });
      }
      return response;
    });
  };

  return { buyPackage };
};
