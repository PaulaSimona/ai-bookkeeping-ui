import { FC, useEffect, useRef, useState } from 'react';
import { Container, Row, Col, Table, Alert } from 'react-bootstrap';
import { Button } from '../../components/Button/Button';
import { Modal } from '../../components/Modal';
import { EditAddress } from './components/EditAddress';
import { useProfile } from '../../api/user/useProfile';
import { AddNewPaymentMethod } from './components/AddNewPaymentMethod';
import { usePayments } from '../../api/payments/usePayments';
import { CardIcon } from '../../components/Icons/CardIcon';
import { useInvoices } from '../../api/billing/useInvoices';
import { formatDate } from '../../utils/dates';

export const BillingPage: FC = () => {
  const [showEditAddress, setShowEditAddress] = useState(false);
  const [showAddNewPaymentMethod, setShowAddNewPaymentMethod] = useState(false);
  const [showDeletePaymentMethod, setShowDeletePaymentMethod] = useState(false);
  const [showSetPrimaryPaymentMethod, setShowSetPrimaryPaymentMethod] =
    useState(false);
  const selectedPaymentMethod = useRef<any>();
  const { profile, getProfile } = useProfile();
  const { getInvoices, invoices } = useInvoices();
  const {
    paymentsMethods,
    getPayments,
    deletePaymentMethod,
    setPrimaryPaymentMethod,
  } = usePayments();

  const onClickDownload = () => {
    console.log('onClickDownload');
  };

  const onDeletePaymentMethod = () => {
    setShowDeletePaymentMethod(false);
    if (selectedPaymentMethod.current) {
      deletePaymentMethod(selectedPaymentMethod.current.id).then((response) => {
        if (response.status === 204) {
          getPayments();
        }
      });
    }
  };

  const onSetPrimaryPaymentMethod = () => {
    if (selectedPaymentMethod.current) {
      setPrimaryPaymentMethod(selectedPaymentMethod.current.id).then(
        (response) => {
          if (response.status === 200) {
            setShowSetPrimaryPaymentMethod(false);
            getPayments();
          }
        },
      );
    }
  };

  useEffect(() => {
    if (!profile) {
      getProfile();
      getPayments();
      getInvoices();
    }
  }, [getProfile, getPayments, getInvoices, profile]);

  return (
    <Container style={{ maxWidth: 960 }} className="my-4 profile">
      <Row className="mb-2">
        <Col xl="12">
          <h2 className="px-2 mb-4">Billing</h2>
        </Col>
      </Row>
      <Row className="px-2">
        <Col>
          {profile && (
            <div className="text-small">
              <div>
                <small>{profile.company_name}</small>
              </div>
              <div>
                <small>
                  {profile.company_address} - {profile.company_number}
                </small>
              </div>
              <div>
                <small>
                  {profile.company_postal_code} {profile.company_city} ,
                  {profile.company_province}
                </small>
              </div>
              <div>
                <small>Canada</small>
              </div>
              <div>
                <small>{profile.phone_number}</small>
              </div>
            </div>
          )}
        </Col>
        <Col>
          <div>
            <Button
              value="Edit Address"
              size="sm"
              onClick={() => setShowEditAddress(true)}
            />
          </div>
        </Col>
      </Row>

      <Row className="mt-4 px-2">
        <Col>
          <Table striped bordered hover>
            <thead>
              <tr>
                <th>ID</th>
                <th>Date</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {invoices?.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.id.split('-')[0]}</td>
                  <td>{formatDate(invoice.created_at)}</td>
                  <td>{invoice.description}</td>
                  <td>$ {invoice.amount}</td>
                  <td>
                    <strong
                      className="m_pointer text-primary"
                      onClick={onClickDownload}
                    >
                      Download
                    </strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Col>
      </Row>

      <div className="my-4 px-2 d-flex justify-content-between align-items-center">
        <h3>Payment Options</h3>
        <Button
          value="Add New Payment Method"
          size="sm"
          onClick={() => setShowAddNewPaymentMethod(true)}
        />
      </div>

      {paymentsMethods.length == 0 && (
        <Alert variant="secondary">
          <div className="text-center p-2">
            <div className="mb-4">
              You don't have any payment method registered.
            </div>
            <Button
              variant="primary"
              value="Add a payment method"
              onClick={() => setShowAddNewPaymentMethod(true)}
            />
          </div>
        </Alert>
      )}

      {paymentsMethods.length > 0 && (
        <div className="px-2">
          <Table striped bordered hover>
            <thead>
              <tr>
                <th>Credit Card</th>
                <th>Card Number</th>
                <th>Name</th>
                <th>Expires</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paymentsMethods?.map((paymentMethod: any) => (
                <tr key={paymentMethod.id}>
                  <td>
                    <CardIcon card={paymentMethod.card_brand} />{' '}
                    {paymentMethod.card_brand}
                  </td>
                  <td>****{paymentMethod.card_last4}</td>
                  <td>{paymentMethod.name_payment_method}</td>
                  <td>
                    {paymentMethod.card_exp_month}/{paymentMethod.card_exp_year}
                  </td>
                  <td>
                    <div className="d-flex justify-content-between align-items-center">
                      <Button value="Edit" variant="secondary" size="sm" />
                      {paymentMethod.is_primary ? (
                        <Button
                          value={'Primary'}
                          variant="primary"
                          style={{
                            padding: '0.2rem 0.5rem',
                            fontSize: '0.8rem',
                            width: 100,
                          }}
                        />
                      ) : (
                        <div className="mx-2">
                          <Button
                            value="Set primary"
                            variant="outline-secondary"
                            size="sm"
                            style={{
                              padding: '0.2rem 0.5rem',
                              fontSize: '0.8rem',
                              width: 100,
                            }}
                            onClick={() => {
                              selectedPaymentMethod.current = paymentMethod;
                              setShowSetPrimaryPaymentMethod(true);
                            }}
                          />
                        </div>
                      )}
                      <i
                        className="far fa-trash-alt m_pointer"
                        onClick={() => {
                          selectedPaymentMethod.current = paymentMethod;
                          setShowDeletePaymentMethod(true);
                        }}
                      ></i>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
      <Modal
        opened={showEditAddress}
        title="Edit Address"
        dialogClassName="modal_buy_additional_storage"
        contain={
          <EditAddress
            profile={profile}
            onClose={() => setShowEditAddress(false)}
          />
        }
        handleClose={() => setShowEditAddress(false)}
        onAccept={() => {}}
        noActions={true}
      />
      <Modal
        opened={showAddNewPaymentMethod}
        title="Edit Address"
        dialogClassName="modal_buy_additional_storage"
        contain={
          <AddNewPaymentMethod
            handleOnClose={() => setShowAddNewPaymentMethod(false)}
          />
        }
        handleClose={() => setShowAddNewPaymentMethod(false)}
        onAccept={() => {}}
        noActions={true}
      />
      <Modal
        opened={showDeletePaymentMethod}
        title="Delete Payment Method"
        dialogClassName="modal_buy_additional_storage"
        contain={
          <div>
            <p>Do you want to delete this card?</p>
          </div>
        }
        handleClose={() => setShowDeletePaymentMethod(false)}
        onAccept={onDeletePaymentMethod}
      />
      <Modal
        opened={showSetPrimaryPaymentMethod}
        title="Set Primary Payment Method"
        contain={
          <div>
            <p>Do you want to set this card as primary payment method?</p>
          </div>
        }
        handleClose={() => setShowSetPrimaryPaymentMethod(false)}
        onAccept={onSetPrimaryPaymentMethod}
      />
    </Container>
  );
};
