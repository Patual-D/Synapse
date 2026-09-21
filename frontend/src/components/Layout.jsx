import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinkClass = ({ isActive }) =>
    `nav-link${isActive ? ' active' : ''}`;

  return (
    <div>
      <nav className="navbar">
        <div className="navbar-inner">
          <div className="brand">
            Synapse<span>.</span>
          </div>
          <div className="nav-links">
            <NavLink to="/" end className={navLinkClass}>Inicio</NavLink>
            <NavLink to="/recursos" className={navLinkClass}>Recursos</NavLink>
            <NavLink to="/calendario" className={navLinkClass}>Calendario</NavLink>
            <NavLink to="/mantenimiento" className={navLinkClass}>Mantenimiento</NavLink>
            {user && user.role === 'admin' && (
              <NavLink to="/admin" className={navLinkClass}>Panel Admin</NavLink>
            )}
          </div>
          <div className="flex" style={{ alignItems: 'center', gap: 12 }}>
            <div className="nav-user">
              <p className="name">{user?.nombre}</p>
              <p className="rol">{user?.role}</p>
            </div>
            <button className="logout-btn" onClick={handleLogout}>Salir</button>
          </div>
        </div>
      </nav>
      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}