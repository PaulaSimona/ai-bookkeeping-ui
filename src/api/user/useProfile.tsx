import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import api from '../../utils/api';
import { setProfile } from '../../store/features/profileSlice';

export const useProfile = () => {
  const profile = useSelector((s: RootState) => s.profile.profile);
  const dispatch = useDispatch();

  const getProfile = () => {
    api.get('/api/user/profile').then((response) => {
      dispatch(setProfile(response.data));
    });
  };

  return {
    profile,
    getProfile,
  };
};
