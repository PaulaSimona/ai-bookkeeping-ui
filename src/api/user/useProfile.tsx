import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import api from '../../utils/api';
import { setProfile } from '../../store/features/profileSlice';
import { profileType } from '../../types/user';
import { useToast } from '../../hooks/useToast';
import { removeAuth } from '../../utils/auth';
import { setUser } from '../../store/features/authSlice';
import { useNavigate } from 'react-router-dom';

export const useProfile = () => {
  const profile = useSelector((s: RootState) => s.profile.profile);
  const dispatch = useDispatch();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const getProfile = () => {
    api.get('/api/user/profile').then((response) => {
      const data = {
        id: response.data['id'],
        email: response.data['email'],
        role: response.data['role'],
        first_name: response.data['first_name'],
        last_name: response.data['last_name'],
        phone_number: response.data['phone_number'],
        is_active: response.data['is_active'],
        company_name: response.data['company']['company_name'],
        company_business_number: response.data['company']['business_number'],
        company_address: response.data['company']['address'],
        company_number: response.data['company']['number'],
        company_province: response.data['company']['province'],
        company_city: response.data['company']['city'],
        company_postal_code: response.data['company']['postal_code'],
      };
      dispatch(setProfile(data));
    });
  };
  const updateProfile = async (data: profileType) => {
    const request_data = {
      email: data['email'],
      role: data['role'],
      first_name: data['first_name'],
      last_name: data['last_name'],
      phone_number: data['phone_number'],
      is_active: data['is_active'],
      company: {
        company_name: data['company_name'],
        business_number: data['company_business_number'],
        address: data['company_address'],
        number: data['company_number'],
        province: data['company_province'],
        city: data['company_city'],
        postal_code: data['company_postal_code'],
      },
    };
    return api
      .put('/api/user/profile', request_data)
      .then((response) => {
        const new_data = {
          id: response.data['id'],
          email: response.data['email'],
          role: response.data['role'],
          first_name: response.data['first_name'],
          last_name: response.data['last_name'],
          phone_number: response.data['phone_number'],
          is_active: response.data['is_active'],
          company_name: response.data['company']['company_name'],
          company_business_number: response.data['company']['business_number'],
          company_address: response.data['company']['address'],
          company_number: response.data['company']['number'],
          company_province: response.data['company']['province'],
          company_city: response.data['company']['city'],
          company_postal_code: response.data['company']['postal_code'],
        };
        dispatch(setProfile(new_data));
        showToast({
          title: 'Updated',
          message: 'Profile was updated successfully.',
          variant: 'success',
        });
        return response;
      })
      .catch(() => {
        showToast({
          title: 'Error',
          message: 'Profile was not updated.',
          variant: 'danger',
        });
      });
  };

  const deleteProfile = async (data: { command: string }) => {
    return api.post('/api/user/deactivate-user', data).then((response) => {
      if (response.status === 200) {
        showToast({
          title: 'Deleted',
          message: 'Profile was deleted successfully.',
          variant: 'success',
        });
        setTimeout(() => {
          dispatch(setUser(null));
          removeAuth();
          navigate('/login');
        }, 3000);
      }
    });
  };

  return {
    profile,
    getProfile,
    updateProfile,
    deleteProfile,
  };
};
