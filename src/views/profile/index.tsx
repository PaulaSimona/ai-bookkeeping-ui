import { BaseSyntheticEvent, useState, FC, useEffect } from 'react';
import { Container, Row, Col, Form } from 'react-bootstrap';

import { FormInput } from '../../components/Form/FormInput';
import { Button } from '../../components/Button/Button';
import { Modal } from '../../components/Modal';
import { isValid, validate } from '../../utils/validator';
import { ChangePassword } from './components/ChangePassword';
import { DeleteProfile } from './components/DeleteProfile';
import { useProfile } from '../../api/user/useProfile';
import { profileType } from '../../types/user';
import { Card } from '../../components/Card';
import flag from '../../assets/flag.svg';
import { FormSelect } from '../../components/Form/FormSelect';
import { PROVINCES_CANADA_LIST } from '../../utils/constants';

export const UserProfile: FC = () => {
  const [showDeleteProfile, setShowDeleteProfile] = useState(false);
  const [errorDelete, setErrorDelete] = useState<string[]>([]);
  const [deleteInput, setDeleteInput] = useState('');
  const [profileData, setProfileData] = useState<profileType>({
    company_name: '',
    company_business_number: '',
    company_address: '',
    company_number: '',
    company_province: '',
    company_city: '',
    company_postal_code: '',

    first_name: '',
    last_name: '',
    phone_number: '',
    email: '',
    role: '',
    is_active: true,
  });
  const [errors, setErrors] = useState<{ [k: string]: string[] }>({
    company_name: [],
    company_business_number: [],
    company_address: [],
    company_number: [],
    company_province: [],
    company_city: [],
    company_postal_code: [],

    first_name: [],
    last_name: [],
    phone_number: [],
    email: [],
  });
  const fields = {
    company_name: [],
    company_business_number: [],
    company_address: [],
    company_number: [],
    company_province: [],
    company_city: [],
    company_postal_code: [],

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
      setProfileData(profile);
    }
  }, [profile]);

  const onClickDeleteButton = (e: BaseSyntheticEvent) => {
    e.preventDefault();
    if (deleteInput == 'delete') {
      setShowDeleteProfile(true);
    } else {
      setErrorDelete([`this field must be "delete"`]);
    }
  };

  return (
    <Container style={{ maxWidth: 960 }} className="my-4 profile">
      <Row className="mb-2">
        <Col xl="12">
          <h2 className="px-2 mb-4">My Profile</h2>
          <Form className="px-2" onSubmit={onSave}>
            <Card className="p-2 position-relative">
              <div className="position-absolute flag-wrapper">
                <img src={flag} />
              </div>
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
                <Col md={3} sm={6}>
                  <FormInput
                    label="BN:"
                    fieldName="company_business_number"
                    value={profileData.company_business_number}
                    placeholder=""
                    onChange={onHandleChange}
                    errors={errors.company_business_number}
                    classes="mt-2"
                  />
                </Col>
              </Row>
              <Row className="align-items-end">
                <Col sm="6">
                  <FormInput
                    label="Company Address:"
                    fieldName="company_address"
                    value={profileData.company_address}
                    placeholder="Street"
                    onChange={onHandleChange}
                    errors={errors.company_address}
                    classes="mt-2"
                  />
                </Col>
                <Col md={3} sm={6}>
                  <FormInput
                    label=""
                    fieldName="company_number"
                    value={profileData.company_number}
                    placeholder="No."
                    onChange={onHandleChange}
                    errors={errors.company_number}
                    classes="mt-2"
                  />
                </Col>
              </Row>
              <Row className="mt-4">
                <Col sm="3">
                  <FormSelect
                    classes="mt-2"
                    fieldName="company_province"
                    value={profileData.company_province}
                    options={PROVINCES_CANADA_LIST}
                    onChange={onHandleChange}
                    errors={errors.company_province}
                  />
                </Col>
                <Col sm="3">
                  <FormInput
                    fieldName="company_city"
                    value={profileData.company_city}
                    placeholder="City"
                    onChange={onHandleChange}
                    errors={errors.company_city}
                    classes="mt-2"
                  />
                </Col>
                <Col md={3} sm={6}>
                  <FormInput
                    label=""
                    fieldName="company_postal_code"
                    value={profileData.company_postal_code}
                    placeholder="Postal Code"
                    onChange={onHandleChange}
                    errors={errors.company_postal_code}
                    classes="mt-2"
                  />
                </Col>
              </Row>
            </Card>
            <Card className="mt-4 p-2">
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

          <div className="px-2">
            <Row>
              <Col>
                <ChangePassword />
              </Col>
            </Row>
          </div>

          <hr />

          <div className="px-2">
            <Row>
              <Col>
                <Card>
                  <h3 className="mb-4">Delete Profile</h3>
                  <Form onSubmit={onClickDeleteButton}>
                    <Row className="mt-2">
                      <Col md="6" className="mb-4">
                        <FormInput
                          fieldName="email"
                          value={deleteInput}
                          placeholder={`write: "delete"`}
                          onChange={(e) => {
                            setDeleteInput(e.target.value);
                          }}
                          errors={errorDelete}
                        />
                      </Col>
                      <Col md="6">
                        <div style={{ float: 'right' }}>
                          <Button
                            type="submit"
                            value="Delete Profile"
                            variant="danger"
                            style={{ width: 200 }}
                          />
                        </div>
                      </Col>
                    </Row>
                  </Form>
                </Card>
              </Col>
            </Row>
          </div>
        </Col>
      </Row>

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
