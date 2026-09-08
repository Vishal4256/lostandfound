import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', background: '#09090B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20, padding: 24, textAlign: 'center' }}>
      <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        style={{ fontSize: 100, fontWeight: 900, color: '#18181B', fontFamily: "'Bricolage Grotesque', sans-serif", lineHeight: 1, letterSpacing: '-0.05em', userSelect: 'none' }}>
        404
      </motion.p>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#FAFAFA', marginBottom: 8, letterSpacing: '-0.02em' }}>Page not found</h1>
        <p style={{ color: '#71717A', fontSize: 15, maxWidth: 320, margin: '0 auto 28px' }}>The page you're looking for doesn't exist or has been moved.</p>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px', background: '#F97316', color: 'white', borderRadius: 11, fontWeight: 600, fontSize: 14, textDecoration: 'none', boxShadow: '0 4px 20px rgba(249,115,22,0.3)' }}>
          Back to Home
        </Link>
      </motion.div>
    </div>
  )
}
