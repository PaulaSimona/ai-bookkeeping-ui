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
import { Register } from './views/auth/Register';
import { UploadDocuments } from './views/documents/UploadDocuments';
import { UserProfile } from './views/profile';
import { Feedback } from './views/feedback';
import { Contact } from './views/contact';
import { BillingPage } from './views/billing';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js/pure';
import CheckoutForm from './components/Form/CheckoutForm';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_SECRET_KEY);

const App: FC = () => {
  const { getUser } = useUser(true);
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
        <Route
          path="/register"
          element={
            <RedirectPage>
              <Register getUser={getUser} />
            </RedirectPage>
          }
        />
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
          <Route
            path="/upload_documents"
            element={
              <RedirectPage privatePath>
                <LayoutContent>
                  <UploadDocuments />
                </LayoutContent>
              </RedirectPage>
            }
          />

          <Route
            path="/profile"
            element={
              <RedirectPage privatePath>
                <LayoutContent>
                  <UserProfile />
                </LayoutContent>
              </RedirectPage>
            }
          />
          <Route
            path="/billing"
            element={
              <RedirectPage privatePath>
                <LayoutContent>
                  <Elements stripe={stripePromise}>
                    <BillingPage />
                  </Elements>
                </LayoutContent>
              </RedirectPage>
            }
          />
          <Route
            path="/test"
            element={
              <RedirectPage privatePath>
                <LayoutContent>
                  <Elements stripe={stripePromise}>
                    <CheckoutForm />
                  </Elements>
                </LayoutContent>
              </RedirectPage>
            }
          />
          <Route
            path="/feedback"
            element={
              <RedirectPage privatePath>
                <LayoutContent>
                  <Feedback />
                </LayoutContent>
              </RedirectPage>
            }
          />
          <Route
            path="/contact"
            element={
              <RedirectPage privatePath>
                <LayoutContent>
                  <Contact />
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
