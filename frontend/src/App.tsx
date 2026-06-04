import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AuthProvider } from './contexts/AuthContext';
import { ServiceTokenProvider } from './contexts/ServiceTokenContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { LoadingSpinner } from './components/common/LoadingSpinner';
import './styles/variables.css';

// ---------------------------------------------------------------------------
// Lazy-loaded pages & layouts
// ---------------------------------------------------------------------------
const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const FrontendLayout = lazy(() => import('./layouts/FrontendLayout'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1a1a2e',
        },
      }}
    >
      <ErrorBoundary>
        <AuthProvider>
          <ServiceTokenProvider>
            <BrowserRouter>
              <Suspense fallback={<LoadingSpinner tip="页面加载中..." />}>
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/admin/*" element={<AdminLayout />} />
                  <Route path="/frontend/*" element={<FrontendLayout />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </ServiceTokenProvider>
        </AuthProvider>
      </ErrorBoundary>
    </ConfigProvider>
  );
}
