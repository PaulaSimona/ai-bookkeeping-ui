import { type BaseSyntheticEvent, type FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Alert, Button, Card, Form } from 'react-bootstrap';
import { NavLink } from 'react-router-dom';
import { useRegister } from '../../api/auth/useRegister';
import { isValid, validate, VALIDATION } from '../../utils/validator';
import { FormInput } from '../../components/Form/FormInput';
import './Register.scss';
import logo from '../../assets/logo.svg';

const { REQUIRED, EMAIL, SECURE_PASSWORD, MATCH_PASSWORD } = VALIDATION;

interface RegisterType {
  getUser: () => void;
}

export const Register: FC<RegisterType> = ({ getUser }) => {
  const { register, success, error, errors, inProgress, completed } =
    useRegister();
  const [data, setData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    password: '',
    confirm: '',
  });
  const [errorFields, setErrorFields] = useState<any>({
    email: [],
    first_name: [],
    last_name: [],
    phone_number: [],
    password: [],
    confirm: [],
  });
  const fields = {
    email: [REQUIRED, EMAIL],
    first_name: [REQUIRED],
    last_name: [REQUIRED],
    phone_number: [REQUIRED],
    password: [REQUIRED, SECURE_PASSWORD],
    confirm: [REQUIRED, MATCH_PASSWORD],
  };
  const navigate = useNavigate();

  useEffect(() => {
    if (success && completed) {
      getUser();
      navigate('/');
    }
  }, [success, completed, getUser, navigate]);

  const onRegister = (event: BaseSyntheticEvent): void => {
    event.preventDefault();
    const newErrors = validate(data, fields);
    setErrorFields(newErrors);
    if (isValid(newErrors)) {
      void register(data);
    }
  };

  const onHandleChange = (event: BaseSyntheticEvent): void => {
    setData({ ...data, [event.target.name]: event.target.value });
  };

  return (
    <div className="container register">
      <div className="register-wrapper">
        <div className="logo-wrapper mt-4 text-center">
          <img className="logo" src={logo} alt="AI BOOKKEEPING" />
        </div>
        <Card className="p-4 mt-4">
          <h2>Register</h2>
          {error && (
            <Alert variant="danger">Something is wrong, try again later</Alert>
          )}
          <Form onSubmit={onRegister}>
            <div className="mt-4">
              <FormInput
                type="text"
                fieldName="first_name"
                placeholder="First Name"
                value={data.first_name}
                onChange={onHandleChange}
                errors={[...errorFields.first_name, ...errors.first_name]}
              />
            </div>
            <div className="mt-4">
              <FormInput
                type="text"
                fieldName="last_name"
                placeholder="Last Name"
                value={data.last_name}
                onChange={onHandleChange}
                errors={[...errorFields.last_name, ...errors.last_name]}
              />
            </div>
            <div className="mt-4">
              <FormInput
                type="text"
                fieldName="email"
                placeholder="e-mail"
                value={data.email}
                onChange={onHandleChange}
                errors={[...errorFields.email, ...errors.email]}
              />
            </div>
            <div className="mt-4">
              <FormInput
                type="text"
                fieldName="phone_number"
                placeholder="Phone Number"
                value={data.phone_number}
                onChange={onHandleChange}
                errors={[...errorFields.phone_number, ...errors.phone_number]}
              />
            </div>
            <div className="mt-4">
              <FormInput
                type="password"
                fieldName="password"
                placeholder="Contraseña"
                value={data.password}
                onChange={onHandleChange}
                errors={[...errorFields.password, ...errors.password]}
              />
            </div>
            <div className="mt-4">
              <FormInput
                type="password"
                fieldName="confirm"
                placeholder="Confirmar Contraseña"
                value={data.confirm}
                onChange={onHandleChange}
                errors={[...errorFields.confirm, ...errors.confirm]}
              />
            </div>
            <div className="d-grid gap-2 mt-4">
              <Button disabled={inProgress} type="submit">
                Registrarse
              </Button>
            </div>
          </Form>
          <div className="mt-4">
            Have an account? <NavLink to="/login">Login</NavLink>
          </div>
        </Card>
      </div>
    </div>
  );
};
