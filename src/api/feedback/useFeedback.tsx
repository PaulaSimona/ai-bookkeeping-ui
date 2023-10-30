import api from '../../utils/api';
import { useToast } from '../../hooks/useToast';

type feedbackType = {
  feedback: string;
};

export const useFeedback = () => {
  const { showToast } = useToast();
  const sendFeedback = async (data: feedbackType) => {
    return api.post('/api/feedback', data).then((response) => {
      if (response.status === 201) {
        showToast({
          title: 'Feedback sent',
          message: 'Feedback was sent successfully.',
          variant: 'success',
        });
      } else {
        showToast({
          title: 'Feedback not sent',
          message: response.data.message,
          variant: 'danger',
        });
      }
    });
  };

  return { sendFeedback };
};
