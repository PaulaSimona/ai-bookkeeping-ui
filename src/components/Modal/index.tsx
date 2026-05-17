// @ts-nocheck
import { FC, cloneElement } from 'react';
import { Modal as ModalBase } from 'react-bootstrap';
import { Button } from '../Button/Button';

interface ModalType {
  opened: boolean;
  title: string;
  contain: any;
  dialogClassName?: string;
  handleClose: () => any;
  onAccept: (data?: any) => any;
  noActions?: boolean;
  textCancel?: string;
  textConfirm?: string;
}

export const Modal: FC<ModalType> = ({
  opened,
  title,
  textCancel = 'Close',
  textConfirm = 'Save',
  contain,
  handleClose,
  onAccept,
  noActions = false,
  dialogClassName = '',
}) => (
  <ModalBase
    show={opened}
    onHide={handleClose}
    dialogClassName={dialogClassName}
  >
    <ModalBase.Header closeButton>
      <ModalBase.Title>{title}</ModalBase.Title>
    </ModalBase.Header>
    <ModalBase.Body>
      {cloneElement(contain, { onAccept, handleClose })}
    </ModalBase.Body>
    {!noActions && (
      <ModalBase.Footer>
        <Button variant="secondary" onClick={handleClose} value={textCancel} />
        <Button variant="primary" onClick={onAccept} value={textConfirm} />
      </ModalBase.Footer>
    )}
  </ModalBase>
);
