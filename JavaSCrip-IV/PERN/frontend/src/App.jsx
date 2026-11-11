import React from 'react'
import { Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import TareasPage from './pages/TareasPage';
import TareaFormPage from './pages/TareaFormPage';
import NotFound from './pages/NotFound';
import Navbar from './components/navbar/navbar';
import Container from './components/ui/Container';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';


function App() {
  const auth = useAuth();
  return (
    <>
      <Navbar />
      <Container>
        <Routes>

          <Route element ={<ProtectedRoute isAuth={!auth.isAuthenticated} redirectTo='/' />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />

          <Route element={<ProtectedRoute isAuth={auth.isAuthenticated}/>}>
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/tareas" element={<TareasPage />} />
            <Route path="/tareas/crear" element={<TareaFormPage />} />
            <Route path="/tareas/editar/:id" element={<TareaFormPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Container>
    </>
  )
}

export default App