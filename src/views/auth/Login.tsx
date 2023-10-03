import { type BaseSyntheticEvent, useEffect, useState, type FC } from 'react';
import { Form, InputGroup, Alert } from 'react-bootstrap';
import { useNavigate, NavLink } from 'react-router-dom';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button/Button';
import { LinkButton } from '../../components/Button/ButtonLink';
import { useLogin } from '../../api/auth/useLogin';
import { isValid, validate } from '../../utils/validator';
import './Login.scss';
import logo from '../../assets/logo.svg';

interface LoginProps {
  getUser: () => void;
}

interface LoginType {
  email: string;
  password: string;
}

export const Login: FC<LoginProps> = ({ getUser }) => {
  const [loginData, setLoginData] = useState<LoginType>({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<any>({ email: [], password: [] });
  const fields = { email: ['required', 'email'], password: ['required'] };
  const navigate = useNavigate();
  const { login, success, error, inProgress, completed } = useLogin();
  const [passwordShown, setPasswordShown] = useState(false);
  const classNamePasswordIcon = `fa fa-${passwordShown ? 'eye-slash' : 'eye'}`;

  useEffect(() => {
    if (success && completed) {
      getUser();
      navigate('/');
    }
  }, [success, completed, getUser, navigate]);

  const onLogin = (event: BaseSyntheticEvent): void => {
    event.preventDefault();
    const newError = validate(loginData, fields);
    setErrors(newError);

    if (isValid(newError)) {
      login(loginData);
    }
  };

  const onHandleChange = (event: BaseSyntheticEvent): void => {
    setLoginData({ ...loginData, [event.target.name]: event.target.value });
  };

  const togglePassword = (): void => {
    setPasswordShown(!passwordShown);
  };

  return (
    <div className="container login">
      <div>
        <div className="logo-wrapper mt-4 text-center">
          <img className="logo" src={logo} alt="AI BOOKKEEPING" />
        </div>
        <div style={{ maxWidth: 500, margin: '0 auto' }} className="mt-4">
          <Card className="login_box p-4  mb-4">
            <h2>Login</h2>
            <form onSubmit={onLogin}>
              {error && <Alert variant="danger">{error}</Alert>}
              <Form.Group className="my-3">
                <Form.Label className="font-weight-bold" htmlFor="email">
                  Email
                </Form.Label>
                <Form.Control
                  key="email"
                  name="email"
                  id="email"
                  placeholder="Email"
                  type="Text"
                  value={loginData.email}
                  onChange={onHandleChange}
                  isInvalid={errors.email.length > 0}
                />
                <Form.Control.Feedback id="email_errors" type="invalid">
                  <ul>
                    {errors.email.map((errorValue: string) => (
                      <li key={`error_email_${errorValue}`}>{errorValue}</li>
                    ))}
                  </ul>
                </Form.Control.Feedback>
              </Form.Group>
              <Form.Group className="my-3">
                <Form.Label className="font-weight-bold" htmlFor="password">
                  Password
                </Form.Label>
                <InputGroup>
                  <Form.Control
                    key="password"
                    name="password"
                    id="password"
                    placeholder="Password"
                    type={passwordShown ? 'text' : 'password'}
                    value={loginData.password}
                    onChange={onHandleChange}
                    isInvalid={errors.password.length > 0}
                  />
                  <div
                    className="input-group-text m_pointer"
                    onClick={togglePassword}
                    aria-hidden="true"
                  >
                    <i className={classNamePasswordIcon} />
                  </div>
                </InputGroup>
                <Form.Control.Feedback id="email_errors" type="invalid">
                  <ul>
                    {errors.password.map((errorValue: string) => (
                      <li key={`error_password_${errorValue}`}>{errorValue}</li>
                    ))}
                  </ul>
                </Form.Control.Feedback>
              </Form.Group>

              <div className="d-grid gap-2">
                <Button type="submit" disabled={inProgress} value="Login" />
              </div>
            </form>

            <div className="d-grid gap-2 my-3">
              <LinkButton to="/register" value="Register" variant="secondary" />
            </div>

            <div className="my-3">
              <NavLink to="/forgot">Forgot Password?</NavLink>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
