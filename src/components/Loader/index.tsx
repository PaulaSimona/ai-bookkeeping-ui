import { type FC } from 'react';
import Spinner from 'react-bootstrap/Spinner';
import './loader.scss';

export const Loader: FC = () => {
  return (
    <Spinner animation="border" role="status">
      <span className="visually-hidden">Loading...</span>
    </Spinner>
  );
};

export const PageLoader: FC = () => {
  return (
    <div className="loader-full">
      <div className="loader-wrapper">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    </div>
  );
};
