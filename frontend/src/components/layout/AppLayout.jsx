import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import AiRecoveryAssistant from '../AiRecoveryAssistant'

export default function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-on-surface">
      <Navbar />
      <main className="flex-1 w-full">
        <Outlet />
      </main>
      <AiRecoveryAssistant />
      <Footer />
    </div>
  )
}
