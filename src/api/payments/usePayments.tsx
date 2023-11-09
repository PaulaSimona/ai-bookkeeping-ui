import { useDispatch, useSelector } from 'react-redux';
import api from '../../utils/api';
import { RootState } from '../../store/store';
import { setPaymentsMethodsValues } from '../../store/features/paymentSlice';
import { useToast } from '../../hooks/useToast';
import { useCallback, useEffect, useRef } from 'react';

export const usePayments = () => {
  const { paymentsMethods } = useSelector((s: RootState) => s.payments);
  const isLoading = useRef<boolean>(false);
  const dispatch = useDispatch();
  const { showToast } = useToast();

  const getPayments = useCallback(() => {
    api.get('/api/payments/').then((response) => {
      dispatch(setPaymentsMethodsValues({ payments: response.data }));
    });
  }, [dispatch]);

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
          message: response.data.msg,
          variant: 'danger',
        });
      }
      return response;
    });
  };

  const deletePaymentMethod = async (id: number) => {
    return api.delete(`/api/payments/${id}`).then((response) => {
      if (response.status === 204) {
        showToast({
          title: 'Payment Method deleted',
          message: 'Payment Method was deleted successfully',
          variant: 'success',
        });
      } else {
        showToast({
          title: 'Payment Method not deleted',
          message: response.data.msg,
          variant: 'danger',
        });
      }
      return response;
    });
  };

  const setPrimaryPaymentMethod = async (id: number) => {
    return api.put(`/api/payments/${id}/set-primary`).then((response) => {
      if (response.status === 200) {
        showToast({
          title: 'Payment Method set as primary',
          message: 'Payment Method was set as primary successfully',
          variant: 'success',
        });
      } else {
        showToast({
          title: 'Payment Method not set as primary',
          message: response.data.msg,
          variant: 'danger',
        });
      }
      return response;
    });
  };

  useEffect(() => {
    if (paymentsMethods == null && !isLoading.current) {
      isLoading.current = true;
      getPayments();
    }
  }, [paymentsMethods, isLoading, getPayments]);

  return {
    paymentsMethods,
    getPayments,
    createPaymentMethod,
    deletePaymentMethod,
    setPrimaryPaymentMethod,
  };
};
