import { createHashRouter, Navigate } from 'react-router';
import { App } from './App';
import { HomePage } from './pages/Home';
import ExecutionPage from './pages/Execution';
import { ModuleView } from './pages/ModuleView';
import { RouteErrorFallback } from './components/ui/RouteErrorFallback';

export const router = createHashRouter([
  {
    path: '/',
    Component: App,
    errorElement: <RouteErrorFallback />,
    children: [
      { index: true, Component: HomePage, errorElement: <RouteErrorFallback /> },
      { path: 'execution/:id', Component: ExecutionPage, errorElement: <RouteErrorFallback /> },
      { path: 'module/:id', Component: ModuleView, errorElement: <RouteErrorFallback /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
