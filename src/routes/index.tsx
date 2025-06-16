import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { SchedulingPage } from '../pages/Scheduling';
import App from '../App';
import { AdminPage } from '../components/AdminPage';
import ServiceActivity from '../components/ServiceActivity';
// import { SupabaseIntegration } from '../pages/Admin/SupabaseIntegration';
import { Login } from "../components/Login";
import { Register } from '../components/Register';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { ReactNode } from 'react';

// Componente para layout principal (sem autenticação)
const MainLayout = () => {
  return <Outlet />;
};

// Componente RequireAuth para proteger rotas
function RequireAuth({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate('/login', { replace: true });
      }
    });
  }, [navigate]);

  return children;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/cadastro',
    element: <Register />,
  },
  {
    element: <MainLayout />,
    children: [
      {
        path: '/',
        element: <RequireAuth><Layout /></RequireAuth>,
        children: [
          {
            index: true,
            element: <App />
          },
          {
            path: 'configuracoes',
            element: <AdminPage />,
            children: [
              {
                index: true,
                element: <Navigate to="/configuracoes/empresa" replace />
              },
              {
                path: 'empresa',
                element: <AdminPage />
              },
              {
                path: 'usuarios',
                element: <AdminPage />
              },
              {
                path: 'produtos',
                element: <AdminPage />
              },
              {
                path: 'assinaturas',
                element: <AdminPage />
              },
              {
                path: 'downloads',
                element: <AdminPage />
              },
              {
                path: 'backup',
                element: <AdminPage />
              }
            ]
          },
          {
            path: 'atividades',
            element: <ServiceActivity serviceType="" targetPest="" location="" observations="" applicationMethod="" productAmount="" state={{}} startTime={null} endTime={null} isLoading={false} showDeviceModal={false} onServiceTypeChange={() => {}} onTargetPestChange={() => {}} onLocationChange={() => {}} onApplicationMethodChange={() => {}} onProductAmountChange={() => {}} onObservationsChange={() => {}} onOpenDeviceModal={() => {}} onCloseDeviceModal={() => {}} onFinishOS={() => {}} onApproveOS={() => {}} onProductSelect={() => {}} onDeviceChange={() => {}} onStatusChange={() => {}} onQuantityChange={() => {}} onDeviceClick={() => {}} onSelectAll={() => {}} onSaveDevices={() => {}} canFinishOS={() => false} canSave={false} />
          }
        ]
      }
    ]
  },
  {
    path: '*',
    element: <Navigate to="/login" replace />
  }
]);
