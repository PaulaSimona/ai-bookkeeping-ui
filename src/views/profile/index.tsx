import { BaseSyntheticEvent, useState, FC, useEffect } from 'react';
import { Container, Row, Col, FormLabel, Form } from 'react-bootstrap';

import { FormInput } from '../../components/Form/FormInput';
import { Button } from '../../components/Button/Button';
import { Modal } from '../../components/Modal';
import { isValid, validate } from '../../utils/validator';
import { ChangePassword } from './components/ChangePassword';
import { DeleteProfile } from './components/DeleteProfile';
import { useProfile } from '../../api/user/useProfile';
import { profileType } from '../../types/user';
import { Card } from '../../components/Card';

export const UserProfile: FC = () => {
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showDeleteProfile, setShowDeleteProfile] = useState(false);
  const [profileData, setProfileData] = useState<profileType>({
    company_name: '',
    company_bn: '',
    company_address_street: '',
    company_address_no: '',
    company_address_province: '',
    company_address_city: '',
    company_address_postal_code: '',

    first_name: '',
    last_name: '',
    phone_number: '',
    email: '',
  });
  const [errors, setErrors] = useState<{ [k: string]: string[] }>({
    company_name: [],
    company_bn: [],
    company_address_street: [],
    company_address_no: [],
    company_address_province: [],
    company_address_city: [],
    company_address_postal_code: [],

    first_name: [],
    last_name: [],
    phone_number: [],
    email: [],
  });
  const fields = {
    company_name: [],
    company_bn: [],
    company_address_street: [],
    company_address_no: [],
    company_address_province: [],
    company_address_city: [],
    company_address_postal_code: [],

    first_name: [],
    last_name: [],
    phone_number: [],
    email: [],
  };
  const { profile, getProfile, updateProfile } = useProfile();

  const onHandleChange = (event: BaseSyntheticEvent) => {
    setProfileData({ ...profileData, [event.target.name]: event.target.value });
  };

  const onSave = (event: BaseSyntheticEvent) => {
    event.preventDefault();
    const newError = validate(profileData, fields);
    setErrors(newError);
    if (isValid(newError)) {
      updateProfile(profileData);
    }
  };

  useEffect(() => {
    if (!profile) {
      getProfile();
    }
  }, [profile, getProfile]);

  useEffect(() => {
    if (profile) {
      setProfileData((pd) => ({
        ...pd,
        company_name: profile['company_name'],
        first_name: profile['first_name'],
        last_name: profile['last_name'],
        phone_number: profile['phone_number'],
      }));
    }
  }, [profile]);

  return (
    <Container style={{ maxWidth: 960 }} className="my-4">
      <Row className="mb-2">
        <Col xl="12">
          <Form className="px-2" onSubmit={onSave}>
            <Card>
              <Row>
                <Col sm="6">
                  <FormInput
                    label="Company Name:"
                    fieldName="company_name"
                    value={profileData.company_name}
                    placeholder=""
                    onChange={onHandleChange}
                    errors={errors.company_name}
                    classes="mt-2"
                  />
                </Col>
                <Col sm="6">
                  <FormInput
                    label="BN:"
                    fieldName="company_bn"
                    value={profileData.company_bn}
                    placeholder=""
                    onChange={onHandleChange}
                    errors={errors.company_bn}
                    classes="mt-2"
                  />
                </Col>
              </Row>
              <Row className="align-items-end">
                <Col sm="6">
                  <FormInput
                    label="Company Address:"
                    fieldName="company_address_street"
                    value={profileData.company_address_street}
                    placeholder="Street"
                    onChange={onHandleChange}
                    errors={errors.company_address_street}
                    classes="mt-2"
                  />
                </Col>
                <Col sm="6">
                  <FormInput
                    label=""
                    fieldName="company_address_no"
                    value={profileData.company_address_no}
                    placeholder="No."
                    onChange={onHandleChange}
                    errors={errors.company_address_no}
                    classes="mt-2"
                  />
                </Col>
              </Row>
              <Row className="mt-4">
                <Col sm="3">
                  <FormInput
                    fieldName="company_address_province"
                    value={profileData.company_address_province}
                    placeholder="Province"
                    onChange={onHandleChange}
                    errors={errors.company_address_province}
                    classes="mt-2"
                  />
                </Col>
                <Col sm="3">
                  <FormInput
                    fieldName="company_address_city"
                    value={profileData.company_address_city}
                    placeholder="City"
                    onChange={onHandleChange}
                    errors={errors.company_address_city}
                    classes="mt-2"
                  />
                </Col>
                <Col sm="6">
                  <FormInput
                    label=""
                    fieldName="company_address_postal_code"
                    value={profileData.company_address_postal_code}
                    placeholder="Postal Code"
                    onChange={onHandleChange}
                    errors={errors.company_address_postal_code}
                    classes="mt-2"
                  />
                </Col>
              </Row>
            </Card>
            <Card className="mt-4">
              <Row>
                <Col sm="6">
                  <FormInput
                    label="First Name"
                    fieldName="first_name"
                    value={profileData.first_name}
                    placeholder=""
                    onChange={onHandleChange}
                    errors={errors.first_name}
                    classes="mt-2"
                  />
                </Col>
                <Col sm="6">
                  <FormInput
                    label="Last Name"
                    fieldName="last_name"
                    value={profileData.last_name}
                    placeholder=""
                    onChange={onHandleChange}
                    errors={errors.last_name}
                    classes="mt-2"
                  />
                </Col>
              </Row>

              <Row>
                <Col sm="6">
                  <FormInput
                    label="Phone Number"
                    fieldName="phone_number"
                    value={profileData.phone_number}
                    placeholder=""
                    onChange={onHandleChange}
                    errors={errors.phone_number}
                    classes="mt-2"
                  />
                </Col>
                <Col sm="6">
                  <FormInput
                    label="E-mail address"
                    fieldName="email"
                    value={profileData.email}
                    placeholder=""
                    onChange={onHandleChange}
                    errors={errors.email}
                    classes="mt-2"
                  />
                </Col>
              </Row>
            </Card>
            <div className="mt-4 d-flex flex-row-reverse">
              <div className="d-grid gap-2" style={{ width: 200 }}>
                <Button type="submit" value="Save" />
              </div>
            </div>
          </Form>
          <hr />
          <Row>
            <Col>
              <div className="mt-4">
                <FormLabel>Change Password</FormLabel>
                <br />
                <div className="d-grid gap-2" style={{ width: 200 }}>
                  <Button
                    onClick={() => {
                      setShowChangePassword(true);
                    }}
                    value="Change Password"
                  />
                </div>
              </div>
            </Col>
            <Col>
              <div className="mt-4">
                <FormLabel>Delete Profile</FormLabel>
                <br />
                <div className="d-grid gap-2" style={{ width: 200 }}>
                  <Button
                    onClick={() => {
                      setShowDeleteProfile(true);
                    }}
                    value="Delete"
                    variant="danger"
                    style={{ with: 200 }}
                  />
                </div>
              </div>
            </Col>
          </Row>
          {/* <Notifications /> */}
        </Col>
      </Row>
      <Modal
        opened={showChangePassword}
        title="Change Password"
        contain={
          <ChangePassword handleClose={() => setShowChangePassword(false)} />
        }
        handleClose={() => setShowChangePassword(false)}
        onAccept={() => setShowChangePassword(false)}
        noActions
      />
      <Modal
        opened={showDeleteProfile}
        title="Delete Profile?"
        contain={
          <DeleteProfile
            handleClose={() => {
              setShowDeleteProfile(false);
            }}
          />
        }
        handleClose={() => setShowDeleteProfile(false)}
        onAccept={() => setShowDeleteProfile(false)}
        noActions
      />
    </Container>
  );
};
