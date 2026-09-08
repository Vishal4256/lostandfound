import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

const AppLayout = () => (
  <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
    <Navbar />
    <main style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px 80px' }}>
      <Outlet />
    </main>
  </div>
)

export default AppLayout
