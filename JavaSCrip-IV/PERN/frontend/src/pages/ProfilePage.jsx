import axios from 'axios';
import { useEffect, useState } from 'react';
import { Container, Card } from "../components/ui"; // Ajusta la ruta si es necesario
import { FiCalendar, FiClock, FiMail, FiUser } from 'react-icons/fi';

// Función auxiliar para calcular el tiempo relativo (ej. "hace 2 días")
function timeAgo(dateString) {
  if (!dateString) return "Desconocido";
  
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

  if (diffInSeconds < 60) return rtf.format(-diffInSeconds, 'second');
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return rtf.format(-diffInMinutes, 'minute');
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return rtf.format(-diffInHours, 'hour');
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return rtf.format(-diffInDays, 'day');
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return rtf.format(-diffInMonths, 'month');
  
  const diffInYears = Math.floor(diffInDays / 365);
  return rtf.format(-diffInYears, 'year');
}

function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('http://localhost:3000/api/profile', { withCredentials: true })
      .then(response => {
        setProfile(response.data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching profile:', error);
        setLoading(false);
      });   
  }, []);

  if (loading) {
    return (
      <Container>
        <p className="text-slate-400 mt-10 text-center">Cargando perfil...</p>
      </Container>
    );
  }

  if (!profile) {
    return (
      <Container>
        <p className="text-red-500 mt-10 text-center">No se pudo cargar el perfil.</p>
      </Container>
    );
  }

  return (
        <Card >
          
          {/* Cabecera del Perfil */}
          <div className="flex flex-col items-center border-b border-zinc-800 pb-6 mb-6">
            <img 
              src={profile.gravatar} 
              alt={`Avatar de ${profile.name}`} 
              className="w-24 h-24 rounded-full border-4 border-sky-500 object-cover shadow-lg mb-4"
            />
            <h2 className="text-2xl font-bold text-slate-100">{profile.name}</h2>
            <span className="text-sm text-slate-400 flex items-center gap-1.5 mt-1">
              <FiMail /> {profile.email}
            </span>
          </div>

          {/* Detalles del Perfil */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 text-slate-300">
              <div className="p-2 bg-zinc-800 rounded-lg text-sky-400">
                <FiCalendar className="text-xl" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Miembro desde</p>
                <p className="text-sm font-medium">{timeAgo(profile.fecha_registro)}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-slate-300">
              <div className="p-2 bg-zinc-800 rounded-lg text-sky-400">
                <FiClock className="text-xl" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Último inicio de sesión</p>
                <p className="text-sm font-medium">
                  {profile.ultimo_login ? timeAgo(profile.ultimo_login) : "Hace un momento"}
                </p>
              </div>
            </div>
          </div>

        </Card>
  );
}

export default ProfilePage;