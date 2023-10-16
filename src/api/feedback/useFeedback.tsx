import api from '../../utils/api';
import { useToast } from '../../hooks/useToast';

type feedbackType = {
  feedback: string;
};

export const useFeedback = () => {
  const { showToast } = useToast();
  const sendFeedback = async (data: feedbackType) => {
    return api.post('/api/feedback', data).then(() => {
      showToast({
        title: 'Updated',
        message: 'Feedback was sent successfully.',
        variant: 'success',
      });
    });
  };

  return { sendFeedback };
};
