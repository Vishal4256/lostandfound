import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('findit_user')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [token, setToken] = useState(() => localStorage.getItem('findit_token') || null)
  const [loading, setLoading] = useState(true)

  // Configure axios interceptor to attach Bearer token
  useEffect(() => {
    const interceptor = axios.interceptors.request.use((config) => {
      const savedToken = localStorage.getItem('findit_token')
      if (savedToken) {
        config.headers.Authorization = `Bearer ${savedToken}`
      }
      return config
    })

    return () => axios.interceptors.request.eject(interceptor)
  }, [])

  // Verify stored token on mount
  useEffect(() => {
    const verifyToken = async () => {
      const savedToken = localStorage.getItem('findit_token')
      if (savedToken) {
        try {
          const { data } = await axios.get('/api/auth/me', {
            headers: { Authorization: `Bearer ${savedToken}` }
          })
          if (data.success && data.user) {
            setUser(data.user)
            localStorage.setItem('findit_user', JSON.stringify(data.user))
          }
        } catch {
          // Token expired or invalid
          logout()
        }
      }
      setLoading(false)
    }

    verifyToken()
  }, [])

  const login = async (email, password) => {
    const { data } = await axios.post('/api/auth/login', { email, password })
    if (data.success && data.token) {
      setToken(data.token)
      setUser(data.user)
      localStorage.setItem('findit_token', data.token)
      localStorage.setItem('findit_user', JSON.stringify(data.user))
      return data.user
    }
    throw new Error(data.message || 'Login failed')
  }

  const register = async (name, email, password) => {
    const { data } = await axios.post('/api/auth/register', { name, email, password })
    if (data.success && data.token) {
      setToken(data.token)
      setUser(data.user)
      localStorage.setItem('findit_token', data.token)
      localStorage.setItem('findit_user', JSON.stringify(data.user))
      return data.user
    }
    throw new Error(data.message || 'Registration failed')
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('findit_token')
    localStorage.removeItem('findit_user')
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
