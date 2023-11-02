import { BaseSyntheticEvent, FC, useState } from 'react';
import { Row, Col, Form } from 'react-bootstrap';

import { FormSelect } from '../../../components/Form/FormSelect';
import { PROVINCES_CANADA_LIST } from '../../../utils/constants';
import { FormInput } from '../../../components/Form/FormInput';
import { Button } from '../../../components/Button/Button';
import { useProfile } from '../../../api/user/useProfile';
import { isValid, validate } from '../../../utils/validator';

type EditAddressType = {
  profile: any;
  onClose: () => any;
};

export const EditAddress: FC<EditAddressType> = ({ profile, onClose }) => {
  const [profileData, setProfileData] = useState(profile);
  const [isLoading, setIsLoading] = useState(false);
  const { updateProfile } = useProfile();

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

  const onSave = (e: BaseSyntheticEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);

    const newError = validate(profileData, fields);
    setErrors(newError);
    if (isValid(newError)) {
      updateProfile(profileData).then(() => {
        onClose();
        setIsLoading(false);
      });
    }
  };

  const onHandleChange = (event: BaseSyntheticEvent) => {
    setProfileData({ ...profileData, [event.target.name]: event.target.value });
  };

  return (
    <div>
      <Form className="px-2" onSubmit={onSave}>
        <Row>
          <Col sm={8}>
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
          <Col sm={4}>
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
          <Col sm={8}>
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
          <Col sm={4}>
            <FormInput
              label="No."
              fieldName="company_number"
              value={profileData.company_number}
              placeholder="No."
              onChange={onHandleChange}
              errors={errors.company_number}
              classes="mt-2"
            />
          </Col>
        </Row>
        <Row className="my-4">
          <Col sm={4}>
            <FormSelect
              classes="mt-2"
              fieldName="company_province"
              value={profileData.company_province}
              options={PROVINCES_CANADA_LIST}
              onChange={onHandleChange}
              errors={errors.company_province}
            />
          </Col>
          <Col sm={4}>
            <FormInput
              fieldName="company_city"
              value={profileData.company_city}
              placeholder="City"
              onChange={onHandleChange}
              errors={errors.company_city}
              classes="mt-2"
            />
          </Col>
          <Col sm={4} className="mb-4">
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
          <hr />
          <Col className="d-flex flex-row-reverse">
            <div style={{ float: 'right' }}>
              <Button type="submit" value="Update Address" variant="primary" />
            </div>
            <div style={{ float: 'right', marginRight: '1rem' }}>
              <Button
                type="submit"
                value="Cancel"
                variant="secondary"
                onClick={onClose}
                disabled={isLoading}
              />
            </div>
          </Col>
        </Row>
      </Form>
    </div>
  );
};
