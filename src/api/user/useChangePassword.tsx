import api from '../../utils/api';
import { useToast } from '../../hooks/useToast';

type ChangePasswordType = {
  old_password: string;
  new_password: string;
  new_password2: string;
};

export const useChangePassword = () => {
  const { showToast } = useToast();

  const changePassword = async (data: ChangePasswordType) => {
    return api.put('/api/user/password', data).then((response) => {
      console.log(response.status);
      if (response.status === 200) {
        showToast({
          title: 'Password changed',
          message: 'Password was changed successfully.',
          variant: 'success',
        });
      } else {
        showToast({
          title: 'Password change failed',
          message: 'Password change failed.',
          variant: 'danger',
        });
      }
      return response;
    });
  };

  return { changePassword };
};
