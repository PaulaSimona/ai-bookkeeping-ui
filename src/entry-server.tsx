// SSR prerender entry (O-S61-1). Renders the PUBLIC route subtree to a static
// HTML string for build-time prerendering of /, /pricing, /faq.
//
// It reuses the SAME page components App.tsx mounts (no fork of page code) and a
// FRESH default (logged-out) store, so /pricing's `auth.user` read takes the
// !user branch. renderToString never runs effects, so the pages' mount-time
// data hooks do not fire during prerender.
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { Routes, Route } from 'react-router-dom';
import { StaticRouter } from 'react-router-dom/server';
import { Provider } from 'react-redux';

import { makeStore } from '@/store/store';
import { LandingPage } from '@/pages/LandingPage';
import { Pricing } from '@/views/pricing';
import { FAQ } from '@/views/faq';

const PublicApp = () => (
  <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/pricing" element={<Pricing />} />
    <Route path="/faq" element={<FAQ />} />
  </Routes>
);

export function render(url: string): string {
  const store = makeStore();
  return renderToString(
    <StrictMode>
      <Provider store={store}>
        <StaticRouter location={url}>
          <PublicApp />
        </StaticRouter>
      </Provider>
    </StrictMode>,
  );
}
