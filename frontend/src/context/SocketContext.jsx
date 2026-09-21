import { createContext, useContext, useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'

const SocketContext = createContext(null)

export const SocketProvider = ({ children }) => {
  const { user, token } = useAuth()
  const [socket, setSocket] = useState(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_SOCKET_URL ||
      (window.location.origin.includes('5173') ? 'http://localhost:5000' : window.location.origin)

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
      if (user?._id) {
        socketInstance.emit('join_user_room', user._id)
      }
    })

    socketInstance.on('disconnect', () => {
      setConnected(false)
    })

    setSocket(socketInstance)

    return () => {
      socketInstance.disconnect()
    }
  }, [user?._id, token])

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => {
  return useContext(SocketContext)
}
