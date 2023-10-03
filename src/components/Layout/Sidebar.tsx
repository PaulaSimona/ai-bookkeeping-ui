import { type FC } from 'react';
import { NavLink } from 'react-router-dom';
import { useUser } from '../../api/user/useUser';
import './Sidebar.scss';

interface SidebarItemType {
  path: string;
  icon: string;
  label: string;
}

const SidebarItem: FC<SidebarItemType> = ({ path, icon, label }) => {
  return (
    <li>
      <div>
        <NavLink
          to={path}
          className={({ isActive, isPending }) =>
            isActive ? 'selected' : isPending ? 'pending' : ''
          }
        >
          <i className={`fas fa-${icon}`}></i> {label}
        </NavLink>
      </div>
    </li>
  );
};

export const Sidebar: FC = () => {
  const { user } = useUser(false);
  const sidebarList = [
    { path: '/', icon: 'home', label: 'Home' },
    {
      path: '/upload_documents',
      icon: 'file-upload',
      label: 'Upload documents',
    },
    { path: '/profile', icon: 'user', label: 'My profile' },
    {
      path: '/payments_and_invoices',
      icon: 'money-check',
      label: 'Payments and invoices',
    },
    { path: '/feedback', icon: 'comment-dots', label: 'Feedback' },
    { path: '/contact', icon: 'envelope', label: 'Contact' },
  ];
  const sideBarListAdmin = [{ path: '/users', icon: 'users', label: 'Users' }];
  return (
    <div className="sidebar">
      <div className="sidebar-wrapper">
        <ul>
          {sidebarList.map((e) => (
            <SidebarItem
              path={e.path}
              icon={e.icon}
              label={e.label}
              key={e.path}
            />
          ))}
          {user?.user?.role === 'admin' &&
            sideBarListAdmin.map((e) => (
              <SidebarItem
                path={e.path}
                icon={e.icon}
                label={e.label}
                key={e.path}
              />
            ))}
        </ul>
      </div>
    </div>
  );
};
