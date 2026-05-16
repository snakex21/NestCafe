import { StrictMode } from 'react';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { initI18n } from './i18n';
import { router } from './router';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import './styles/globals.css';

// Expose React globally so dynamically loaded modules can use it
(window as unknown as Record<string, unknown>).React = React;

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);

function renderStartupError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  root.render(
    <div className="flex min-h-screen items-center justify-center bg-background p-8 text-foreground">
      <div className="max-w-md rounded-xl border border-destructive/30 bg-card p-6 text-center shadow-sm">
        <h1 className="mb-2 text-lg font-semibold">Unable to start NestCafe</h1>
        <p className="break-all text-sm text-muted-foreground">{message}</p>
      </div>
    </div>,
  );
}

initI18n()
  .then(() => {
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <RouterProvider router={router} />
        </ErrorBoundary>
      </StrictMode>,
    );
  })
  .catch((error: unknown) => {
    console.error('[Startup] Failed to initialize renderer:', error);
    renderStartupError(error);
  });
