import { useDispatch } from 'react-redux';
import { showMessage } from '../store/features/layoutSlice';

interface MessageType {
  title: string;
  message: string;
  variant: string;
}

type ShowToastType = (message: MessageType) => void;
type useToastType = () => { showToast: ShowToastType };

export const useToast: useToastType = () => {
  const dispatch = useDispatch();
  const showToast: ShowToastType = (message) => {
    dispatch(showMessage(message));
  };
  return { showToast };
};
