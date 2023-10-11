import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import api from '../../utils/api';
import { setProfile } from '../../store/features/profileSlice';
import { profileType } from '../../types/user';
import { useToast } from '../../hooks/useToast';

export const useProfile = () => {
  const profile = useSelector((s: RootState) => s.profile.profile);
  const dispatch = useDispatch();
  const { showToast } = useToast();

  const getProfile = () => {
    api.get('/api/user/profile').then((response) => {
      dispatch(setProfile(response.data));
    });
  };
  const updateProfile = (data: profileType) => {
    api
      .put('/api/user/profile', data)
      .then((response) => {
        dispatch(setProfile(response.data));
        showToast({
          title: 'Updated',
          message: 'Profile was updated successfully.',
          variant: 'success',
        });
      })
      .catch(() => {
        showToast({
          title: 'Error',
          message: 'Profile was not updated.',
          variant: 'danger',
        });
      });
  };

  return {
    profile,
    getProfile,
    updateProfile,
  };
};
