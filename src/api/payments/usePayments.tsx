import { useDispatch, useSelector } from 'react-redux';
import api from '../../utils/api';
import { RootState } from '../../store/store';
import { setPaymentsMethodsValues } from '../../store/features/paymentSlice';
import { useToast } from '../../hooks/useToast';

export const usePayments = () => {
  const { paymentsMethods } = useSelector((s: RootState) => s.payments);
  const dispatch = useDispatch();
  const { showToast } = useToast();

  const getPayments = () => {
    api.get('/api/payments/').then((response) => {
      dispatch(setPaymentsMethodsValues({ payments: response.data }));
    });
  };

  const createPaymentMethod = async (data: any) => {
    return api.post('/api/payments/', data).then((response) => {
      if (response.status === 201) {
        showToast({
          title: 'Payment Method created',
          message: 'Payment Method was created successfully',
          variant: 'success',
        });
      } else {
        showToast({
          title: 'Payment Method not created',
          message: response.data.message,
          variant: 'danger',
        });
      }
      return response;
    });
  };

  return {
    paymentsMethods,
    getPayments,
    createPaymentMethod,
  };
};
