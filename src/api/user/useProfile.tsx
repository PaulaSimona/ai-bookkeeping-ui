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
  const updateProfile = (data: profileType) => {
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
    api
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
