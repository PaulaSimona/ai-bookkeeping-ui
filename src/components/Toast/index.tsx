import { type FC } from 'react';
import ToastBase from 'react-bootstrap/Toast';

interface ToastType {
  onClose: () => void;
  show: boolean;
  data: {
    message: string;
    title: string;
    variant: string;
  };
}

export const Toast: FC<ToastType> = ({ onClose, show, data }: any) => (
  <div className="toast_container">
    <ToastBase
      onClose={onClose}
      bg={data.variant}
      show={show}
      delay={8000}
      autohide
    >
      <ToastBase.Header>
        <img src="holder.js/20x20?text=%20" className="rounded me-2" alt="" />
        <strong className="me-auto">{data.title}</strong>
      </ToastBase.Header>
      <ToastBase.Body>{data.message}</ToastBase.Body>
    </ToastBase>
  </div>
);
