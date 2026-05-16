import { lazy, Suspense } from 'react';
import { createHashRouter, Navigate } from 'react-router';
import { App } from './App';
import { RouteErrorFallback } from './components/ui/RouteErrorFallback';
import { SpinningIcon } from './components/execution/SpinningIcon';

const HomePage = lazy(() => import('./pages/Home').then((m) => ({ default: m.HomePage })));
const ExecutionPage = lazy(() => import('./pages/Execution'));
const ModuleView = lazy(() => import('./pages/ModuleView').then((m) => ({ default: m.ModuleView })));

function LazyFallback() {
  return (
    <div className="h-full flex items-center justify-center">
      <SpinningIcon className="h-8 w-8" />
    </div>
  );
}

function LazyHomePage() {
  return (
    <Suspense fallback={<LazyFallback />}>
      <HomePage />
    </Suspense>
  );
}

function LazyExecutionPage() {
  return (
    <Suspense fallback={<LazyFallback />}>
      <ExecutionPage />
    </Suspense>
  );
}

function LazyModuleView() {
  return (
    <Suspense fallback={<LazyFallback />}>
      <ModuleView />
    </Suspense>
  );
}

export const router = createHashRouter([
  {
    path: '/',
    Component: App,
    errorElement: <RouteErrorFallback />,
    children: [
      { index: true, Component: LazyHomePage, errorElement: <RouteErrorFallback /> },
      { path: 'execution/:id', Component: LazyExecutionPage, errorElement: <RouteErrorFallback /> },
      { path: 'module/:id', Component: LazyModuleView, errorElement: <RouteErrorFallback /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
