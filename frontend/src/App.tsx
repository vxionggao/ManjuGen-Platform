import { Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, theme, App as AntdApp } from 'antd'
import AppLayout from './layouts/AppLayout'
import Login from './pages/Login'
import Home from './pages/Home'
import ArtStudio from './pages/ArtStudio'
import MotionStudio from './pages/MotionStudio'
import Assets from './pages/Assets'
import AdminConfig from './pages/AdminConfig'
import { UserProvider, useUser } from './stores/user'

function Protected({ children }: { children: JSX.Element }) {
  const { token } = useUser()
  if (!token) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: { colorPrimary: '#6E56CF', colorBgContainer: '#161618' },
      }}
    >
      <AntdApp>
        <UserProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <Protected>
                  <AppLayout />
                </Protected>
              }
            >
              <Route index element={<Home />} />
              <Route path="art" element={<ArtStudio />} />
              <Route path="motion" element={<MotionStudio />} />
              <Route path="assets" element={<Assets />} />
              <Route path="admin" element={<AdminConfig />} />
            </Route>
          </Routes>
        </UserProvider>
      </AntdApp>
    </ConfigProvider>
  )
}
