import React, { useEffect, useState } from 'react';
import './FunderDashboard.css';
import { TrendingUp, Users, CheckCircle, Activity } from 'lucide-react';
import { useSoroban } from '../context/SorobanContext';

export const FunderDashboard: React.FC = () => {
  const { programme, formatAmount } = useSoroban();
  const [budget, setBudget] = useState<bigint | null>(null);
  const [totalContributed, setTotalContributed] = useState<bigint | null>(null);
  const [phase, setPhase] = useState<string>('Loading...');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [budgetRes, contributedRes, phaseRes] = await Promise.all([
          programme.budget(),
          programme.total_contributed(),
          programme.get_phase()
        ]);
        
        setBudget(budgetRes.result.unwrap());
        setTotalContributed(contributedRes.result.unwrap());
        setPhase(phaseRes.result.unwrap().tag);
      } catch (error) {
        console.error("Failed to fetch programme data:", error);
        setPhase("Error");
      }
    };
    fetchData();
  }, [programme]);

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
            <span className="stat-label">Net Budget (After Fees)</span>
            <span className="stat-value">{budget ? `${formatAmount(budget)} XLM` : '...'}</span>
          </div>
        </div>
        <div className="stat-card glass-panel">
          <div className="stat-icon"><Activity size={24} /></div>
          <div className="stat-content">
            <span className="stat-label">Total Contributed</span>
            <span className="stat-value">{totalContributed ? `${formatAmount(totalContributed)} XLM` : '...'}</span>
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
              <h3>CS Scholarship 2026 (Seeded)</h3>
              <span className={`badge badge-${phase.toLowerCase()}`}>{phase}</span>
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
