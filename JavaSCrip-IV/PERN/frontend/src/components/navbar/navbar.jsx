import { Link, useLocation } from "react-router-dom";
import { protectedNavigation, publicNavigation } from "./navigation.js";
import { useAuth } from "../../context/AuthContext.jsx";

function Navbar() {
  const location = useLocation();
  const auth = useAuth();
  const navigation = auth.isAuthenticated ? protectedNavigation : publicNavigation;

  return (
    <nav className="bg-zinc-950 flex justify-between items-center px-6 py-4 shadow-lg border-b border-zinc-800">
      <h1 className="text-white font-bold text-xl tracking-wider">
        <Link to="/">PERN</Link>
      </h1>
      
      {/* Achicamos el gap general a gap-x-4 */}
      <div className="flex items-center gap-x-4">
        <ul className="flex gap-x-3 items-center">
          {/* Desestructuramos 'icon' de las rutas */}
          {navigation.map(({ name, path, icon: Icon }) => (
            <li 
              key={name} 
              className={`
                text-sm font-medium transition-colors duration-200 flex items-center
                ${location.pathname === path 
                  ? "bg-sky-500 text-white px-3 py-1.5 rounded-md shadow-sm" 
                  : "text-slate-300 hover:text-white hover:bg-zinc-800 px-3 py-1.5 rounded-md"}
              `}
            >
              <Link to={path} className="flex items-center gap-1.5">
                {/* Si hay icono, lo renderiza */}
                {Icon && <Icon className="text-lg" />}
                {/* El texto se oculta en sm y se muestra en md */}
                <span className={Icon ? "hidden md:inline" : "inline"}>
                  {name}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {/* Perfil de usuario: Imagen a la izquierda, sin barrita separadora */}
        {auth.isAuthenticated && auth.user && (
          <div className="flex items-center gap-2.5 ml-2">
            <img 
              src={auth.user.gravatar} 
              alt={`Avatar de ${auth.user.name}`} 
              className="w-9 h-9 rounded-full border-2 border-transparent hover:border-sky-500 transition-colors cursor-pointer object-cover"
            />
            <span className="text-sm text-slate-300 font-medium hidden md:block">
              {auth.user.name}
            </span>
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;