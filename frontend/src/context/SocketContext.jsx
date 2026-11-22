import { createContext, useContext, useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'

const SocketContext = createContext(null)

export const SocketProvider = ({ children }) => {
  const { user, token } = useAuth()
  const [socket, setSocket] = useState(null)
  const [connected, setConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState(new Set())

  useEffect(() => {
    let socketUrl = (import.meta.env.VITE_SOCKET_URL || '').trim();
    if (!socketUrl) {
      // In local dev, connect to localhost:5000. In production on Vercel, fallback to Render backend
      const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      socketUrl = isLocal ? 'http://localhost:5000' : 'https://lostandfound-f74b.onrender.com';
    }
    socketUrl = socketUrl.replace(/\/+$/, '');

    const socketInstance = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      timeout: 10000,
      auth: {
        token: token || localStorage.getItem('findit_token')
      }
    })

    socketInstance.on('connect', () => {
      setConnected(true)
      const currentToken = token || localStorage.getItem('findit_token')
      if (currentToken) {
        socketInstance.emit('authenticate', currentToken)
      }
      if (user?._id) {
        socketInstance.emit('join_user_room', user._id)
      }
      socketInstance.emit('get_online_users', (list) => {
        if (Array.isArray(list)) {
          setOnlineUsers(new Set(list.map(String)))
        }
      })
    })

    socketInstance.on('online_users_list', (list) => {
      if (Array.isArray(list)) {
        setOnlineUsers(new Set(list.map(String)))
      }
    })

    socketInstance.on('user_presence', ({ userId, status }) => {
      if (!userId) return
      setOnlineUsers((prev) => {
        const next = new Set(prev)
        if (status === 'online') {
          next.add(userId.toString())
        } else {
          next.delete(userId.toString())
        }
        return next
      })
    })

    socketInstance.on('disconnect', () => {
      setConnected(false)
    })

    socketInstance.io.on('reconnect', () => {
      const currentToken = token || localStorage.getItem('findit_token')
      if (currentToken) {
        socketInstance.emit('authenticate', currentToken)
      }
      if (user?._id) {
        socketInstance.emit('join_user_room', user._id)
      }
    })

    // eslint-disable-next-line react/set-state-in-effect
    setSocket(socketInstance)

    return () => {
      socketInstance.disconnect()
    }
  }, [user?._id, token])

  return (
    <SocketContext.Provider value={{ socket, connected, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  )
}

// eslint-disable-next-line react/only-export-components
export const useSocket = () => {
  return useContext(SocketContext)
}
