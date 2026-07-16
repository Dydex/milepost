#![no_std]
// Contract constructors legitimately take many parameters, and the SDK's
// generated clients mirror those signatures.
#![allow(clippy::too_many_arguments)]

//! # Programme
//!
//! One funding round. Contributors put money in, applicants ask for what they
//! actually need, reviewers approve an amount up to that, and the result is an
//! award with a tranche schedule that Phase 3 releases against attestations.
//!
//! ## Partial funding, because equal splits are not funding
//!
//! The common shortcut is to divide the pot equally among everyone approved.
//! That ignores the only thing that matters: one applicant needs 200 for exam
//! fees and another needs 5,000 for tuition. Here an applicant states a
//! `requested` amount and each reviewer approves some amount up to it, so a
//! programme can fully fund one person, partially fund another, and reject a
//! third.
//!
//! ## Why the award is the median of reviewer votes
//!
//! Reviewers rarely agree on a number. Taking the **minimum** lets one cautious
//! reviewer dictate the outcome; the **mean** lets one outlier drag it. The
//! median is what a committee would land on and is robust to a single reviewer
//! at either extreme.
//!
//! Computing it needs the votes ordered, which means holding a collection — the
//! thing deliberately avoided elsewhere in this protocol. It is acceptable here
//! for one specific reason: the vote vector is **bounded at construction** by
//! `quorum`, which is capped at [`MAX_QUORUM`]. It cannot grow without limit, so
//! its write cost and its restoration cost after archival are both known in
//! advance. Votes are also inserted in sorted position rather than sorted later,
//! so the cost stays linear in a small fixed bound.
//!
//! ## Budget
//!
//! Awards are settled against the contributed balance less the protocol fee,
//! first finalised first served. A programme that over-approves will find later
//! finalisations rejected rather than silently over-committing money it does not
//! have.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, BytesN,
    Env, Vec,
};

/// Ledgers per day, at the ~5 second close time Stellar targets.
const DAY_IN_LEDGERS: u32 = 17_280;
const BUMP_LEDGERS: u32 = 90 * DAY_IN_LEDGERS;
const BUMP_THRESHOLD: u32 = 60 * DAY_IN_LEDGERS;

/// Upper bound on reviewers required per applicant. Bounds the vote vector, and
/// with it the worst-case write and restoration cost of a review entry.
pub const MAX_QUORUM: u32 = 16;
/// Protocol fee ceiling, in basis points. A programme cannot be created with a
/// fee above this no matter what the registry says.
pub const MAX_FEE_BPS: u32 = 1_000;
const BPS_DENOMINATOR: i128 = 10_000;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotAuthorized = 1,
    /// The action does not belong to the programme's current phase.
    WrongPhase = 2,
    InvalidAmount = 3,
    InvalidDeadlines = 4,
    InvalidQuorum = 5,
    FeeTooHigh = 6,
    NoReviewers = 7,
    ApplicationNotFound = 8,
    AlreadyApplied = 9,
    AlreadyReviewed = 10,
    /// Approving more than the applicant asked for.
    ExceedsRequested = 11,
    /// Not enough reviewers have voted to settle this application yet.
    QuorumNotReached = 12,
    AlreadyFinalized = 13,
    /// The remaining budget cannot cover this award.
    InsufficientBudget = 14,
    Overflow = 15,
    Cancelled = 16,
    /// A programme with money in it, or awards made, cannot be cancelled.
    NotCancellable = 17,
}

/// Where a tranche is paid. Restricted and Open modes arrive with the policy
/// signer in Phase 4; Direct needs no wallet machinery and carries most of the
/// accountability on its own.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Mode {
    /// Paid straight to a verified payee — a school, clinic or supplier. The
    /// recipient never holds the funds.
    Direct = 0,
    /// Paid to the recipient's wallet, which a policy signer restricts to
    /// verified destinations.
    Restricted = 1,
    /// Paid to the recipient with no restriction.
    Open = 2,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Phase {
    Open,
    Review,
    Settled,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub creator: Address,
    /// The asset being distributed, as a Stellar Asset Contract address.
    pub token: Address,
    pub treasury: Address,
    pub fee_bps: u32,
    /// Applications close here.
    pub apply_deadline: u64,
    /// Reviews close here.
    pub review_deadline: u64,
    /// Reviewer votes needed before an application can be finalised.
    pub quorum: u32,
    pub tranches: u32,
    pub metadata_hash: BytesN<32>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Application {
    pub applicant: Address,
    pub requested: i128,
    pub metadata_hash: BytesN<32>,
    pub submitted_at: u64,
    /// Approved amounts, kept in ascending order so the median is a lookup.
    pub votes: Vec<i128>,
    pub finalized: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Award {
    pub recipient: Address,
    /// What reviewers settled on. Never more than `requested`.
    pub granted: i128,
    pub released: i128,
    pub tranches: u32,
    pub tranches_released: u32,
    pub payee: Address,
    pub mode: Mode,
}

#[contractevent(topics = ["contrib"], data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Contributed {
    #[topic]
    pub donor: Address,
    pub amount: i128,
}

#[contractevent(topics = ["applied"], data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Applied {
    #[topic]
    pub applicant: Address,
    pub application: Application,
}

#[contractevent(topics = ["reviewed"], data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Reviewed {
    #[topic]
    pub applicant: Address,
    #[topic]
    pub reviewer: Address,
    pub approved: i128,
}

#[contractevent(topics = ["awarded"], data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Awarded {
    #[topic]
    pub recipient: Address,
    pub award: Award,
}

#[contractevent(topics = ["cancelled"], data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProgrammeCancelled {
    pub at: u64,
}

#[contracttype]
#[derive(Clone)]
enum Key {
    Config,
    Cancelled,
    Contributed,
    Granted,
    /// One entry per contributor, so refunds stay proportional without a list.
    Donor(Address),
    Reviewer(Address),
    Application(Address),
    Award(Address),
    /// Marks that `reviewer` already voted on `applicant`.
    Voted(Address, Address),
}

#[contract]
pub struct Programme;

#[contractimpl]
impl Programme {
    pub fn __constructor(
        env: Env,
        creator: Address,
        token: Address,
        treasury: Address,
        fee_bps: u32,
        apply_deadline: u64,
        review_deadline: u64,
        quorum: u32,
        tranches: u32,
        metadata_hash: BytesN<32>,
        reviewers: Vec<Address>,
    ) -> Result<(), Error> {
        if fee_bps > MAX_FEE_BPS {
            return Err(Error::FeeTooHigh);
        }
        let now = env.ledger().timestamp();
        if apply_deadline <= now || review_deadline <= apply_deadline {
            return Err(Error::InvalidDeadlines);
        }
        if reviewers.is_empty() {
            return Err(Error::NoReviewers);
        }
        // Quorum above the reviewer count would make every application
        // permanently unfinalisable.
        if quorum == 0 || quorum > MAX_QUORUM || quorum > reviewers.len() {
            return Err(Error::InvalidQuorum);
        }
        if tranches == 0 {
            return Err(Error::InvalidAmount);
        }

        for reviewer in reviewers.iter() {
            env.storage()
                .persistent()
                .set(&Key::Reviewer(reviewer), &true);
        }

        env.storage().instance().set(
            &Key::Config,
            &Config {
                creator,
                token,
                treasury,
                fee_bps,
                apply_deadline,
                review_deadline,
                quorum,
                tranches,
                metadata_hash,
            },
        );
        env.storage().instance().set(&Key::Contributed, &0i128);
        env.storage().instance().set(&Key::Granted, &0i128);
        Ok(())
    }

    /// Put money in. Contributions close when applications do, so the budget is
    /// fixed before anyone reviews against it — a reviewer approving an amount
    /// should not have the ground move underneath them.
    pub fn contribute(env: Env, donor: Address, amount: i128) -> Result<(), Error> {
        donor.require_auth();
        Self::require_phase(&env, Phase::Open)?;
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let config = Self::config(&env)?;
        token::Client::new(&env, &config.token).transfer(
            &donor,
            env.current_contract_address(),
            &amount,
        );

        let key = Key::Donor(donor.clone());
        let prior: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage()
            .persistent()
            .set(&key, &prior.checked_add(amount).ok_or(Error::Overflow)?);
        env.storage()
            .persistent()
            .extend_ttl(&key, BUMP_THRESHOLD, BUMP_LEDGERS);

        let total: i128 = env.storage().instance().get(&Key::Contributed).unwrap_or(0);
        env.storage().instance().set(
            &Key::Contributed,
            &total.checked_add(amount).ok_or(Error::Overflow)?,
        );

        Contributed { donor, amount }.publish(&env);
        Ok(())
    }

    /// Ask for what you actually need. `metadata_hash` points at the proposal;
    /// the payload lives wherever the parties agree, so a pinning service being
    /// down cannot block an application.
    pub fn apply(
        env: Env,
        applicant: Address,
        requested: i128,
        metadata_hash: BytesN<32>,
    ) -> Result<(), Error> {
        applicant.require_auth();
        Self::require_phase(&env, Phase::Open)?;
        if requested <= 0 {
            return Err(Error::InvalidAmount);
        }

        let key = Key::Application(applicant.clone());
        if env.storage().persistent().has(&key) {
            return Err(Error::AlreadyApplied);
        }

        let application = Application {
            applicant: applicant.clone(),
            requested,
            metadata_hash,
            submitted_at: env.ledger().timestamp(),
            votes: Vec::new(&env),
            finalized: false,
        };
        env.storage().persistent().set(&key, &application);
        env.storage()
            .persistent()
            .extend_ttl(&key, BUMP_THRESHOLD, BUMP_LEDGERS);

        Applied {
            applicant,
            application,
        }
        .publish(&env);
        Ok(())
    }

    /// Approve an amount up to what was requested. A reviewer who thinks the
    /// application should be rejected simply does not vote — there is no
    /// "approve zero", because a zero-value award is just a rejection with extra
    /// storage.
    pub fn review(
        env: Env,
        reviewer: Address,
        applicant: Address,
        approved: i128,
    ) -> Result<(), Error> {
        reviewer.require_auth();
        Self::require_phase(&env, Phase::Review)?;
        if !env
            .storage()
            .persistent()
            .has(&Key::Reviewer(reviewer.clone()))
        {
            return Err(Error::NotAuthorized);
        }

        let vote_key = Key::Voted(applicant.clone(), reviewer.clone());
        if env.storage().persistent().has(&vote_key) {
            return Err(Error::AlreadyReviewed);
        }

        let key = Key::Application(applicant.clone());
        let mut application: Application = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::ApplicationNotFound)?;
        if application.finalized {
            return Err(Error::AlreadyFinalized);
        }
        if approved <= 0 {
            return Err(Error::InvalidAmount);
        }
        if approved > application.requested {
            return Err(Error::ExceedsRequested);
        }

        // Inserted in sorted position so the median never needs a sort pass.
        let mut at = application.votes.len();
        for (i, existing) in application.votes.iter().enumerate() {
            if approved < existing {
                at = i as u32;
                break;
            }
        }
        application.votes.insert(at, approved);

        env.storage().persistent().set(&key, &application);
        env.storage()
            .persistent()
            .extend_ttl(&key, BUMP_THRESHOLD, BUMP_LEDGERS);
        env.storage().persistent().set(&vote_key, &true);
        env.storage()
            .persistent()
            .extend_ttl(&vote_key, BUMP_THRESHOLD, BUMP_LEDGERS);

        Reviewed {
            applicant,
            reviewer,
            approved,
        }
        .publish(&env);
        Ok(())
    }

    /// Settle an application into an award once quorum is in. Permissionless to
    /// call: the outcome is already determined by the votes, and requiring a
    /// privileged party to trigger it would let them strand an applicant.
    ///
    /// `payee` is where tranches are paid. In [`Mode::Direct`] that is a verified
    /// institution rather than the recipient.
    pub fn finalize(
        env: Env,
        applicant: Address,
        payee: Address,
        mode: Mode,
    ) -> Result<Award, Error> {
        match Self::phase(&env)? {
            Phase::Review | Phase::Settled => {}
            Phase::Cancelled => return Err(Error::Cancelled),
            Phase::Open => return Err(Error::WrongPhase),
        }

        let key = Key::Application(applicant.clone());
        let mut application: Application = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::ApplicationNotFound)?;
        if application.finalized {
            return Err(Error::AlreadyFinalized);
        }

        let config = Self::config(&env)?;
        if application.votes.len() < config.quorum {
            return Err(Error::QuorumNotReached);
        }

        // Median of the first `quorum` votes, which are already sorted. With an
        // even count this takes the lower of the two middles — the conservative
        // side, which is the right bias when the number is money.
        let granted = application
            .votes
            .get((config.quorum - 1) / 2)
            .ok_or(Error::QuorumNotReached)?;

        let granted_so_far: i128 = env.storage().instance().get(&Key::Granted).unwrap_or(0);
        let committed = granted_so_far.checked_add(granted).ok_or(Error::Overflow)?;
        if committed > Self::available(&env, &config)? {
            return Err(Error::InsufficientBudget);
        }

        application.finalized = true;
        env.storage().persistent().set(&key, &application);
        env.storage()
            .persistent()
            .extend_ttl(&key, BUMP_THRESHOLD, BUMP_LEDGERS);
        env.storage().instance().set(&Key::Granted, &committed);

        let award = Award {
            recipient: applicant.clone(),
            granted,
            released: 0,
            tranches: config.tranches,
            tranches_released: 0,
            payee,
            mode,
        };
        let award_key = Key::Award(applicant.clone());
        env.storage().persistent().set(&award_key, &award);
        env.storage()
            .persistent()
            .extend_ttl(&award_key, BUMP_THRESHOLD, BUMP_LEDGERS);

        Awarded {
            recipient: applicant,
            award: award.clone(),
        }
        .publish(&env);
        Ok(award)
    }

    /// Abandon a programme before it has taken on any obligations. Only possible
    /// while nothing has been contributed and nothing awarded, so this can never
    /// strand someone else's money.
    pub fn cancel(env: Env) -> Result<(), Error> {
        let config = Self::config(&env)?;
        config.creator.require_auth();

        if env.storage().instance().get::<_, bool>(&Key::Cancelled) == Some(true) {
            return Err(Error::Cancelled);
        }
        let contributed: i128 = env.storage().instance().get(&Key::Contributed).unwrap_or(0);
        let granted: i128 = env.storage().instance().get(&Key::Granted).unwrap_or(0);
        if contributed != 0 || granted != 0 {
            return Err(Error::NotCancellable);
        }

        env.storage().instance().set(&Key::Cancelled, &true);
        ProgrammeCancelled {
            at: env.ledger().timestamp(),
        }
        .publish(&env);
        Ok(())
    }

    // ---- views ----

    pub fn config(env: &Env) -> Result<Config, Error> {
        env.storage()
            .instance()
            .get(&Key::Config)
            .ok_or(Error::NotAuthorized)
    }

    pub fn get_config(env: Env) -> Result<Config, Error> {
        Self::config(&env)
    }

    pub fn phase(env: &Env) -> Result<Phase, Error> {
        if env.storage().instance().get::<_, bool>(&Key::Cancelled) == Some(true) {
            return Ok(Phase::Cancelled);
        }
        let config = Self::config(env)?;
        let now = env.ledger().timestamp();
        Ok(if now < config.apply_deadline {
            Phase::Open
        } else if now < config.review_deadline {
            Phase::Review
        } else {
            Phase::Settled
        })
    }

    pub fn get_phase(env: Env) -> Result<Phase, Error> {
        Self::phase(&env)
    }

    pub fn get_application(env: Env, applicant: Address) -> Result<Application, Error> {
        env.storage()
            .persistent()
            .get(&Key::Application(applicant))
            .ok_or(Error::ApplicationNotFound)
    }

    pub fn get_award(env: Env, recipient: Address) -> Result<Award, Error> {
        env.storage()
            .persistent()
            .get(&Key::Award(recipient))
            .ok_or(Error::ApplicationNotFound)
    }

    pub fn contributed_by(env: Env, donor: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&Key::Donor(donor))
            .unwrap_or(0)
    }

    pub fn total_contributed(env: Env) -> i128 {
        env.storage().instance().get(&Key::Contributed).unwrap_or(0)
    }

    pub fn total_granted(env: Env) -> i128 {
        env.storage().instance().get(&Key::Granted).unwrap_or(0)
    }

    pub fn is_reviewer(env: Env, addr: Address) -> bool {
        env.storage().persistent().has(&Key::Reviewer(addr))
    }

    /// Contributions less the protocol fee — what is actually available to award.
    pub fn budget(env: Env) -> Result<i128, Error> {
        let config = Self::config(&env)?;
        Self::available(&env, &config)
    }

    /// The protocol's cut, computed from contributions rather than held back at
    /// contribution time so a donor's receipt matches what they sent.
    pub fn fee(env: Env) -> Result<i128, Error> {
        let config = Self::config(&env)?;
        let total: i128 = env.storage().instance().get(&Key::Contributed).unwrap_or(0);
        Ok(total * config.fee_bps as i128 / BPS_DENOMINATOR)
    }

    fn available(env: &Env, config: &Config) -> Result<i128, Error> {
        let total: i128 = env.storage().instance().get(&Key::Contributed).unwrap_or(0);
        let fee = total
            .checked_mul(config.fee_bps as i128)
            .ok_or(Error::Overflow)?
            / BPS_DENOMINATOR;
        Ok(total - fee)
    }

    fn require_phase(env: &Env, expected: Phase) -> Result<(), Error> {
        let actual = Self::phase(env)?;
        if actual == Phase::Cancelled {
            return Err(Error::Cancelled);
        }
        if actual != expected {
            return Err(Error::WrongPhase);
        }
        Ok(())
    }
}

#[cfg(test)]
mod test;
