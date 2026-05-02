import { createBrowserRouter, Navigate } from 'react-router-dom';
import C2Layout from '@/views/c2/C2Layout';
import DashboardPage from '@/views/c2/pages/DashboardPage';
import MapPage from '@/views/c2/pages/MapPage';
import SubjectsPage from '@/views/c2/pages/SubjectsPage';
import AlertsPage from '@/views/c2/pages/AlertsPage';
import SensorsPage from '@/views/c2/pages/SensorsPage';
import MissionsPage from '@/views/c2/pages/MissionsPage';
import FieldLayout from '@/views/field/FieldLayout';
import HeadsUpPage from '@/views/field/pages/HeadsUpPage';
import NearbyPage from '@/views/field/pages/NearbyPage';
import ReportPage from '@/views/field/pages/ReportPage';

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/c2" replace /> },
  {
    path: '/c2',
    element: <C2Layout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'map', element: <MapPage /> },
      { path: 'subjects', element: <SubjectsPage /> },
      { path: 'alerts', element: <AlertsPage /> },
      { path: 'sensors', element: <SensorsPage /> },
      { path: 'missions', element: <MissionsPage /> },
    ],
  },
  {
    path: '/field',
    element: <FieldLayout />,
    children: [
      { index: true, element: <HeadsUpPage /> },
      { path: 'nearby', element: <NearbyPage /> },
      { path: 'report', element: <ReportPage /> },
    ],
  },
]);
