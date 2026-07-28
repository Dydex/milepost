import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Moon, Sun, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import './Navbar.css';

export const Navbar: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="navbar glass-panel">
      <div className="navbar-container">
        <div className="navbar-brand">
          <Link to="/" className="brand-logo">
            <span className="brand-icon">M</span>
            Milepost
          </Link>
        </div>
        
        <nav className="navbar-links">
          <Link to="/funders" className="nav-link">Funders</Link>
          <Link to="/recipients" className="nav-link">Recipients</Link>
          <Link to="/verifiers" className="nav-link">Verifiers</Link>
        </nav>

        <div className="navbar-actions">
          <button onClick={toggleTheme} className="theme-toggle-btn" aria-label="Toggle theme">
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          
          <button className="btn-primary connect-wallet-btn">
            <Wallet size={18} />
            Connect Wallet
          </button>
        </div>
      </div>
    </header>
  );
};
