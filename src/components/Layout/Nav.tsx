import { useNavigate, NavLink } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { Nav as NavBase, NavDropdown } from 'react-bootstrap';
import { type RootState } from '../../store/store';
import { setUser } from '../../store/features/authSlice';
import { removeAuth } from '../../utils/auth';
import { type FC } from 'react';
import logo from '../../assets/logo.svg';

import './Nav.scss';
import { setProfile } from '../../store/features/profileSlice';

export const Nav: FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const onLogOut = (): void => {
    removeAuth();
    dispatch(setUser(null));
    dispatch(setProfile(null));
    setTimeout(() => {
      navigate('/login');
    }, 200);
  };
  const { user } = useSelector((s: RootState) => s.auth);

  if (!user) {
    return <div />;
  }

  return (
    <div className="nav-container">
      <NavBase className="justify-content-between">
        <NavBase.Item className="px-4 logo_index">
          <NavLink to="/">
            <img className="logo sm" src={logo} alt="NeutraFog" />
          </NavLink>
        </NavBase.Item>
        <div className="topbar-divider d-none d-sm-block" />
        <NavDropdown
          title={
            <div className="nav-user">
              <div className="nav-user-name d-none d-lg-inline text-gray-600 small text-secondary">
                {user.user.email}
              </div>
              <div className="img-profile rounded-circle profile-icon ml-2 text-primary">
                <i className="fas fa-ellipsis-v"></i>
              </div>
            </div>
          }
          id="user-dropdown"
          className="m_pointer"
        >
          <NavDropdown.Item onClick={onLogOut}>logout</NavDropdown.Item>
        </NavDropdown>
      </NavBase>
    </div>
  );
};
