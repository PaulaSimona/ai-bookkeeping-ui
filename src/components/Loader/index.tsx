import { type FC } from 'react';

export const Loader: FC = () => (
  <div className="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
);

export const PageLoader: FC = () => (
  <div className="flex items-center justify-center h-screen bg-gray-50">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-3 border-[#0066FF] border-t-transparent rounded-full animate-spin" />
      <span className="text-sm text-gray-500">Loading…</span>
    </div>
  </div>
);
