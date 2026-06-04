import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Layout, Menu, Button, Typography, Avatar, Dropdown, theme } from 'antd';
import type { MenuProps } from 'antd';
import {
  TeamOutlined,
  UserOutlined,
  KeyOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

interface AdminMenuItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  path: string;
}

const adminMenuItems: AdminMenuItem[] = [
  {
    key: 'groups',
    icon: <TeamOutlined />,
    label: '用户组管理',
    path: '/admin/groups',
  },
  {
    key: 'users',
    icon: <UserOutlined />,
    label: '用户管理',
    path: '/admin/users',
  },
  {
    key: 'tokens',
    icon: <KeyOutlined />,
    label: '令牌管理',
    path: '/admin/tokens',
  },
];

function getSelectedKey(pathname: string): string {
  for (const item of adminMenuItems) {
    if (pathname.startsWith(item.path)) {
      return item.key;
    }
  }
  return 'groups';
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { adminUser, adminToken, isLoading, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const { token: themeToken } = theme.useToken();

  const isAuthenticated = !!adminToken && !!adminUser;

  // Check auth on mount — redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleMenuClick: MenuProps['onClick'] = (info) => {
    const item = adminMenuItems.find((m) => m.key === info.key);
    if (item) {
      navigate(item.path);
    }
  };

  const dropdownItems: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
    },
  ];

  const handleDropdownClick: MenuProps['onClick'] = (info) => {
    if (info.key === 'logout') {
      handleLogout();
    }
  };

  // Show nothing while checking auth
  if (isLoading || !isAuthenticated) {
    return null;
  }

  const selectedKey = getSelectedKey(location.pathname);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 10,
        }}
        theme="dark"
        trigger={null}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            cursor: 'pointer',
          }}
          onClick={() => navigate('/admin')}
        >
          {collapsed ? (
            <DashboardOutlined style={{ fontSize: 24, color: '#fff' }} />
          ) : (
            <Text
              strong
              style={{ color: '#fff', fontSize: 18, whiteSpace: 'nowrap' }}
            >
              后台管理
            </Text>
          )}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          onClick={handleMenuClick}
          items={adminMenuItems.map((item) => ({
            key: item.key,
            icon: item.icon,
            label: item.label,
          }))}
          style={{ marginTop: 8 }}
        />
      </Sider>

      <Layout
        style={{
          marginLeft: collapsed ? 80 : 200,
          transition: 'margin-left 0.2s',
        }}
      >
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: themeToken.colorBgContainer,
            borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
            padding: '0 24px',
            height: 64,
            position: 'sticky',
            top: 0,
            zIndex: 9,
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: 16, width: 40, height: 40 }}
          />

          <Dropdown
            menu={{ items: dropdownItems, onClick: handleDropdownClick }}
            placement="bottomRight"
          >
            <div
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Avatar
                size="small"
                icon={<UserOutlined />}
                style={{ background: themeToken.colorPrimary }}
              />
              <Text>管理员: {adminUser?.username ?? '--'}</Text>
            </div>
          </Dropdown>
        </Header>

        <Content
          style={{
            margin: 24,
            padding: 24,
            background: themeToken.colorBgContainer,
            borderRadius: themeToken.borderRadiusLG,
            minHeight: 280,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
