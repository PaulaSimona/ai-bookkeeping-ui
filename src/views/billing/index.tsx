import { FC, useEffect, useState } from 'react';
import { Container, Row, Col, Table } from 'react-bootstrap';
import { Button } from '../../components/Button/Button';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { EditAddress } from './components/EditAddress';
import { useProfile } from '../../api/user/useProfile';

export const BillingPage: FC = () => {
  const [showEditAddress, setShowEditAddress] = useState(false);
  const { profile, getProfile } = useProfile();

  const onClickDownload = () => {
    console.log('onClickDownload');
  };

  useEffect(() => {
    if (!profile) {
      getProfile();
    }
  }, [getProfile, profile]);

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
              <tr>
                <td>#12345</td>
                <td>06/16/2023</td>
                <td>Additional Storage</td>
                <td>$ 9,90</td>
                <td>
                  <strong
                    className="m_pointer text-primary"
                    onClick={onClickDownload}
                  >
                    Download
                  </strong>
                </td>
              </tr>
              <tr>
                <td>#12345</td>
                <td>06/16/2023</td>
                <td>Additional Storage</td>
                <td>$ 9,90</td>
                <td>
                  <strong
                    className="m_pointer text-primary"
                    onClick={onClickDownload}
                  >
                    Download
                  </strong>
                </td>
              </tr>
              <tr>
                <td>#12345</td>
                <td>06/16/2023</td>
                <td>Additional Storage</td>
                <td>$ 9,90</td>
                <td>
                  <strong
                    className="m_pointer text-primary"
                    onClick={onClickDownload}
                  >
                    Download
                  </strong>
                </td>
              </tr>
            </tbody>
          </Table>
        </Col>
      </Row>

      <div className="my-4 px-2 d-flex justify-content-between align-items-center">
        <h3>Payment Options</h3>
        <Button value="Add New Payment Method" size="sm" />
      </div>

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
            <tr>
              <td>
                <i className="fab fa-cc-visa"></i> Visa
              </td>
              <td>****1089</td>
              <td>Paula S Ripanu</td>
              <td>09/25</td>
              <td>
                <div className="d-flex justify-content-between align-items-center">
                  <Button value="Edit" variant="secondary" size="sm" />
                  <Badge textColor="white" bgColor="primary" id={1}>
                    Primary
                  </Badge>
                  <i className="far fa-trash-alt"></i>
                </div>
              </td>
            </tr>
          </tbody>
        </Table>
      </div>
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
    </Container>
  );
};
