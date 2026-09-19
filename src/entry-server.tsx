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
import App from '@/App';

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

// O-S79-3: the SAME tree src/main.tsx mounts on the client, rendered to a
// string so the build can prove the client's FIRST render of a prerendered
// route is byte-identical to what was prerendered. BrowserRouter ->
// StaticRouter is the ONLY difference from main.tsx:20-28; the store is a
// fresh default one, i.e. an anonymous visitor, which is the only visitor
// whose first render is knowable at build time.
//
// This is a BUILD-TIME ASSERTION HELPER. It is never used to produce
// prerendered output - render() above still does that - and the bundle it ends
// up in, dist/server/, is a build-only artifact that the backend image MUST NOT
// serve. Stated as an obligation rather than a fact on purpose: at the time of
// writing the backend copies all of dist/ into WHITENOISE_ROOT, so
// /server/entry-server.js IS reachable in production (F-S79-2). Adding App to
// this module therefore enlarges that exposure until F-S79-2 is closed.
export function renderClient(url: string): string {
  const store = makeStore();
  return renderToString(
    <StrictMode>
      <Provider store={store}>
        <StaticRouter location={url}>
          <App />
        </StaticRouter>
      </Provider>
    </StrictMode>,
  );
}
