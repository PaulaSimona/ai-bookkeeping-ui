import api from '../../utils/api';
import { useToast } from '../../hooks/useToast';
import { useDispatch, useSelector } from 'react-redux';
import { setInvoices } from '../../store/features/billingSlice';
import { RootState } from '../../store/store';
import { useEffect, useRef, useCallback } from 'react';

export const useInvoices = () => {
  const { invoices } = useSelector((s: RootState) => s.billing);
  const isLoading = useRef<boolean>(false);
  const { showToast } = useToast();
  const dispatch = useDispatch();

  const getInvoices = useCallback(async () => {
    return api.get('/api/billing/invoices').then((response) => {
      if (response.status === 200) {
        dispatch(setInvoices(response.data));
      } else {
        showToast({
          title: 'Invoices not found',
          message: response.data.message,
          variant: 'danger',
        });
      }
      return response;
    });
  }, [dispatch, showToast]);

  useEffect(() => {
    if (invoices == null && !isLoading.current) {
      isLoading.current = true;
      getInvoices();
    }
  }, [invoices, isLoading, getInvoices]);

  return {
    getInvoices,
    invoices,
  };
};
