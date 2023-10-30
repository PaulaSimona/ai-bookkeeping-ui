import api from '../../utils/api';
import { useToast } from '../../hooks/useToast';

type contactType = {
  subject: string;
  message: string;
};

export const useContact = () => {
  const { showToast } = useToast();
  const sendMail = async (data: contactType) => {
    return api.post('/api/contact', data).then((response) => {
      if (response.status === 201) {
        showToast({
          title: 'Email sent',
          message: 'Email was sent successfully.',
          variant: 'success',
        });
      } else {
        console.log(response);
        showToast({
          title: 'Email not sent',
          message: response.data.message,
          variant: 'danger',
        });
      }
    });
  };
  return { sendMail };
};
