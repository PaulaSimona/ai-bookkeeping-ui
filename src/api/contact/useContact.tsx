import api from '../../utils/api';
import { useToast } from '../../hooks/useToast';

type contactType = {
  subject: string;
  message: string;
};

export const useContact = () => {
  const { showToast } = useToast();
  const sendMail = async (data: contactType) => {
    return api.post('/api/contact', data).then(() => {
      showToast({
        title: 'Email sent',
        message: 'Email was sent successfully.',
        variant: 'success',
      });
    });
  };
  return { sendMail };
};
