import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}




export const Errors = {
  1: {message:"NotAuthorized"},
  2: {message:"FeeTooHigh"},
  3: {message:"NotInitialized"}
}


export interface Config {
  admin: string;
  /**
 * Attestation registry that programmes verify tranche conditions against.
 */
attest: string;
  fee_bps: u32;
  /**
 * Hash of the uploaded programme wasm that `create` instantiates.
 */
program_wasm: Buffer;
  /**
 * Standing contract that programmes credit on release.
 */
record: string;
  treasury: string;
}




/**
 * A recipient's accumulated track record.
 * 
 * Written by `record`, returned to any contract that credits it, and read by
 * programmes underwriting a repeat applicant.
 */
export interface Standing {
  first_seen: u64;
  /**
 * Hash chain over every credit, in order. Genesis is all zeroes; each
 * credit sets `root = sha256(root ‖ programme ‖ amount ‖ attestation ‖ ts)`.
 * Lets anyone verify a full off-chain history against on-chain state.
 */
history_root: Buffer;
  last_updated: u64;
  /**
 * Distinct programmes this recipient has been credited under.
 */
programmes: u32;
  subject: string;
  total_received: i128;
  /**
 * Tranches released to them, across all programmes.
 */
tranches: u32;
}


/**
 * Everything a programme is constructed from.
 * 
 * Grouped into a struct rather than passed as a dozen positional arguments —
 * at that width a caller transposing `review_deadline` and `release_deadline`,
 * or `quorum` and `tranches`, produces a valid-looking programme that behaves
 * wrongly, and the type system says nothing.
 * 
 * Lives here because the registry constructs it and the programme consumes it.
 */
export interface ProgrammeConfig {
  /**
 * Applications close here.
 */
apply_deadline: u64;
  /**
 * Attestation registry that tranche conditions are verified against.
 */
attest: string;
  creator: string;
  fee_bps: u32;
  metadata_hash: Buffer;
  /**
 * Reviewer votes needed before an application can be finalised.
 */
quorum: u32;
  /**
 * Standing contract credited on each release.
 */
record: string;
  /**
 * Tranches stop releasing here, and whatever is left becomes refundable.
 */
release_deadline: u64;
  /**
 * Reviews close here.
 */
review_deadline: u64;
  /**
 * The single schema whose attestations unlock this programme's tranches.
 */
schema: Buffer;
  /**
 * Refunds nobody claimed sweep to the treasury here.
 * 
 * Set per programme rather than fixed protocol-wide: a three-month student
 * bursary and a three-year infrastructure grant have very different ideas
 * about how long is long enough to wait for a donor to come back.
 */
sweep_deadline: u64;
  /**
 * The asset being distributed, as a Stellar Asset Contract address.
 */
token: string;
  tranches: u32;
  treasury: string;
}

export interface Client {
  /**
   * Construct and simulate a create transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Deploy a programme and authorise it to write standing.
   * 
   * Treasury and fee come from protocol configuration rather than from the
   * caller, so a creator cannot deploy a programme that pays a fee to
   * themselves or skips it entirely.
   */
  create: ({creator, token, schema, apply_deadline, review_deadline, release_deadline, sweep_deadline, quorum, tranches, metadata_hash, reviewers, verifiers, name}: {creator: string, token: string, schema: Buffer, apply_deadline: u64, review_deadline: u64, release_deadline: u64, sweep_deadline: u64, quorum: u32, tranches: u32, metadata_hash: Buffer, reviewers: Array<string>, verifiers: Array<string>, name: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a set_fee transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_fee: ({fee_bps}: {fee_bps: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_admin: ({admin}: {admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_config: (options?: MethodOptions) => Promise<AssembledTransaction<Result<Config>>>

  /**
   * Construct and simulate a is_programme transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Whether this address is a programme the registry deployed. Anything else
   * claiming to be one is not vouched for.
   */
  is_programme: ({addr}: {addr: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a set_treasury transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_treasury: ({treasury}: {treasury: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_program_wasm transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Point at a new programme wasm. Only affects programmes deployed after the
   * change — existing ones keep running the code they were deployed with,
   * which is the point of deploying rather than proxying.
   */
  set_program_wasm: ({wasm}: {wasm: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, treasury, attest, record, fee_bps, program_wasm}: {admin: string, treasury: string, attest: string, record: string, fee_bps: u32, program_wasm: Buffer},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({admin, treasury, attest, record, fee_bps, program_wasm}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAAAwAAAAAAAAANTm90QXV0aG9yaXplZAAAAAAAAAEAAAAAAAAACkZlZVRvb0hpZ2gAAAAAAAIAAAAAAAAADk5vdEluaXRpYWxpemVkAAAAAAAD",
        "AAAAAQAAAAAAAAAAAAAABkNvbmZpZwAAAAAABgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAR0F0dGVzdGF0aW9uIHJlZ2lzdHJ5IHRoYXQgcHJvZ3JhbW1lcyB2ZXJpZnkgdHJhbmNoZSBjb25kaXRpb25zIGFnYWluc3QuAAAAAAZhdHRlc3QAAAAAABMAAAAAAAAAB2ZlZV9icHMAAAAABAAAAD9IYXNoIG9mIHRoZSB1cGxvYWRlZCBwcm9ncmFtbWUgd2FzbSB0aGF0IGBjcmVhdGVgIGluc3RhbnRpYXRlcy4AAAAADHByb2dyYW1fd2FzbQAAA+4AAAAgAAAANFN0YW5kaW5nIGNvbnRyYWN0IHRoYXQgcHJvZ3JhbW1lcyBjcmVkaXQgb24gcmVsZWFzZS4AAAAGcmVjb3JkAAAAAAATAAAAAAAAAAh0cmVhc3VyeQAAABM=",
        "AAAAAAAAAOFEZXBsb3kgYSBwcm9ncmFtbWUgYW5kIGF1dGhvcmlzZSBpdCB0byB3cml0ZSBzdGFuZGluZy4KClRyZWFzdXJ5IGFuZCBmZWUgY29tZSBmcm9tIHByb3RvY29sIGNvbmZpZ3VyYXRpb24gcmF0aGVyIHRoYW4gZnJvbSB0aGUKY2FsbGVyLCBzbyBhIGNyZWF0b3IgY2Fubm90IGRlcGxveSBhIHByb2dyYW1tZSB0aGF0IHBheXMgYSBmZWUgdG8KdGhlbXNlbHZlcyBvciBza2lwcyBpdCBlbnRpcmVseS4AAAAAAAAGY3JlYXRlAAAAAAANAAAAAAAAAAdjcmVhdG9yAAAAABMAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAAGc2NoZW1hAAAAAAPuAAAAIAAAAAAAAAAOYXBwbHlfZGVhZGxpbmUAAAAAAAYAAAAAAAAAD3Jldmlld19kZWFkbGluZQAAAAAGAAAAAAAAABByZWxlYXNlX2RlYWRsaW5lAAAABgAAAAAAAAAOc3dlZXBfZGVhZGxpbmUAAAAAAAYAAAAAAAAABnF1b3J1bQAAAAAABAAAAAAAAAAIdHJhbmNoZXMAAAAEAAAAAAAAAA1tZXRhZGF0YV9oYXNoAAAAAAAD7gAAACAAAAAAAAAACXJldmlld2VycwAAAAAAA+oAAAATAAAAAAAAAAl2ZXJpZmllcnMAAAAAAAPqAAAAEwAAAAAAAAAEbmFtZQAAABAAAAABAAAD6QAAABMAAAAD",
        "AAAAAAAAAAAAAAAHc2V0X2ZlZQAAAAABAAAAAAAAAAdmZWVfYnBzAAAAAAQAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAAJc2V0X2FkbWluAAAAAAAAAQAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAAAAAAAKZ2V0X2NvbmZpZwAAAAAAAAAAAAEAAAPpAAAH0AAAAAZDb25maWcAAAAAAAM=",
        "AAAAAAAAAG9XaGV0aGVyIHRoaXMgYWRkcmVzcyBpcyBhIHByb2dyYW1tZSB0aGUgcmVnaXN0cnkgZGVwbG95ZWQuIEFueXRoaW5nIGVsc2UKY2xhaW1pbmcgdG8gYmUgb25lIGlzIG5vdCB2b3VjaGVkIGZvci4AAAAADGlzX3Byb2dyYW1tZQAAAAEAAAAAAAAABGFkZHIAAAATAAAAAQAAAAE=",
        "AAAAAAAAAAAAAAAMc2V0X3RyZWFzdXJ5AAAAAQAAAAAAAAAIdHJlYXN1cnkAAAATAAAAAQAAA+kAAAACAAAAAw==",
        "AAAABQAAAAAAAAAAAAAADUNvbmZpZ0NoYW5nZWQAAAAAAAABAAAABmNvbmZpZwAAAAAAAQAAAAAAAAAGY29uZmlnAAAAAAfQAAAABkNvbmZpZwAAAAAAAAAAAAA=",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAYAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAIdHJlYXN1cnkAAAATAAAAAAAAAAZhdHRlc3QAAAAAABMAAAAAAAAABnJlY29yZAAAAAAAEwAAAAAAAAAHZmVlX2JwcwAAAAAEAAAAAAAAAAxwcm9ncmFtX3dhc20AAAPuAAAAIAAAAAEAAAPpAAAAAgAAAAM=",
        "AAAABQAAAAAAAAAAAAAAEFByb2dyYW1tZUNyZWF0ZWQAAAABAAAAB2NyZWF0ZWQAAAAAAwAAAAAAAAAJcHJvZ3JhbW1lAAAAAAAAEwAAAAEAAAAAAAAAB2NyZWF0b3IAAAAAEwAAAAEAAAAAAAAABG5hbWUAAAAQAAAAAAAAAAA=",
        "AAAAAAAAAMdQb2ludCBhdCBhIG5ldyBwcm9ncmFtbWUgd2FzbS4gT25seSBhZmZlY3RzIHByb2dyYW1tZXMgZGVwbG95ZWQgYWZ0ZXIgdGhlCmNoYW5nZSDigJQgZXhpc3Rpbmcgb25lcyBrZWVwIHJ1bm5pbmcgdGhlIGNvZGUgdGhleSB3ZXJlIGRlcGxveWVkIHdpdGgsCndoaWNoIGlzIHRoZSBwb2ludCBvZiBkZXBsb3lpbmcgcmF0aGVyIHRoYW4gcHJveHlpbmcuAAAAABBzZXRfcHJvZ3JhbV93YXNtAAAAAQAAAAAAAAAEd2FzbQAAA+4AAAAgAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAQAAAJ9BIHJlY2lwaWVudCdzIGFjY3VtdWxhdGVkIHRyYWNrIHJlY29yZC4KCldyaXR0ZW4gYnkgYHJlY29yZGAsIHJldHVybmVkIHRvIGFueSBjb250cmFjdCB0aGF0IGNyZWRpdHMgaXQsIGFuZCByZWFkIGJ5CnByb2dyYW1tZXMgdW5kZXJ3cml0aW5nIGEgcmVwZWF0IGFwcGxpY2FudC4AAAAAAAAAAAhTdGFuZGluZwAAAAcAAAAAAAAACmZpcnN0X3NlZW4AAAAAAAYAAADaSGFzaCBjaGFpbiBvdmVyIGV2ZXJ5IGNyZWRpdCwgaW4gb3JkZXIuIEdlbmVzaXMgaXMgYWxsIHplcm9lczsgZWFjaApjcmVkaXQgc2V0cyBgcm9vdCA9IHNoYTI1Nihyb290IOKAliBwcm9ncmFtbWUg4oCWIGFtb3VudCDigJYgYXR0ZXN0YXRpb24g4oCWIHRzKWAuCkxldHMgYW55b25lIHZlcmlmeSBhIGZ1bGwgb2ZmLWNoYWluIGhpc3RvcnkgYWdhaW5zdCBvbi1jaGFpbiBzdGF0ZS4AAAAAAAxoaXN0b3J5X3Jvb3QAAAPuAAAAIAAAAAAAAAAMbGFzdF91cGRhdGVkAAAABgAAADtEaXN0aW5jdCBwcm9ncmFtbWVzIHRoaXMgcmVjaXBpZW50IGhhcyBiZWVuIGNyZWRpdGVkIHVuZGVyLgAAAAAKcHJvZ3JhbW1lcwAAAAAABAAAAAAAAAAHc3ViamVjdAAAAAATAAAAAAAAAA50b3RhbF9yZWNlaXZlZAAAAAAACwAAADFUcmFuY2hlcyByZWxlYXNlZCB0byB0aGVtLCBhY3Jvc3MgYWxsIHByb2dyYW1tZXMuAAAAAAAACHRyYW5jaGVzAAAABA==",
        "AAAAAQAAAYtFdmVyeXRoaW5nIGEgcHJvZ3JhbW1lIGlzIGNvbnN0cnVjdGVkIGZyb20uCgpHcm91cGVkIGludG8gYSBzdHJ1Y3QgcmF0aGVyIHRoYW4gcGFzc2VkIGFzIGEgZG96ZW4gcG9zaXRpb25hbCBhcmd1bWVudHMg4oCUCmF0IHRoYXQgd2lkdGggYSBjYWxsZXIgdHJhbnNwb3NpbmcgYHJldmlld19kZWFkbGluZWAgYW5kIGByZWxlYXNlX2RlYWRsaW5lYCwKb3IgYHF1b3J1bWAgYW5kIGB0cmFuY2hlc2AsIHByb2R1Y2VzIGEgdmFsaWQtbG9va2luZyBwcm9ncmFtbWUgdGhhdCBiZWhhdmVzCndyb25nbHksIGFuZCB0aGUgdHlwZSBzeXN0ZW0gc2F5cyBub3RoaW5nLgoKTGl2ZXMgaGVyZSBiZWNhdXNlIHRoZSByZWdpc3RyeSBjb25zdHJ1Y3RzIGl0IGFuZCB0aGUgcHJvZ3JhbW1lIGNvbnN1bWVzIGl0LgAAAAAAAAAAD1Byb2dyYW1tZUNvbmZpZwAAAAAOAAAAGEFwcGxpY2F0aW9ucyBjbG9zZSBoZXJlLgAAAA5hcHBseV9kZWFkbGluZQAAAAAABgAAAEJBdHRlc3RhdGlvbiByZWdpc3RyeSB0aGF0IHRyYW5jaGUgY29uZGl0aW9ucyBhcmUgdmVyaWZpZWQgYWdhaW5zdC4AAAAAAAZhdHRlc3QAAAAAABMAAAAAAAAAB2NyZWF0b3IAAAAAEwAAAAAAAAAHZmVlX2JwcwAAAAAEAAAAAAAAAA1tZXRhZGF0YV9oYXNoAAAAAAAD7gAAACAAAAA9UmV2aWV3ZXIgdm90ZXMgbmVlZGVkIGJlZm9yZSBhbiBhcHBsaWNhdGlvbiBjYW4gYmUgZmluYWxpc2VkLgAAAAAAAAZxdW9ydW0AAAAAAAQAAAArU3RhbmRpbmcgY29udHJhY3QgY3JlZGl0ZWQgb24gZWFjaCByZWxlYXNlLgAAAAAGcmVjb3JkAAAAAAATAAAARlRyYW5jaGVzIHN0b3AgcmVsZWFzaW5nIGhlcmUsIGFuZCB3aGF0ZXZlciBpcyBsZWZ0IGJlY29tZXMgcmVmdW5kYWJsZS4AAAAAABByZWxlYXNlX2RlYWRsaW5lAAAABgAAABNSZXZpZXdzIGNsb3NlIGhlcmUuAAAAAA9yZXZpZXdfZGVhZGxpbmUAAAAABgAAAEZUaGUgc2luZ2xlIHNjaGVtYSB3aG9zZSBhdHRlc3RhdGlvbnMgdW5sb2NrIHRoaXMgcHJvZ3JhbW1lJ3MgdHJhbmNoZXMuAAAAAAAGc2NoZW1hAAAAAAPuAAAAIAAAAQRSZWZ1bmRzIG5vYm9keSBjbGFpbWVkIHN3ZWVwIHRvIHRoZSB0cmVhc3VyeSBoZXJlLgoKU2V0IHBlciBwcm9ncmFtbWUgcmF0aGVyIHRoYW4gZml4ZWQgcHJvdG9jb2wtd2lkZTogYSB0aHJlZS1tb250aCBzdHVkZW50CmJ1cnNhcnkgYW5kIGEgdGhyZWUteWVhciBpbmZyYXN0cnVjdHVyZSBncmFudCBoYXZlIHZlcnkgZGlmZmVyZW50IGlkZWFzCmFib3V0IGhvdyBsb25nIGlzIGxvbmcgZW5vdWdoIHRvIHdhaXQgZm9yIGEgZG9ub3IgdG8gY29tZSBiYWNrLgAAAA5zd2VlcF9kZWFkbGluZQAAAAAABgAAAEFUaGUgYXNzZXQgYmVpbmcgZGlzdHJpYnV0ZWQsIGFzIGEgU3RlbGxhciBBc3NldCBDb250cmFjdCBhZGRyZXNzLgAAAAAAAAV0b2tlbgAAAAAAABMAAAAAAAAACHRyYW5jaGVzAAAABAAAAAAAAAAIdHJlYXN1cnkAAAAT" ]),
      options
    )
  }
  public readonly fromJSON = {
    create: this.txFromJSON<Result<string>>,
        set_fee: this.txFromJSON<Result<void>>,
        set_admin: this.txFromJSON<Result<void>>,
        get_config: this.txFromJSON<Result<Config>>,
        is_programme: this.txFromJSON<boolean>,
        set_treasury: this.txFromJSON<Result<void>>,
        set_program_wasm: this.txFromJSON<Result<void>>
  }
}