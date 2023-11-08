import api from '../../utils/api';
import { useToast } from '../../hooks/useToast';
import { useDispatch, useSelector } from 'react-redux';
import { setInvoices } from '../../store/features/billingSlice';
import { RootState } from '../../store/store';

export const useInvoices = () => {
  const invoices = useSelector((s: RootState) => s.blilling.invoices);
  const { showToast } = useToast();
  const dispatch = useDispatch();

  const getInvoices = async () => {
    return api.get('/api/billing/invoices').then((response) => {
      if (response.status === 200) {
        console.log('getInvoices');
        console.log(response.data);
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
  };

  return {
    getInvoices,
    invoices,
  };
};
