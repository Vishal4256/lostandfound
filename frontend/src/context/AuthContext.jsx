import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../services/api'

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

  // Synchronize token state with API client
  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    } else {
      delete api.defaults.headers.common['Authorization']
    }
  }, [token])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('findit_token')
    localStorage.removeItem('findit_user')
    delete api.defaults.headers.common['Authorization']
  }, [])

  // Verify stored token on initial mount
  useEffect(() => {
    const verifyToken = async () => {
      const savedToken = localStorage.getItem('findit_token')
      if (savedToken) {
        try {
          const { data } = await api.get('/api/auth/me')
          if (data.success && data.user) {
            setUser(data.user)
            localStorage.setItem('findit_user', JSON.stringify(data.user))
          } else {
            logout()
          }
        } catch {
          logout()
        }
      }
      setLoading(false)
    }

    verifyToken()
  }, [logout])

  const login = async (email, password) => {
    const { data } = await api.post('/api/auth/login', { email, password })
    if (data.success && data.token) {
      setToken(data.token)
      setUser(data.user)
      localStorage.setItem('findit_token', data.token)
      localStorage.setItem('findit_user', JSON.stringify(data.user))
      api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`
      return data.user
    }
    throw new Error(data.message || 'Login failed')
  }

  const register = async (name, email, password) => {
    const { data } = await api.post('/api/auth/register', { name, email, password })
    if (data.success && data.token) {
      setToken(data.token)
      setUser(data.user)
      localStorage.setItem('findit_token', data.token)
      localStorage.setItem('findit_user', JSON.stringify(data.user))
      api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`
      return data.user
    }
    throw new Error(data.message || 'Registration failed')
  }

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      register,
      logout,
      setUser,
      isAuthenticated: !!token
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
