import { FC } from 'react';
import { Button } from '../../../components/Button/Button';
import './NoStorageAlert.scss';

type NoStorageAlertType = {
  onClickButton: () => void;
};

export const NoStorageAlert: FC<NoStorageAlertType> = ({ onClickButton }) => {
  return (
    <div className="d-flex no_storage_alert my-4">
      <div>
        <i className="fas fa-exclamation-circle text-danger"></i>
      </div>
      <div>Sorry, no storage space left!</div>
      <div>
        <Button
          onClick={() => {
            console.log('onBuyStorageClick');
            onClickButton();
          }}
          value="Buy more storage"
        />
      </div>
    </div>
  );
};
