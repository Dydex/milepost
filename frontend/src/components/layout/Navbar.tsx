import React from 'react';
import { Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import './Navbar.css';

export const Navbar: React.FC = () => {
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
          <button className="btn-primary connect-wallet-btn">
            <Wallet size={18} />
            Connect Wallet
          </button>
        </div>
      </div>
    </header>
  );
};
