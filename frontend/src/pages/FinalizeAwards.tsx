import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  CheckCircle,
  Coins,
  Globe,
  Landmark,
  Loader,
  Lock,
  Search,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import type { Application, Award as AwardData, Mode, Phase, ProgrammeConfig } from '@milepost/program';
import { useSoroban } from '../context/useSoroban';
import { useWallet } from '../context/useWallet';
import { ErrorState, Loading } from '../components/state/AsyncStates';
import { explain, isFailure } from '../lib/errors';
import { formatAmount } from '../lib/amount';
import './FinalizeAwards.css';

interface ModeOption {
  tag: Mode['tag'];
  icon: typeof Landmark;
  label: string;
  summary: string;
  consequence: string;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    tag: 'Direct',
    icon: Landmark,
    label: 'Direct',
    summary: 'Paid straight to a verified payee you choose now — a school, clinic or supplier.',
    consequence:
      'The recipient never holds the money and never chooses who receives it. Equally unbypassable as Allocated; the difference is the recipient loses choice.',
  },
  {
    tag: 'Allocated',
    icon: ShieldCheck,
    label: 'Allocated',
    summary: 'Held in escrow; the recipient directs it to a verified payee later.',
    consequence:
      'The strongest guarantee available: funds can never reach anyone unverified because they never leave escrow until directed. Equally unbypassable as Direct, but the recipient keeps choice.',
  },
  {
    tag: 'Restricted',
    icon: Lock,
    label: 'Restricted',
    summary: 'Paid into the recipient’s smart wallet, gated by a spend policy.',
    consequence:
      'Weaker than it looks: the policy constrains one signer, not the wallet. This screen only checks the policy is installed — at release, not now.',
  },
  {
    tag: 'Open',
    icon: Globe,
    label: 'Open',
    summary: 'Paid to the recipient with no restriction on onward spending.',
    consequence: 'No guardrails at all. The recipient can spend the award however they like.',
  },
];

const truncate = (addr: string) => `${addr.slice(0, 5)}…${addr.slice(-4)}`;

export const FinalizeAwards = () => {
  const { demoProgramme: programme } = useSoroban();
  const wallet = useWallet();

  const [budget, setBudget] = useState<bigint | null>(null);
  const [config, setConfig] = useState<ProgrammeConfig | null>(null);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [overviewError, setOverviewError] = useState<unknown>(null);

  const [applicantInput, setApplicantInput] = useState('');
  const [loadedApplicant, setLoadedApplicant] = useState<string | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [applicationLoading, setApplicationLoading] = useState(false);
  const [applicationError, setApplicationError] = useState<unknown>(null);
  const [existingAward, setExistingAward] = useState<AwardData | null>(null);

  const [modeTag, setModeTag] = useState<Mode['tag'] | null>(null);
  const [payeeInput, setPayeeInput] = useState('');
  const [payeeVerified, setPayeeVerified] = useState<boolean | null>(null);
  const [verifyingPayee, setVerifyingPayee] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [award, setAward] = useState<AwardData | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [budgetRes, configRes, phaseRes] = await Promise.all([
          programme.budget(),
          programme.get_config(),
          programme.get_phase(),
        ]);
        if (cancelled) return;
        setBudget(budgetRes.result.unwrap());
        setConfig(configRes.result.unwrap());
        setPhase(phaseRes.result.unwrap());
      } catch (error) {
        if (!cancelled) setOverviewError(error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [programme]);

  const quorum = config?.quorum ?? 0;
  const votes = application?.votes ?? [];
  const quorumReached = application != null && votes.length >= quorum;
  const granted = quorumReached ? votes[Math.floor((quorum - 1) / 2)] : null;
  const remainingAfter =
    budget != null && granted != null ? budget - granted : null;
  const insufficient = remainingAfter != null && remainingAfter < 0n;

  const selectedMode = modeTag ? ({ tag: modeTag, values: undefined } satisfies Mode) : null;
  const needsVerifiedPayee = selectedMode?.tag === 'Direct';
  const payee = needsVerifiedPayee ? payeeInput.trim() : (loadedApplicant ?? '');
  const payeeReady = !needsVerifiedPayee || payeeVerified === true;

  const loadApplication = async () => {
    const applicant = applicantInput.trim();
    if (!applicant) return;
    setLoadedApplicant(null);
    setApplication(null);
    setExistingAward(null);
    setAward(null);
    setModeTag(null);
    setPayeeInput('');
    setPayeeVerified(null);
    setSubmitError(null);
    setApplicationError(null);
    setApplicationLoading(true);
    try {
      const res = await programme.get_application({ applicant });
      const app = res.result.unwrap();
      setApplication(app);
      setLoadedApplicant(applicant);
      if (app.finalized) {
        try {
          const awardRes = await programme.get_award({ recipient: applicant });
          setExistingAward(awardRes.result.unwrap());
        } catch {
          setExistingAward(null);
        }
      }
    } catch (error) {
      setApplicationError(error);
    } finally {
      setApplicationLoading(false);
    }
  };

  const verifyPayee = async () => {
    const payeeToCheck = payeeInput.trim();
    if (!payeeToCheck) return;
    setVerifyingPayee(true);
    setPayeeVerified(null);
    try {
      const res = await programme.is_payee({ payee: payeeToCheck });
      setPayeeVerified(res.result);
    } catch {
      setPayeeVerified(false);
    } finally {
      setVerifyingPayee(false);
    }
  };

  const finalize = async () => {
    if (!selectedMode || !loadedApplicant || !payeeReady) return;
    setSubmitting(true);
    setSubmitError(null);
    setAward(null);
    try {
      const tx = await programme.finalize({ applicant: loadedApplicant, payee, mode: selectedMode });
      const sent = await tx.signAndSend({ signTransaction: wallet.signTransaction });
      const result = sent.result.unwrap();
      setAward(result);
      setExistingAward(result);
      setApplication({ ...application!, finalized: true });
    } catch (error) {
      setSubmitError(error);
    } finally {
      setSubmitting(false);
    }
  };

  const overviewExplained = overviewError ? explain(overviewError, 'program') : null;
  const applicationExplained = applicationError ? explain(applicationError, 'program') : null;
  const submitExplained = submitError ? explain(submitError, 'program') : null;

  return (
    <div className="dashboard-container finalize-page">
      <header className="dashboard-header animate-fade-up">
        <h1>Finalize Awards</h1>
        <p className="typo-text text-muted">
          Settle quorum-reached applications into awards. The mode you pick decides whether the money can reach anyone unverified.
        </p>
      </header>

      <section className="stats-grid animate-fade-up" style={{ animationDelay: '100ms' }}>
        <div className="stat-card glass-panel">
          <div className="stat-icon"><Coins size={24} /></div>
          <div className="stat-content">
            <span className="stat-label">Remaining Budget</span>
            <span className="stat-value">{budget !== null ? formatAmount(budget, { asset: 'XLM' }) : '…'}</span>
          </div>
        </div>
        <div className="stat-card glass-panel">
          <div className="stat-icon"><Award size={24} /></div>
          <div className="stat-content">
            <span className="stat-label">Programme Phase</span>
            <span className="stat-value">{phase ? phase.tag : '…'}</span>
          </div>
        </div>
        <div className="stat-card glass-panel">
          <div className="stat-icon"><CheckCircle size={24} /></div>
          <div className="stat-content">
            <span className="stat-label">Reviewer Quorum</span>
            <span className="stat-value">{config ? `${config.quorum} votes` : '…'}</span>
          </div>
        </div>
      </section>

      {overviewExplained && isFailure(overviewExplained) && (
        <ErrorState error={overviewError} contract="program" onRetry={() => window.location.reload()} />
      )}

      <section className="finalize-panel glass-panel animate-fade-up" style={{ animationDelay: '200ms' }}>
        <div className="finalize-panel__heading">
          <h2>Find an application</h2>
          <p className="typo-text text-muted">
            Only applications with enough reviewer votes can be finalised. Paste an applicant address to load it.
          </p>
        </div>

        <form
          className="lookup-form"
          onSubmit={(event) => {
            event.preventDefault();
            loadApplication();
          }}
        >
          <label className="lookup-form__field">
            <span className="lookup-form__label">Applicant address</span>
            <input
              className="lookup-input"
              value={applicantInput}
              onChange={(event) => setApplicantInput(event.target.value)}
              placeholder="G…"
              spellCheck={false}
            />
          </label>
          <button type="submit" className="btn-primary" disabled={applicationLoading || !applicantInput.trim()}>
            {applicationLoading ? <Loader className="spin" size={18} /> : <Search size={18} />}
            Load application
          </button>
        </form>

        {applicationLoading && <Loading rows={2} />}

        {applicationExplained && (
          <ErrorState
            error={applicationError}
            contract="program"
            onRetry={loadApplication}
          />
        )}

        {application && !applicationLoading && (
          <>
            <div className="application-card">
              <div className="application-card__header">
                <h3>Application</h3>
                <span className={`badge ${application.finalized ? 'badge-active' : quorumReached ? 'badge-pending' : 'badge-muted'}`}>
                  {application.finalized ? 'Finalized' : quorumReached ? 'Quorum reached' : 'Awaiting votes'}
                </span>
              </div>
              <div className="application-card__grid">
                <div>
                  <span className="detail-label">Applicant</span>
                  <span className="detail-value mono" title={loadedApplicant ?? ''}>{truncate(loadedApplicant ?? '')}</span>
                </div>
                <div>
                  <span className="detail-label">Requested</span>
                  <span className="detail-value">{formatAmount(application.requested, { asset: 'XLM' })}</span>
                </div>
                <div>
                  <span className="detail-label">Votes</span>
                  <span className="detail-value">{application.votes.length} / {quorum} needed</span>
                </div>
                <div>
                  <span className="detail-label">Computed award</span>
                  <span className="detail-value">{granted !== null ? formatAmount(granted, { asset: 'XLM' }) : '—'}</span>
                </div>
              </div>
            </div>

            {existingAward && (
              <AwardResultCard title="Already finalised into an award" award={existingAward} />
            )}

            {application.finalized && (
              <p className="notice">This application has already been settled. Load another applicant to finalise more awards.</p>
            )}

            {!application.finalized && !quorumReached && (
              <p className="notice notice--blocked">
                Not enough reviewers have voted yet — this application needs {quorum} votes before it can be finalised.
              </p>
            )}

            {!application.finalized && quorumReached && (
              <div className="finalize-flow">
                <div className="finalize-flow__heading">
                  <h3>Choose how the award is paid</h3>
                  <p className="typo-text text-muted">
                    The mode decides whether the money stays accountable. Allocated and Direct are equally unbypassable — they differ in who chooses the payee.
                  </p>
                </div>

                <div className="mode-grid">
                  {MODE_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const active = modeTag === option.tag;
                    return (
                      <button
                        key={option.tag}
                        type="button"
                        className={`mode-card ${active ? 'mode-card--active' : ''}`}
                        onClick={() => {
                          setModeTag(option.tag);
                          setPayeeVerified(null);
                          setSubmitError(null);
                        }}
                      >
                        <div className="mode-card__icon"><Icon size={22} /></div>
                        <div className="mode-card__body">
                          <h4>{option.label}</h4>
                          <p className="mode-card__summary">{option.summary}</p>
                          <p className="mode-card__consequence">{option.consequence}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedMode && needsVerifiedPayee && (
                  <div className="payee-section">
                    <h4>Verified payee</h4>
                    <p className="typo-text text-muted">
                      Direct awards are paid straight to a verified institution. The payee must be one this programme has verified, or the call fails.
                    </p>
                    <div className="payee-row">
                      <input
                        className="lookup-input"
                        value={payeeInput}
                        onChange={(event) => {
                          setPayeeInput(event.target.value);
                          setPayeeVerified(null);
                        }}
                        placeholder="Verified payee address (G…)"
                        spellCheck={false}
                      />
                      <button type="button" className="btn-secondary" onClick={verifyPayee} disabled={verifyingPayee || !payeeInput.trim()}>
                        {verifyingPayee ? <Loader className="spin" size={18} /> : <ShieldCheck size={18} />}
                        Verify payee
                      </button>
                    </div>
                    {payeeVerified === true && (
                      <p className="notice notice--ok">
                        <CheckCircle size={16} /> {truncate(payeeInput.trim())} is a verified payee for this programme.
                      </p>
                    )}
                    {payeeVerified === false && (
                      <p className="notice notice--blocked">
                        <AlertTriangle size={16} /> This address is not a verified payee. Only the programme creator can verify a payee.
                      </p>
                    )}
                  </div>
                )}

                {selectedMode && !needsVerifiedPayee && (
                  <div className="payee-section">
                    <h4>Payee</h4>
                    <p className="typo-text text-muted">
                      With {selectedMode.tag}, the award is paid to the recipient themselves, so the payee is the applicant.
                    </p>
                    <div className="payee-row">
                      <span className="detail-value mono" title={loadedApplicant ?? ''}>{truncate(loadedApplicant ?? '')}</span>
                    </div>
                  </div>
                )}

                {granted !== null && budget !== null && (
                  <div className={`budget-note ${insufficient ? 'budget-note--error' : 'budget-note--ok'}`}>
                    <div>
                      <span className="detail-label">Computed award</span>
                      <span className="detail-value">{formatAmount(granted, { asset: 'XLM' })}</span>
                    </div>
                    <div>
                      <span className="detail-label">Remaining budget after award</span>
                      <span className="detail-value">{formatAmount(remainingAfter!, { asset: 'XLM' })}</span>
                    </div>
                  </div>
                )}

                {insufficient && (
                  <p className="notice notice--blocked">
                    <AlertTriangle size={16} /> This award exceeds the remaining budget. Awards settle in the order they are finalised — first finalised, first funded.
                  </p>
                )}

                {wallet.status !== 'connected' && (
                  <p className="notice">
                    <Wallet size={16} /> Connect a wallet above to sign the finalise transaction.
                  </p>
                )}

                <div className="finalize-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={
                      !payeeReady || insufficient || submitting || wallet.status !== 'connected'
                    }
                    onClick={finalize}
                  >
                    {submitting ? <Loader className="spin" size={18} /> : <ArrowRight size={18} />}
                    {submitting ? 'Finalising…' : 'Finalize award'}
                  </button>
                  {!payeeReady && needsVerifiedPayee && (
                    <span className="hint">Select and verify a payee first.</span>
                  )}
                </div>

                {submitExplained && (
                  <ErrorState
                    error={submitError}
                    contract="program"
                    onRetry={finalize}
                  />
                )}

                {award && <AwardResultCard title="Award finalised" award={award} />}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};

function AwardResultCard({ title, award }: { title: string; award: AwardData }) {
  return (
    <div className="award-result">
      <div className="award-result__header">
        <CheckCircle size={20} />
        <h4>{title}</h4>
      </div>
      <div className="application-card__grid">
        <div>
          <span className="detail-label">Recipient</span>
          <span className="detail-value mono" title={award.recipient}>{truncate(award.recipient)}</span>
        </div>
        <div>
          <span className="detail-label">Granted</span>
          <span className="detail-value">{formatAmount(award.granted, { asset: 'XLM' })}</span>
        </div>
        <div>
          <span className="detail-label">Mode</span>
          <span className="detail-value">{award.mode.tag}</span>
        </div>
        <div>
          <span className="detail-label">Payee</span>
          <span className="detail-value mono" title={award.payee}>{truncate(award.payee)}</span>
        </div>
        <div>
          <span className="detail-label">Tranches</span>
          <span className="detail-value">{award.tranches}</span>
        </div>
      </div>
    </div>
  );
}
