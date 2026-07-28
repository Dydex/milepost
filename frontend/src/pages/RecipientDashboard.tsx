import React from 'react';
import './RecipientDashboard.css';
import { Award, Lock, Unlock, FileText } from 'lucide-react';

export const RecipientDashboard: React.FC = () => {
  return (
    <div className="dashboard-container">
      <header className="dashboard-header animate-fade-up">
        <h1>Recipient Dashboard</h1>
        <p className="typo-text text-muted">Track your milestones and unlock your grant tranches.</p>
      </header>

      <section className="stats-grid animate-fade-up" style={{ animationDelay: '100ms' }}>
        <div className="stat-card glass-panel">
          <div className="stat-icon"><Award size={24} /></div>
          <div className="stat-content">
            <span className="stat-label">Total Received</span>
            <span className="stat-value">$2,500</span>
          </div>
        </div>
        <div className="stat-card glass-panel">
          <div className="stat-icon"><FileText size={24} /></div>
          <div className="stat-content">
            <span className="stat-label">Verified Milestones</span>
            <span className="stat-value">3</span>
          </div>
        </div>
      </section>

      <section className="milestones-section animate-fade-up" style={{ animationDelay: '200ms' }}>
        <h2>My Milestones (CS Scholarship 2026)</h2>
        <div className="milestones-timeline">
          
          <div className="milestone-card glass-panel unlocked">
            <div className="milestone-icon">
              <Unlock size={20} />
            </div>
            <div className="milestone-details">
              <h3>Tranche 1: Tuition</h3>
              <p className="typo-text text-muted">Unlocked upon enrolment proof.</p>
              <div className="milestone-meta">
                <span className="amount">$1,500</span>
                <span className="status text-positive">Unlocked & Paid</span>
              </div>
            </div>
          </div>

          <div className="milestone-card glass-panel locked">
            <div className="milestone-icon">
              <Lock size={20} />
            </div>
            <div className="milestone-details">
              <h3>Tranche 2: Stipend</h3>
              <p className="typo-text text-muted">Unlocks upon semester completion attestation from University.</p>
              <div className="milestone-meta">
                <span className="amount">$1,000</span>
                <span className="status text-warning">Awaiting Attestation</span>
              </div>
            </div>
          </div>

        </div>
      </section>
    </div>
  );
};
