import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, me } from '../services/api'
import { useUser } from '../stores/user'

export default function Login() {
  const [username, setU] = useState('')
  const [password, setP] = useState('')
  const [loading, setL] = useState(false)
  const { setAuth } = useUser()
  const nav = useNavigate()
  const submit = async () => {
    setL(true)
    try {
      const r = await login(username, password)
      localStorage.setItem('token', r.token)
      const u = await me()
      setAuth(r.token, u)
      nav('/')
    } catch (e) {
      alert('登录失败')
    } finally {
      setL(false)
    }
  }
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#111', color:'#eee' }}>
      <div style={{ width: 320, display:'flex', flexDirection:'column', gap:12 }}>
        <div style={{ fontSize: 18 }}>登录</div>
        <input placeholder="用户名" value={username} onChange={e=>setU(e.target.value)} />
        <input type="password" placeholder="密码" value={password} onChange={e=>setP(e.target.value)} />
        <button disabled={loading} onClick={submit}>登录</button>
      </div>
    </div>
  )
}
