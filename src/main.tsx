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

const isWebGPUSupported = typeof navigator !== "undefined" && "gpu" in navigator;

let appContent: React.ReactNode;

if (isWebGPUSupported) {
  const router = createHashRouter(routes);

  appContent = (
    <>
      <RouterProvider router={router} future={{
        v7_startTransition: true,
      }} />
      <div id="debug">
      </div>
    </>
  );
} else {
  appContent = (
    <div>
      <p>WebGPU is required to run this project.</p>
      <p>
        Your browser does not appear to support WebGPU. Check support here: <a href="https://caniuse.com/?search=webgpu" target="_blank" rel="noreferrer">https://caniuse.com/?search=webgpu</a>
      </p>
    </div>
  );
}

ReactDOM.render(
  <React.StrictMode>
    {appContent}
  </React.StrictMode>,
  document.getElementById('root')
);