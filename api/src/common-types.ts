// DeFa × Midnight — ConfidentialCreditPool common types.
//
// Types + abstractions for working with deployed ConfidentialCreditPool
// contracts. Adapted from the midnightntwrk/example-bboard template.
// SPDX-License-Identifier: Apache-2.0

/**
 * ConfidentialCreditPool common types and abstractions.
 *
 * @module
 */

import type { MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import type { FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import type {
  ConfidentialCreditPoolPrivateState,
  Contract,
  Witnesses,
} from '../../contract/src/index';

export const confidentialCreditPoolPrivateStateKey = 'confidentialCreditPoolPrivateState';
export type PrivateStateId = typeof confidentialCreditPoolPrivateStateKey;

/**
 * The private states consumed throughout the application, keyed by contract type.
 *
 * @public
 */
export type PrivateStates = {
  /**
   * Key used to provide the private state for {@link ConfidentialCreditPoolContract} deployments.
   */
  readonly confidentialCreditPoolPrivateState: ConfidentialCreditPoolPrivateState;
};

/**
 * Represents a ConfidentialCreditPool contract and its private state.
 *
 * @public
 */
export type ConfidentialCreditPoolContract = Contract<
  ConfidentialCreditPoolPrivateState,
  Witnesses<ConfidentialCreditPoolPrivateState>
>;

/**
 * The keys of the (impure) circuits exported from {@link ConfidentialCreditPoolContract}.
 *
 * @public
 */
export type ConfidentialCreditPoolCircuitKeys = Exclude<
  keyof ConfidentialCreditPoolContract['impureCircuits'],
  number | symbol
>;

/**
 * The providers required by {@link ConfidentialCreditPoolContract}.
 *
 * @public
 */
export type ConfidentialCreditPoolProviders = MidnightProviders<
  ConfidentialCreditPoolCircuitKeys,
  PrivateStateId,
  ConfidentialCreditPoolPrivateState
>;

/**
 * A {@link ConfidentialCreditPoolContract} that has been deployed to the network.
 *
 * @public
 */
export type DeployedConfidentialCreditPoolContract = FoundContract<ConfidentialCreditPoolContract>;

/**
 * The derived, UI-facing combination of the pool's PUBLIC (ledger) state.
 *
 * @remarks
 * Only the coarse pool-health signals are public: how many confidential
 * positions exist and how many yield-accrual events have fired. Individual
 * position amounts and holder identities are ElGamal-encrypted on-chain and are
 * never part of this derived state — a lender reads their own position via
 * {@link ConfidentialCreditPoolAPI.positionOf} and decrypts it off-chain.
 */
export type ConfidentialCreditPoolDerivedState = {
  /** Hex encoding of the on-chain owner accountId. */
  readonly owner: string;
  /** Emergency pause flag. */
  readonly paused: boolean;
  /** Number of confidential positions opened (no amounts, no identities leaked). */
  readonly positionCount: bigint;
  /** Number of confidential yield-accrual events (amounts stay encrypted). */
  readonly yieldAccrualCount: bigint;
  /** One-time pool setup guard. */
  readonly poolInitialized: boolean;
};
