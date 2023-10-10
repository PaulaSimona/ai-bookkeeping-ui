import { BaseSyntheticEvent, useState, FC, useEffect } from 'react';
import { Container, Row, Col, FormLabel } from 'react-bootstrap';

import { FormInput } from '../../components/Form/FormInput';
import { Button } from '../../components/Button/Button';
import { Modal } from '../../components/Modal';
import { isValid, validate } from '../../utils/validator';
import { ChangePassword } from './components/ChangePassword';
import { DeleteProfile } from './components/DeleteProfile';
import { useProfile } from '../../api/user/useProfile';

export const UserProfile: FC = () => {
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showDeleteProfile, setShowDeleteProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    company_name: '',
    first_name: '',
    last_name: '',
    phone_number: '',
  });
  const [errors, setErrors] = useState<{ [k: string]: string[] }>({
    first_name: [],
    last_name: [],
    phone_number: [],
  });
  const fields = {
    first_name: [],
    last_name: [],
    phone_number: [],
  };
  const { profile, getProfile } = useProfile();

  const onHandleChange = (event: BaseSyntheticEvent) => {
    setProfileData({ ...profileData, [event.target.name]: event.target.value });
  };

  const onSave = () => {
    const newError = validate(profileData, fields);
    setErrors(newError);
    if (isValid(newError)) {
      // updateProfile(profileData);
    }
  };

  useEffect(() => {
    if (!profile) {
      getProfile();
    }
  }, [profile, getProfile]);

  useEffect(() => {
    if (profile) {
      setProfileData({
        company_name: profile['company_name'],
        first_name: profile['first_name'],
        last_name: profile['last_name'],
        phone_number: profile['phone_number'],
      });
    }
  }, [profile]);

  return (
    <Container style={{ maxWidth: 960 }} className="my-4">
      <Row className="mb-2">
        <Col xl="12">
          <form className="px-2">
            <Row>
              <Col sm="12">
                <FormInput
                  label="Company Name - Optional"
                  fieldName="company_name"
                  value={profileData.company_name}
                  placeholder="First Name"
                  onChange={onHandleChange}
                  errors={errors.company_name}
                  classes="mt-2"
                />
              </Col>
            </Row>
            <Row>
              <Col sm="6">
                <FormInput
                  label="First Name"
                  fieldName="first_name"
                  value={profileData.first_name}
                  placeholder="First Name"
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
                  placeholder="Last Name"
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
                  placeholder="Phone Number"
                  onChange={onHandleChange}
                  errors={errors.phone_number}
                  classes="mt-2"
                />
              </Col>
            </Row>

            <div className="mt-4 d-flex flex-row-reverse">
              <div className="d-grid gap-2" style={{ width: 200 }}>
                <Button onClick={onSave} value="Save" />
              </div>
            </div>
          </form>
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
