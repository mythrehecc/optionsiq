import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import AntLayout from 'antd/lib/layout';
import Menu from 'antd/lib/menu';
import Button from 'antd/lib/button';
import Avatar from 'antd/lib/avatar';
import Dropdown from 'antd/lib/dropdown';
import Space from 'antd/lib/space';
import Typography from 'antd/lib/typography';
import Select from 'antd/lib/select';
import message from 'antd/lib/message';
import DashboardOutlined from '@ant-design/icons/DashboardOutlined';
import FileTextOutlined from '@ant-design/icons/FileTextOutlined';
import BarChartOutlined from '@ant-design/icons/BarChartOutlined';
import LineChartOutlined from '@ant-design/icons/LineChartOutlined';
import UserOutlined from '@ant-design/icons/UserOutlined';
import LogoutOutlined from '@ant-design/icons/LogoutOutlined';
import BellOutlined from '@ant-design/icons/BellOutlined';
import { useAuth } from '@/context/AuthContext';
import { useDashboard } from '@/context/DashboardContext';

const { Header, Sider, Content } = AntLayout;
const { Title } = Typography;
const { Option } = Select;

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { accounts, selectedAccount, setSelectedAccount } = useDashboard();
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/statements',
      icon: <FileTextOutlined />,
      label: 'Statements',
    },
    {
      key: '/positions',
      icon: <BarChartOutlined />,
      label: 'Positions',
    },
    {
      key: '/analytics',
      icon: <LineChartOutlined />,
      label: 'Analytics',
    },
  ];

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile',
      onClick: () => message.info('Profile feature coming soon'),
    },
    {
      key: 'signout',
      icon: <LogoutOutlined />,
      label: 'Sign Out',
      onClick: signOut,
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed}>
        <div style={{ padding: '16px', textAlign: 'center', borderBottom: '1px solid #f0f0f0' }}>
          <Title level={4} style={{ color: 'white', margin: 0 }}>
            {collapsed ? 'OQ' : 'OptionsIQ'}
          </Title>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      
      <AntLayout>
        <Header style={{ padding: '0 16px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Button
              type="text"
              icon={collapsed ? <DashboardOutlined /> : <DashboardOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: '16px', width: 64, height: 64 }}
            />
            
            {accounts.length > 0 && (
              <Select
                value={selectedAccount}
                placeholder="Select Account"
                style={{ width: 200 }}
                onChange={setSelectedAccount}
                allowClear
              >
                {accounts.map((account) => (
                  <Option key={account.account_id} value={account.account_id}>
                    {account.account_id} ({account.account_type})
                  </Option>
                ))}
              </Select>
            )}
          </div>

          <Space>
            <Button type="text" icon={<BellOutlined />} />
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} />
                <span>{user?.full_name}</span>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        
        <Content style={{ margin: '24px 16px', padding: 24, background: '#fff', minHeight: 280 }}>
          {children}
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default Layout;
