#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token::{StellarAssetClient, TokenClient},
    vec, Env,
};

const APPLY_DEADLINE: u64 = 10_000;
const REVIEW_DEADLINE: u64 = 20_000;
const FEE_BPS: u32 = 1_000; // 10%

struct Fixture {
    env: Env,
    client: ProgrammeClient<'static>,
    token: TokenClient<'static>,
    mint: StellarAssetClient<'static>,
    creator: Address,
    treasury: Address,
    reviewers: Vec<Address>,
}

fn setup(quorum: u32, reviewer_count: u32) -> Fixture {
    let env = Env::default();
    env.mock_all_auths();

    let issuer = Address::generate(&env);
    let asset = env.register_stellar_asset_contract_v2(issuer);
    let token = TokenClient::new(&env, &asset.address());
    let mint = StellarAssetClient::new(&env, &asset.address());

    let creator = Address::generate(&env);
    let treasury = Address::generate(&env);
    let mut reviewers = Vec::new(&env);
    for _ in 0..reviewer_count {
        reviewers.push_back(Address::generate(&env));
    }

    let id = env.register(
        Programme,
        (
            creator.clone(),
            asset.address(),
            treasury.clone(),
            FEE_BPS,
            APPLY_DEADLINE,
            REVIEW_DEADLINE,
            quorum,
            3u32,
            BytesN::from_array(&env, &[7u8; 32]),
            reviewers.clone(),
        ),
    );

    let client = ProgrammeClient::new(&env, &id);
    Fixture {
        env: env.clone(),
        client,
        token,
        mint,
        creator,
        treasury,
        reviewers,
    }
}

fn funded_donor(f: &Fixture, amount: i128) -> Address {
    let donor = Address::generate(&f.env);
    f.mint.mint(&donor, &amount);
    donor
}

fn hash(env: &Env, byte: u8) -> BytesN<32> {
    BytesN::from_array(env, &[byte; 32])
}

fn to_review(f: &Fixture) {
    f.env.ledger().set_timestamp(APPLY_DEADLINE + 1);
}

// ---- construction ----

#[test]
fn constructor_stores_config_and_reviewers() {
    let f = setup(3, 5);
    let c = f.client.get_config();
    assert_eq!(c.creator, f.creator);
    assert_eq!(c.treasury, f.treasury);
    assert_eq!(c.quorum, 3);
    assert_eq!(c.tranches, 3);
    assert_eq!(f.client.get_phase(), Phase::Open);
    for r in f.reviewers.iter() {
        assert!(f.client.is_reviewer(&r));
    }
}

/// Constructing with a quorum above the reviewer count would make every
/// application permanently unfinalisable, so it is refused outright.
#[test]
#[should_panic]
fn quorum_above_reviewer_count_is_rejected() {
    construct_with(5, 3, APPLY_DEADLINE, REVIEW_DEADLINE, FEE_BPS);
}

#[test]
#[should_panic]
fn review_deadline_before_apply_deadline_is_rejected() {
    construct_with(1, 3, REVIEW_DEADLINE, APPLY_DEADLINE, FEE_BPS);
}

#[test]
#[should_panic]
fn a_fee_above_the_ceiling_is_rejected() {
    construct_with(1, 3, APPLY_DEADLINE, REVIEW_DEADLINE, MAX_FEE_BPS + 1);
}

#[test]
#[should_panic]
fn zero_quorum_is_rejected() {
    construct_with(0, 3, APPLY_DEADLINE, REVIEW_DEADLINE, FEE_BPS);
}

fn construct_with(quorum: u32, reviewer_count: u32, apply: u64, review: u64, fee_bps: u32) {
    let env = Env::default();
    env.mock_all_auths();
    let issuer = Address::generate(&env);
    let asset = env.register_stellar_asset_contract_v2(issuer);
    let mut reviewers = Vec::new(&env);
    for _ in 0..reviewer_count {
        reviewers.push_back(Address::generate(&env));
    }

    env.register(
        Programme,
        (
            Address::generate(&env),
            asset.address(),
            Address::generate(&env),
            fee_bps,
            apply,
            review,
            quorum,
            3u32,
            BytesN::from_array(&env, &[7u8; 32]),
            reviewers,
        ),
    );
}

// ---- contributions ----

#[test]
fn contributions_accumulate_and_move_tokens() {
    let f = setup(2, 3);
    let a = funded_donor(&f, 1_000);
    let b = funded_donor(&f, 500);

    f.client.contribute(&a, &1_000);
    f.client.contribute(&b, &500);

    assert_eq!(f.client.total_contributed(), 1_500);
    assert_eq!(f.client.contributed_by(&a), 1_000);
    assert_eq!(f.client.contributed_by(&b), 500);
    assert_eq!(f.token.balance(&f.client.address), 1_500);
    assert_eq!(f.token.balance(&a), 0);
}

#[test]
fn a_donor_can_top_up() {
    let f = setup(2, 3);
    let a = funded_donor(&f, 1_000);
    f.client.contribute(&a, &400);
    f.client.contribute(&a, &600);
    assert_eq!(f.client.contributed_by(&a), 1_000);
}

#[test]
fn budget_is_contributions_less_fee() {
    let f = setup(2, 3);
    let a = funded_donor(&f, 1_000);
    f.client.contribute(&a, &1_000);

    assert_eq!(f.client.fee(), 100); // 10%
    assert_eq!(f.client.budget(), 900);
}

#[test]
fn contributions_close_with_applications() {
    // The budget must be fixed before anyone reviews against it.
    let f = setup(2, 3);
    let a = funded_donor(&f, 1_000);
    to_review(&f);
    assert_eq!(
        f.client.try_contribute(&a, &1_000),
        Err(Ok(Error::WrongPhase))
    );
}

#[test]
fn non_positive_contributions_are_rejected() {
    let f = setup(2, 3);
    let a = funded_donor(&f, 1_000);
    assert_eq!(
        f.client.try_contribute(&a, &0),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(
        f.client.try_contribute(&a, &-100),
        Err(Ok(Error::InvalidAmount))
    );
}

// ---- applications ----

#[test]
fn applicants_state_what_they_need() {
    let f = setup(2, 3);
    let applicant = Address::generate(&f.env);
    f.env.ledger().set_timestamp(500);

    f.client.apply(&applicant, &5_000, &hash(&f.env, 1));

    let a = f.client.get_application(&applicant);
    assert_eq!(a.requested, 5_000);
    assert_eq!(a.submitted_at, 500);
    assert_eq!(a.votes.len(), 0);
    assert!(!a.finalized);
}

#[test]
fn one_application_per_applicant() {
    let f = setup(2, 3);
    let applicant = Address::generate(&f.env);
    f.client.apply(&applicant, &5_000, &hash(&f.env, 1));
    assert_eq!(
        f.client.try_apply(&applicant, &1_000, &hash(&f.env, 2)),
        Err(Ok(Error::AlreadyApplied))
    );
}

#[test]
fn applications_close_on_deadline() {
    let f = setup(2, 3);
    let applicant = Address::generate(&f.env);
    to_review(&f);
    assert_eq!(
        f.client.try_apply(&applicant, &5_000, &hash(&f.env, 1)),
        Err(Ok(Error::WrongPhase))
    );
}

// ---- review ----

#[test]
fn reviewers_approve_up_to_the_requested_amount() {
    let f = setup(2, 3);
    let applicant = Address::generate(&f.env);
    f.client.apply(&applicant, &5_000, &hash(&f.env, 1));
    to_review(&f);

    f.client
        .review(&f.reviewers.get(0).unwrap(), &applicant, &3_000);
    assert_eq!(f.client.get_application(&applicant).votes.len(), 1);

    assert_eq!(
        f.client
            .try_review(&f.reviewers.get(1).unwrap(), &applicant, &5_001),
        Err(Ok(Error::ExceedsRequested))
    );
}

#[test]
fn only_registered_reviewers_may_review() {
    let f = setup(2, 3);
    let applicant = Address::generate(&f.env);
    f.client.apply(&applicant, &5_000, &hash(&f.env, 1));
    to_review(&f);

    let stranger = Address::generate(&f.env);
    assert_eq!(
        f.client.try_review(&stranger, &applicant, &1_000),
        Err(Ok(Error::NotAuthorized))
    );
}

#[test]
fn a_reviewer_votes_once_per_applicant() {
    let f = setup(2, 3);
    let applicant = Address::generate(&f.env);
    f.client.apply(&applicant, &5_000, &hash(&f.env, 1));
    to_review(&f);

    let r = f.reviewers.get(0).unwrap();
    f.client.review(&r, &applicant, &3_000);
    assert_eq!(
        f.client.try_review(&r, &applicant, &4_000),
        Err(Ok(Error::AlreadyReviewed))
    );
}

#[test]
fn votes_are_kept_sorted_regardless_of_arrival_order() {
    let f = setup(3, 3);
    let applicant = Address::generate(&f.env);
    f.client.apply(&applicant, &5_000, &hash(&f.env, 1));
    to_review(&f);

    f.client
        .review(&f.reviewers.get(0).unwrap(), &applicant, &3_000);
    f.client
        .review(&f.reviewers.get(1).unwrap(), &applicant, &1_000);
    f.client
        .review(&f.reviewers.get(2).unwrap(), &applicant, &2_000);

    let votes = f.client.get_application(&applicant).votes;
    assert_eq!(votes, vec![&f.env, 1_000, 2_000, 3_000]);
}

#[test]
fn review_is_closed_outside_the_review_window() {
    let f = setup(2, 3);
    let applicant = Address::generate(&f.env);
    f.client.apply(&applicant, &5_000, &hash(&f.env, 1));
    let r = f.reviewers.get(0).unwrap();

    // Too early.
    assert_eq!(
        f.client.try_review(&r, &applicant, &1_000),
        Err(Ok(Error::WrongPhase))
    );
    // Too late.
    f.env.ledger().set_timestamp(REVIEW_DEADLINE + 1);
    assert_eq!(
        f.client.try_review(&r, &applicant, &1_000),
        Err(Ok(Error::WrongPhase))
    );
}

// ---- finalisation and partial funding ----

fn awarded(f: &Fixture, applicant: &Address, requested: i128, votes: &[i128]) -> Award {
    let donor = funded_donor(f, 100_000);
    f.client.contribute(&donor, &100_000);
    f.client.apply(applicant, &requested, &hash(&f.env, 1));
    to_review(f);
    for (i, v) in votes.iter().enumerate() {
        f.client
            .review(&f.reviewers.get(i as u32).unwrap(), applicant, v);
    }
    f.client
        .finalize(applicant, &Address::generate(&f.env), &Mode::Direct)
}

#[test]
fn award_is_the_median_of_reviewer_votes() {
    let f = setup(3, 5);
    let applicant = Address::generate(&f.env);
    // A committee that mostly agrees, with one cautious outlier: the median
    // holds at 1_000 rather than being dragged to 200 by the minimum.
    let award = awarded(&f, &applicant, 2_000, &[1_000, 200, 1_000]);
    assert_eq!(award.granted, 1_000);
}

#[test]
fn a_single_generous_reviewer_cannot_inflate_the_award() {
    let f = setup(3, 5);
    let applicant = Address::generate(&f.env);
    let award = awarded(&f, &applicant, 9_000, &[500, 9_000, 600]);
    assert_eq!(award.granted, 600);
}

#[test]
fn partial_funding_awards_less_than_requested() {
    let f = setup(2, 3);
    let applicant = Address::generate(&f.env);
    let award = awarded(&f, &applicant, 5_000, &[2_000, 3_000]);
    assert!(award.granted < 5_000);
    assert_eq!(award.granted, 2_000, "even count takes the lower middle");
}

#[test]
fn full_funding_is_possible_when_reviewers_agree() {
    let f = setup(2, 3);
    let applicant = Address::generate(&f.env);
    let award = awarded(&f, &applicant, 1_000, &[1_000, 1_000]);
    assert_eq!(award.granted, 1_000);
}

#[test]
fn different_applicants_get_different_amounts() {
    // The whole point of partial funding over an equal split.
    let f = setup(2, 3);
    let donor = funded_donor(&f, 100_000);
    f.client.contribute(&donor, &100_000);

    let small = Address::generate(&f.env);
    let large = Address::generate(&f.env);
    f.client.apply(&small, &200, &hash(&f.env, 1));
    f.client.apply(&large, &5_000, &hash(&f.env, 2));
    to_review(&f);

    for i in 0..2u32 {
        let r = f.reviewers.get(i).unwrap();
        f.client.review(&r, &small, &200);
        f.client.review(&r, &large, &5_000);
    }

    let payee = Address::generate(&f.env);
    let a = f.client.finalize(&small, &payee, &Mode::Direct);
    let b = f.client.finalize(&large, &payee, &Mode::Direct);
    assert_eq!(a.granted, 200);
    assert_eq!(b.granted, 5_000);
}

#[test]
fn finalize_requires_quorum() {
    let f = setup(3, 5);
    let applicant = Address::generate(&f.env);
    let donor = funded_donor(&f, 10_000);
    f.client.contribute(&donor, &10_000);
    f.client.apply(&applicant, &1_000, &hash(&f.env, 1));
    to_review(&f);

    f.client
        .review(&f.reviewers.get(0).unwrap(), &applicant, &1_000);
    f.client
        .review(&f.reviewers.get(1).unwrap(), &applicant, &1_000);

    assert_eq!(
        f.client
            .try_finalize(&applicant, &Address::generate(&f.env), &Mode::Direct),
        Err(Ok(Error::QuorumNotReached))
    );
}

#[test]
fn finalize_is_idempotent_by_rejection() {
    let f = setup(2, 3);
    let applicant = Address::generate(&f.env);
    awarded(&f, &applicant, 1_000, &[1_000, 1_000]);
    assert_eq!(
        f.client
            .try_finalize(&applicant, &Address::generate(&f.env), &Mode::Direct),
        Err(Ok(Error::AlreadyFinalized))
    );
}

#[test]
fn awards_cannot_exceed_the_budget() {
    let f = setup(2, 3);
    let donor = funded_donor(&f, 1_000);
    f.client.contribute(&donor, &1_000); // budget is 900 after the 10% fee

    let a = Address::generate(&f.env);
    let b = Address::generate(&f.env);
    f.client.apply(&a, &800, &hash(&f.env, 1));
    f.client.apply(&b, &800, &hash(&f.env, 2));
    to_review(&f);
    for i in 0..2u32 {
        let r = f.reviewers.get(i).unwrap();
        f.client.review(&r, &a, &800);
        f.client.review(&r, &b, &800);
    }

    let payee = Address::generate(&f.env);
    assert_eq!(f.client.finalize(&a, &payee, &Mode::Direct).granted, 800);
    // 800 + 800 > 900: the second is refused rather than over-committing.
    assert_eq!(
        f.client.try_finalize(&b, &payee, &Mode::Direct),
        Err(Ok(Error::InsufficientBudget))
    );
    assert_eq!(f.client.total_granted(), 800);
}

#[test]
fn finalize_carries_the_payee_and_mode() {
    let f = setup(2, 3);
    let applicant = Address::generate(&f.env);
    let donor = funded_donor(&f, 10_000);
    f.client.contribute(&donor, &10_000);
    f.client.apply(&applicant, &1_000, &hash(&f.env, 1));
    to_review(&f);
    for i in 0..2u32 {
        f.client
            .review(&f.reviewers.get(i).unwrap(), &applicant, &1_000);
    }

    let school = Address::generate(&f.env);
    let award = f.client.finalize(&applicant, &school, &Mode::Direct);

    assert_eq!(
        award.payee, school,
        "Direct pays the institution, not the recipient"
    );
    assert_eq!(award.mode, Mode::Direct);
    assert_eq!(award.tranches, 3);
    assert_eq!(award.tranches_released, 0);
    assert_eq!(award.released, 0);
}

#[test]
fn finalize_still_works_after_the_review_deadline() {
    // The outcome is determined by the votes; a missed deadline must not strand
    // an applicant whose quorum was already reached.
    let f = setup(2, 3);
    let applicant = Address::generate(&f.env);
    let donor = funded_donor(&f, 10_000);
    f.client.contribute(&donor, &10_000);
    f.client.apply(&applicant, &1_000, &hash(&f.env, 1));
    to_review(&f);
    for i in 0..2u32 {
        f.client
            .review(&f.reviewers.get(i).unwrap(), &applicant, &1_000);
    }

    f.env.ledger().set_timestamp(REVIEW_DEADLINE + 1);
    assert_eq!(f.client.get_phase(), Phase::Settled);
    assert_eq!(
        f.client
            .finalize(&applicant, &Address::generate(&f.env), &Mode::Direct)
            .granted,
        1_000
    );
}

#[test]
fn unknown_applicants_cannot_be_finalized() {
    let f = setup(2, 3);
    to_review(&f);
    assert_eq!(
        f.client.try_finalize(
            &Address::generate(&f.env),
            &Address::generate(&f.env),
            &Mode::Direct
        ),
        Err(Ok(Error::ApplicationNotFound))
    );
}

// ---- cancellation ----

#[test]
fn an_empty_programme_can_be_cancelled() {
    let f = setup(2, 3);
    f.client.cancel();
    assert_eq!(f.client.get_phase(), Phase::Cancelled);

    let applicant = Address::generate(&f.env);
    assert_eq!(
        f.client.try_apply(&applicant, &100, &hash(&f.env, 1)),
        Err(Ok(Error::Cancelled))
    );
}

#[test]
fn a_funded_programme_cannot_be_cancelled() {
    // Cancelling must never be able to strand someone else's money.
    let f = setup(2, 3);
    let donor = funded_donor(&f, 1_000);
    f.client.contribute(&donor, &1_000);
    assert_eq!(f.client.try_cancel(), Err(Ok(Error::NotCancellable)));
}

#[test]
fn cancelling_twice_is_rejected() {
    let f = setup(2, 3);
    f.client.cancel();
    assert_eq!(f.client.try_cancel(), Err(Ok(Error::Cancelled)));
}
