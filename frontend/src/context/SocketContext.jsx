import { createContext, useContext, useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'

const SocketContext = createContext(null)

export const SocketProvider = ({ children }) => {
  const { user } = useAuth()
  const [socket, setSocket] = useState(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    // In dev, connect to backend socket. Uses relative path or direct port 5000 fallback
    const socketInstance = io(window.location.origin.includes('5173') ? 'http://localhost:5000' : window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      timeout: 10000
    })

    socketInstance.on('connect', () => {
      console.log('⚡ Socket connected:', socketInstance.id)
      setConnected(true)
      if (user?._id) {
        socketInstance.emit('join_user_room', user._id)
      }
    })

    socketInstance.on('disconnect', () => {
      console.log('⚡ Socket disconnected')
      setConnected(false)
    })

    setSocket(socketInstance)

    return () => {
      socketInstance.disconnect()
    }
  }, [user?._id])

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => {
  return useContext(SocketContext)
}
