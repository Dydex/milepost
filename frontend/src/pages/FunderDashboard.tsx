import './FunderDashboard.css';
import { TrendingUp, CheckCircle, Activity } from 'lucide-react';
import { useContractRead, useContractResult, useProgramme } from '../hooks';
import { AsyncView } from '../components/state/AsyncStates';
import { PhaseBadge } from '../components/ui';
import { formatAmount } from '../lib/amount';

export const FunderDashboard = () => {
  const { client: programme } = useProgramme();

  const budget = useContractResult(() => programme.budget(), [programme]);
  const contributed = useContractRead(() => programme.total_contributed(), [programme]);
  const phase = useContractResult(() => programme.get_phase(), [programme]);

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
            <span className="stat-value numeric">
              <AsyncView {...budget} onRetry={budget.refetch}>
                {(value) => `${formatAmount(value)} XLM`}
              </AsyncView>
            </span>
          </div>
        </div>
        <div className="stat-card glass-panel">
          <div className="stat-icon"><Activity size={24} /></div>
          <div className="stat-content">
            <span className="stat-label">Total Contributed</span>
            <span className="stat-value numeric">
              <AsyncView {...contributed} onRetry={contributed.refetch}>
                {(value) => `${formatAmount(value)} XLM`}
              </AsyncView>
            </span>
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
              <AsyncView {...phase} onRetry={phase.refetch}>
                {(value) => <PhaseBadge phase={value.tag} />}
              </AsyncView>
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
