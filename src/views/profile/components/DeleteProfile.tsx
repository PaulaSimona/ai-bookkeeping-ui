import { BaseSyntheticEvent, FC, useState } from 'react';
import { Button } from '../../../components/Button/Button';
import { FormCheck } from 'react-bootstrap';

interface ChangePasswordType {
  handleClose: () => any;
}

export const DeleteProfile: FC<ChangePasswordType> = ({ handleClose }) => {
  const [agree, setAgree] = useState(false);

  const onAccept = (event: BaseSyntheticEvent) => {
    event.preventDefault();
    // TODO: request for Delete Profile
    handleClose();
  };

  return (
    <form onSubmit={onAccept}>
      <div>
        <FormCheck
          checked={agree}
          label="Do you agree to delete the account?"
          type="checkbox"
          onChange={(e: BaseSyntheticEvent) => setAgree(e.target.checked)}
          id={`agree_conditions`}
          name="agree_conditions"
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
            variant="danger"
            type="submit"
            value="Delete Profile"
            disabled={!agree}
          />
        </div>
      </div>
    </form>
  );
};
