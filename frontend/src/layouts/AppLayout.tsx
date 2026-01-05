import { Layout, Menu, Avatar, Dropdown } from 'antd'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { UserOutlined, PictureOutlined, VideoCameraOutlined, SettingOutlined, LogoutOutlined } from '@ant-design/icons'
import { useUser } from '../stores/user'

const { Header, Content } = Layout

export default function AppLayout() {
  const { user, setAuth } = useUser()
  const loc = useLocation()
  const nav = useNavigate()
  
  const handleLogout = () => {
    localStorage.removeItem('token')
    setAuth(null, null) 
    nav('/login')
  }

  const userMenu = {
    items: [
      { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, onClick: handleLogout }
    ]
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px', background: '#161618', borderBottom: '1px solid #333', height: 48, lineHeight: '48px' }}>
        <div style={{ marginRight: 48, fontSize: 16, fontWeight: 'bold', color: '#fff', whiteSpace: 'nowrap' }}>
           飞星漫剧
        </div>
        
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[loc.pathname]}
          style={{ flex: 1, borderBottom: 0, background: 'transparent', lineHeight: '48px' }}
          items={[
            { key: '/art', icon: <PictureOutlined />, label: <Link to="/art">图片生成</Link> },
            { key: '/motion', icon: <VideoCameraOutlined />, label: <Link to="/motion">视频生成</Link> },
            { key: '/admin', icon: <SettingOutlined />, label: <Link to="/admin">管理配置</Link> },
          ]}
        />

        <Dropdown menu={userMenu}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#eee' }}>
            <Avatar size="small" icon={<UserOutlined />} />
            {/* <span>{user?.username}</span> */}
          </div>
        </Dropdown>
      </Header>

      <Content style={{ margin: 0, padding: 0, overflow: 'hidden', height: 'calc(100vh - 48px)' }}>
        <Outlet />
      </Content>
    </Layout>
  )
}
