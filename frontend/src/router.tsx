import { createBrowserRouter, Navigate } from 'react-router-dom';
import C2Layout from '@/views/c2/C2Layout';
import SensorsPage from '@/views/c2/pages/SensorsPage';
import SubjectsPage from '@/views/c2/pages/SubjectsPage';
import FieldLayout from '@/views/field/FieldLayout';
import HeadsUpPage from '@/views/field/pages/HeadsUpPage';

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/c2/sensors" replace /> },
  {
    path: '/c2',
    element: <C2Layout />,
    children: [
      { index: true, element: <Navigate to="sensors" replace /> },
      { path: 'sensors', element: <SensorsPage /> },
      { path: 'subjects', element: <SubjectsPage /> },
    ],
  },
  {
    path: '/field',
    element: <FieldLayout />,
    children: [{ index: true, element: <HeadsUpPage /> }],
  },
]);
