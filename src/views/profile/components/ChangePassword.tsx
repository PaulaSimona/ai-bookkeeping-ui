import { BaseSyntheticEvent, FC, useState } from 'react';
import { Button } from '../../../components/Button/Button';
import { FormInput } from '../../../components/Form/FormInput';
import { isValid, validate, VALIDATION } from '../../../utils/validator';

interface ChangePasswordType {
  handleClose: () => any;
}

export const ChangePassword: FC<ChangePasswordType> = ({ handleClose }) => {
  const [data, setData] = useState({
    old_password: '',
    new_password: '',
    new_password2: '',
  });
  const [errors, setErrors] = useState<any>({
    old_password: [],
    new_password: [],
    new_password2: [],
  });
  const fields = {
    old_password: [VALIDATION.REQUIRED],
    new_password: [VALIDATION.REQUIRED, VALIDATION.SECURE_PASSWORD],
    new_password2: [VALIDATION.REQUIRED],
  };

  const onHandleChange = (event: BaseSyntheticEvent) => {
    setData({ ...data, [event.target.name]: event.target.value });
  };

  const onAccept = (event: BaseSyntheticEvent) => {
    event.preventDefault();
    const newErrors = validate(data, fields);
    if (data.new_password !== data.new_password2) {
      newErrors.new_password2.push('La confirmación no coincide.');
    }
    setErrors(newErrors);
    if (isValid(newErrors)) {
      // TODO: update when API is ready
      // changePassword(data);
    }
  };

  return (
    <form onSubmit={onAccept}>
      <div>
        <FormInput
          label="Current Password"
          fieldName="old_password"
          value={data.old_password}
          placeholder="Current Password"
          type="password"
          onChange={onHandleChange}
          errors={[
            ...errors.old_password /* , ...src/views/profile/components/.old_password */,
          ]}
          classes="mb-1"
        />

        <FormInput
          label="New Password"
          fieldName="new_password"
          value={data.new_password}
          placeholder="New Password"
          type="password"
          onChange={onHandleChange}
          errors={[
            ...errors.new_password /* , ...src/views/profile/components/.new_password */,
          ]}
          classes="my-1"
        />

        <FormInput
          label="Confirm New Password"
          fieldName="new_password2"
          value={data.new_password2}
          placeholder="Confirm New Password"
          type="password"
          onChange={onHandleChange}
          errors={[...errors.new_password2 /* , ...errorField.new_password2 */]}
          classes="my-1"
        />
      </div>
      <div className="modal-actions mt-4">
        <div className="d-inline-block">
          <Button
            className="mr-2"
            variant="secondary"
            onClick={handleClose}
            value="Cancel"
          />
        </div>
        <div className="d-inline-block" style={{ float: 'right' }}>
          <Button
            className="ml-2 float-right"
            variant="primary"
            /* disabled={loading} */ type="submit"
            value="Change Password"
          />
        </div>
      </div>
    </form>
  );
};
