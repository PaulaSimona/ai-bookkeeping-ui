import { type FC } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Routes, Route } from 'react-router-dom';

import { useUser } from './api/user/useUser';

import { Dashboard } from './views/dashboard';
import { Login } from './views/auth/Login';
// import { Register } from './views/auth/Register';

import { RedirectPage } from './components/Redirect';
import { Nav } from './components/Layout/Nav';
import { Layout, LayoutContent } from './components/Layout/Layout';
import { Sidebar } from './components/Layout/Sidebar';
import { Toast } from './components/Toast';

import { type RootState } from './store/store';
import { updateShow } from './store/features/layoutSlice';

const App: FC = () => {
  const { getUser } = useUser();
  const layout = useSelector((s: RootState) => s.layout);
  const dispatch = useDispatch();
  const updateToast = (value: boolean): void => {
    dispatch(updateShow(value));
  };

  return (
    <div className="App">
      <Nav />
      <Routes>
        <Route
          path="/login"
          element={
            <RedirectPage>
              <Login getUser={getUser} />
            </RedirectPage>
          }
        />
        {/* <Route
          path="/register"
          element={
            <RedirectPage>
              <Register getUser={getUser} />
            </RedirectPage>
          }
        /> */}
        <Route element={<Layout sidebar={<Sidebar />} />}>
          <Route
            path="/"
            element={
              <RedirectPage privatePath>
                <LayoutContent>
                  <Dashboard />
                </LayoutContent>
              </RedirectPage>
            }
          />
        </Route>
      </Routes>
      <Toast
        data={layout?.toastValue}
        onClose={() => {
          updateToast(false);
        }}
        show={layout.showToast}
      />
    </div>
  );
};

export default App;
