import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import AppLayout from './components/layout/AppLayout'
import Home from './pages/Home'
import AddItem from './pages/AddItem'
import ItemDetail from './pages/ItemDetail'
import Profile from './pages/Profile'
import Login from './pages/Login'
import NotFound from './pages/NotFound'

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors theme="dark" />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/add-item" element={<AddItem />} />
          <Route path="/item/:id" element={<ItemDetail />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
