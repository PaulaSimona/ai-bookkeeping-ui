import { type FC, type ReactNode } from 'react';
import { Outlet } from 'react-router';
// import { Breadcrumb, type BreadcrumbType } from '../Breadcrumb';
import './Layout.scss';

interface LayoutType {
  sidebar: ReactNode;
}

interface LayoutContentType {
  children: ReactNode;
  // breadcrumbProps: BreadcrumbType;
}

export const Layout: FC<LayoutType> = ({ sidebar }) => {
  return (
    <div className="layout-wrapper">
      <div className="layout-sidebar">{sidebar}</div>
      <div className="layout-content">
        <Outlet />
      </div>
    </div>
  );
};

export const LayoutContent: FC<LayoutContentType> = ({
  children,
  // breadcrumbProps,
}) => {
  return (
    <div>
      {/* <Breadcrumb {...breadcrumbProps} /> */}
      {children}
    </div>
  );
};
