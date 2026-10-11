import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, setUnauthorizedHandler, token, type User } from './api'

interface Ctx { user: User | null; ready: boolean; signIn: (t: string, u: User) => void; signOut: () => void }
const C = createContext<Ctx>(null as unknown as Ctx)
export const useAuth = () => useContext(C)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const signOut = () => { token.clear(); setUser(null) }
  const signIn = (t: string, u: User) => { token.set(t); setUser(u) }
  useEffect(() => {
    setUnauthorizedHandler(signOut)
    if (!token.get()) { setReady(true); return }
    api.me().then(setUser).catch(() => token.clear()).finally(() => setReady(true))
  }, [])
  return <C.Provider value={{ user, ready, signIn, signOut }}>{children}</C.Provider>
}
