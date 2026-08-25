import { useEffect, useState } from 'react';
import './FunderDashboard.css';
import { TrendingUp, CheckCircle, Activity, WalletCards } from 'lucide-react';
import { useSoroban } from '../context/useSoroban';
import { formatAmount, percentOf } from '../lib/amount';

interface BudgetBreakdown {
  budget: bigint;
  fee: bigint;
  totalContributed: bigint;
  totalGranted: bigint;
  totalReleased: bigint;
}

const ZERO = 0n;

const maxBigint = (value: bigint, minimum: bigint) => value > minimum ? value : minimum;
const minBigint = (value: bigint, maximum: bigint) => value < maximum ? value : maximum;
const formatXlm = (amount: bigint) => formatAmount(amount, { asset: 'XLM' });
const formatPercent = (value: number) => `${value.toFixed(2)}%`;

export const FunderDashboard = () => {
  const { demoProgramme: programme } = useSoroban();
  const [breakdown, setBreakdown] = useState<BudgetBreakdown | null>(null);
  const [phase, setPhase] = useState<string>('Loading...');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [budgetRes, feeRes, contributedRes, grantedRes, releasedRes, phaseRes] = await Promise.all([
          programme.budget(),
          programme.fee(),
          programme.total_contributed(),
          programme.total_granted(),
          programme.total_released(),
          programme.get_phase()
        ]);
        
        setBreakdown({
          budget: budgetRes.result.unwrap(),
          fee: feeRes.result.unwrap(),
          totalContributed: contributedRes.result,
          totalGranted: grantedRes.result,
          totalReleased: releasedRes.result
        });
        setPhase(phaseRes.result.unwrap().tag);
      } catch (error) {
        console.error("Failed to fetch programme data:", error);
        setPhase("Error");
      }
    };
    fetchData();
  }, [programme]);

  const feePercent = breakdown ? percentOf(breakdown.fee, breakdown.totalContributed) : 0;
  const committedUnreleased = breakdown ? maxBigint(breakdown.totalGranted - breakdown.totalReleased, ZERO) : ZERO;
  const unallocatedBudget = breakdown ? maxBigint(breakdown.budget - breakdown.totalGranted, ZERO) : ZERO;

  const releasedSegment = breakdown ? minBigint(maxBigint(breakdown.totalReleased, ZERO), breakdown.budget) : ZERO;
  const committedSegment = breakdown ? minBigint(committedUnreleased, maxBigint(breakdown.budget - releasedSegment, ZERO)) : ZERO;
  const unallocatedSegment = breakdown ? maxBigint(breakdown.budget - releasedSegment - committedSegment, ZERO) : ZERO;

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
            <span className="stat-value">{breakdown ? formatXlm(breakdown.budget) : '...'}</span>
          </div>
        </div>
        <div className="stat-card glass-panel">
          <div className="stat-icon"><Activity size={24} /></div>
          <div className="stat-content">
            <span className="stat-label">Total Contributed</span>
            <span className="stat-value">{breakdown ? formatXlm(breakdown.totalContributed) : '...'}</span>
          </div>
        </div>
        <div className="stat-card glass-panel">
          <div className="stat-icon"><CheckCircle size={24} /></div>
          <div className="stat-content">
            <span className="stat-label">Total Released</span>
            <span className="stat-value">{breakdown ? formatXlm(breakdown.totalReleased) : '...'}</span>
          </div>
        </div>
      </section>

      <section className="budget-panel glass-panel animate-fade-up" style={{ animationDelay: '200ms' }}>
        <div className="budget-panel-header">
          <div>
            <span className="stat-label">Programme funds</span>
            <h2>Budget and fee breakdown</h2>
          </div>
          <div className="budget-panel-icon">
            <WalletCards size={24} />
          </div>
        </div>

        <div className="budget-equation" aria-label="Budget equals total contributed minus fee">
          <div>
            <span className="budget-equation-label">Contributed</span>
            <strong className="numeric">{breakdown ? formatXlm(breakdown.totalContributed) : '...'}</strong>
          </div>
          <span className="budget-equation-symbol">-</span>
          <div>
            <span className="budget-equation-label">Fee</span>
            <strong className="numeric">{breakdown ? formatXlm(breakdown.fee) : '...'}</strong>
          </div>
          <span className="budget-equation-symbol">=</span>
          <div>
            <span className="budget-equation-label">Budget</span>
            <strong className="numeric">{breakdown ? formatXlm(breakdown.budget) : '...'}</strong>
          </div>
        </div>

        <div className="budget-meter" aria-label="Budget allocation">
          <div
            className="budget-meter-segment budget-meter-released"
            style={{ width: `${breakdown ? percentOf(releasedSegment, breakdown.budget) : 0}%` }}
            title="Released"
          />
          <div
            className="budget-meter-segment budget-meter-committed"
            style={{ width: `${breakdown ? percentOf(committedSegment, breakdown.budget) : 0}%` }}
            title="Committed but unreleased"
          />
          <div
            className="budget-meter-segment budget-meter-unallocated"
            style={{ width: `${breakdown ? percentOf(unallocatedSegment, breakdown.budget) : 0}%` }}
            title="Unallocated budget"
          />
        </div>

        <div className="budget-breakdown-grid">
          <div className="budget-breakdown-item">
            <span className="budget-swatch budget-swatch-fee" />
            <span className="budget-breakdown-label">Protocol fee</span>
            <strong className="numeric">{breakdown ? `${formatXlm(breakdown.fee)} (${formatPercent(feePercent)})` : '...'}</strong>
          </div>
          <div className="budget-breakdown-item">
            <span className="budget-swatch budget-swatch-granted" />
            <span className="budget-breakdown-label">Total granted</span>
            <strong className="numeric">{breakdown ? formatXlm(breakdown.totalGranted) : '...'}</strong>
          </div>
          <div className="budget-breakdown-item">
            <span className="budget-swatch budget-swatch-released" />
            <span className="budget-breakdown-label">Released</span>
            <strong className="numeric">{breakdown ? formatXlm(breakdown.totalReleased) : '...'}</strong>
          </div>
          <div className="budget-breakdown-item">
            <span className="budget-swatch budget-swatch-committed" />
            <span className="budget-breakdown-label">Committed, unpaid</span>
            <strong className="numeric">{breakdown ? formatXlm(committedUnreleased) : '...'}</strong>
          </div>
          <div className="budget-breakdown-item">
            <span className="budget-swatch budget-swatch-unallocated" />
            <span className="budget-breakdown-label">Unallocated budget</span>
            <strong className="numeric">{breakdown ? formatXlm(unallocatedBudget) : '...'}</strong>
          </div>
        </div>
      </section>

      <section className="programs-section animate-fade-up" style={{ animationDelay: '300ms' }}>
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
