import React from 'react';
import './FunderDashboard.css';
import { TrendingUp, Users, CheckCircle } from 'lucide-react';

export const FunderDashboard: React.FC = () => {
  return (
    <div className="dashboard-container">
      <header className="dashboard-header animate-fade-up">
        <h1>Funder Dashboard</h1>
        <p className="typo-text text-muted">Manage your committed funds and track disbursement milestones.</p>
      </header>

      <section className="stats-grid animate-fade-up" style={{ animationDelay: '100ms' }}>
        <div className="stat-card glass-panel">
          <div className="stat-icon"><TrendingUp size={24} /></div>
          <div className="stat-content">
            <span className="stat-label">Total Committed</span>
            <span className="stat-value">$250,000</span>
          </div>
        </div>
        <div className="stat-card glass-panel">
          <div className="stat-icon"><Users size={24} /></div>
          <div className="stat-content">
            <span className="stat-label">Active Recipients</span>
            <span className="stat-value">124</span>
          </div>
        </div>
        <div className="stat-card glass-panel">
          <div className="stat-icon"><CheckCircle size={24} /></div>
          <div className="stat-content">
            <span className="stat-label">Tranches Unlocked</span>
            <span className="stat-value">48</span>
          </div>
        </div>
      </section>

      <section className="programs-section animate-fade-up" style={{ animationDelay: '200ms' }}>
        <h2>Active Programs</h2>
        <div className="programs-grid">
          <div className="program-card glass-panel">
            <div className="program-header">
              <h3>CS Scholarship 2026</h3>
              <span className="badge badge-active">Active</span>
            </div>
            <p className="typo-text text-muted">Supporting 50 undergraduate computer science students across Lagos.</p>
            
            <div className="progress-container">
              <div className="progress-labels">
                <span>Disbursement Progress</span>
                <span>40%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: '40%' }}></div>
              </div>
            </div>

            <div className="program-actions">
              <button className="btn-secondary">View Details</button>
              <button className="btn-primary">Commit More Funds</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
