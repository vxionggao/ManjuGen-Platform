import { createContext, useContext, useState } from 'react'

type User = { username: string; role: string } | null

type Ctx = { token: string | null; user: User; setAuth: (t: string | null, u: User) => void }

const C = createContext<Ctx>({ token: null, user: null, setAuth: () => {} })

export function UserProvider({ children }: { children: JSX.Element }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [user, setUser] = useState<User>(null)
  const setAuth = (t: string | null, u: User) => { 
    setToken(t); 
    setUser(u);
    if (t) localStorage.setItem('token', t);
    else localStorage.removeItem('token');
  }
  return <C.Provider value={{ token, user, setAuth }}>{children}</C.Provider>
}

export function useUser() { return useContext(C) }
