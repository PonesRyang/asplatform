import { useState, Suspense, lazy } from 'react';
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { Layout, Menu, Button, Typography, Spin } from 'antd';
import {
  ExperimentOutlined, EditOutlined, BookOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, LogoutOutlined
} from '@ant-design/icons';
import ServiceTokenGuard from '../components/common/ServiceTokenGuard';
import TokenQuotaBar from '../components/common/TokenQuotaBar';
import { useServiceToken } from '../hooks/useServiceToken';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const BioAnalysisWorkbench = lazy(() => import('../pages/bio/BioAnalysisWorkbench'));
const AIWritingWorkbench = lazy(() => import('../pages/writing/AIWritingWorkbench'));
const LiteratureCompareWorkbench = lazy(() => import('../pages/literature/LiteratureCompareWorkbench'));

function PageFallback() {
  return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}><Spin /></div>;
}

const menuItems = [
  { key: 'bio', icon: <ExperimentOutlined />, label: '生信分析', path: '/frontend/bio' },
  { key: 'writing', icon: <EditOutlined />, label: 'AI 写作', path: '/frontend/writing' },
  { key: 'lit-compare', icon: <BookOutlined />, label: '文献分析', path: '/frontend/lit-compare' },
];

function getKey(pathname: string) {
  for (const m of menuItems) if (pathname.startsWith(m.path)) return m.key;
  return 'bio';
}

function FrontendLayoutInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tokenInfo, clearToken } = useServiceToken();
  const [collapsed, setCollapsed] = useState(false);

  const handleMenuClick = (info: { key: string }) => {
    const item = menuItems.find(m => m.key === info.key);
    if (item) navigate(item.path);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible collapsed={collapsed} onCollapse={setCollapsed}
        style={{ overflow: 'auto', height: '100vh', position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 10 }}
        theme="dark"
      >
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          {collapsed
            ? <ExperimentOutlined style={{ fontSize: 22, color: '#fff' }} />
            : <Text strong style={{ color: '#fff', fontSize: 16 }}>学术辅助平台</Text>}
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[getKey(location.pathname)]}
          onClick={handleMenuClick}
          items={menuItems.map(m => ({ key: m.key, icon: m.icon, label: m.label }))}
          style={{ marginTop: 8 }}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: 'margin-left 0.2s' }}>
        <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '0 24px', height: 64, position: 'sticky', top: 0, zIndex: 9 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button type="text" icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)} style={{ fontSize: 16, width: 40, height: 40 }} />
            <TokenQuotaBar total={tokenInfo?.ai_quota ?? 0} used={tokenInfo?.used_quota ?? 0} />
          </div>
          <Button type="text" icon={<LogoutOutlined />} onClick={() => { clearToken(); navigate('/'); }} danger>退出</Button>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 8, minHeight: 280 }}>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="bio" element={<BioAnalysisWorkbench />} />
              <Route path="writing" element={<AIWritingWorkbench />} />
              <Route path="lit-compare" element={<LiteratureCompareWorkbench />} />
                            <Route path="/" element={<Navigate to="bio" replace />} />
              <Route path="*" element={<Navigate to="bio" replace />} />
            </Routes>
          </Suspense>
        </Content>
      </Layout>
    </Layout>
  );
}

export default function FrontendLayout() {
  return <ServiceTokenGuard><FrontendLayoutInner /></ServiceTokenGuard>;
}
