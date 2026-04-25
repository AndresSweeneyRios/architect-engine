import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom';
import {
  createHashRouter,
  RouteObject,
  RouterProvider,
} from "react-router-dom";
import './index.css';

const Home = lazy(() => import('./pages/Home'));
const NotFound = lazy(() => import('./pages/_notfound'));

const routes: RouteObject[] = [
  {
    path: "/",
    element: <Suspense fallback={<div></div>}><Home /></Suspense>,
  },
  {
    path: "*",
    element: <Suspense fallback={<div></div>}><NotFound /></Suspense>,
  }
];

const router = createHashRouter(routes);

ReactDOM.render(
  <React.StrictMode>
    <RouterProvider router={router} future={{
      v7_startTransition: true,
    }} />
    <div id="debug">
    </div>
  </React.StrictMode>,
  document.getElementById('root')
);