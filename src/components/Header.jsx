import { Link } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'

export default function Header({ userRole }) {
  return (
    <header className="header">
      <div className="container">
        <Link to="/" className="logo">🎵 Студия</Link>
        <div className="nav-links">
          <Link to="/about">О нас</Link>
          <Link to="/employees">Наши сотрудники</Link>
          <Link to="/credits">Credits</Link>
          <Link to="/profile">Профиль</Link>
          
          {userRole === 'worker' && (
            <Link to="/worker" style={{ background: '#4caf50', padding: '5px 12px', borderRadius: '20px' }}>
              👨‍💼 Работник
            </Link>
          )}
          
          {userRole === 'admin' && (
            <>
              <Link to="/worker" style={{ background: '#4caf50', padding: '5px 12px', borderRadius: '20px' }}>
                👨‍💼 Работник
              </Link>
              <Link to="/admin" style={{ background: '#f44336', padding: '5px 12px', borderRadius: '20px' }}>
                👑 Админ
              </Link>
            </>
          )}
          
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}