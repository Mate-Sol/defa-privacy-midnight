// DeFa × Midnight — ConfidentialCreditPool API.
//
// An API for a deployed ConfidentialCreditPool: deploy/join, the lender flow
// (registerLender → deposit → claim), confidential reads (positionOf,
// isLenderRegistered), owner-gated admin (accrueYield, pause/unpause), and a
// state$ observable of the pool's PUBLIC ledger signals. Adapted from the
// midnightntwrk/example-bboard template.
// SPDX-License-Identifier: Apache-2.0

/**
 * Provides types and utilities for working with ConfidentialCreditPool contracts.
 *
 * @packageDocumentation
 */

import * as CCP from '../../contract/src/managed/ConfidentialCreditPool/contract/index.js';

import type { ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import type { Logger } from 'pino';
import {
  type ConfidentialCreditPoolDerivedState,
  type ConfidentialCreditPoolContract,
  type ConfidentialCreditPoolProviders,
  type DeployedConfidentialCreditPoolContract,
  confidentialCreditPoolPrivateStateKey,
} from './common-types.js';
import { CompiledConfidentialCreditPoolContract } from '../../contract/src/index';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { map, tap, type Observable } from 'rxjs';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import {
  ConfidentialCreditPoolPrivateState,
  type Ciphertext,
} from '../../contract/src/witnesses.js';

/** Deploy-time configuration for a new pool. */
export interface ConfidentialCreditPoolConfig {
  /** Position-token name. Default `'DeFa Confidential Position'`. */
  readonly name?: string;
  /** Position-token symbol. Default `'dLP'`. */
  readonly symbol?: string;
  /** Position-token decimals. Default `6n`. */
  readonly decimals?: bigint;
  /**
   * The pool owner's registered accountId (Bytes<32>). Owner-gated circuits
   * (accrueYield, pause/unpause) check the caller against this. Defaults to 32
   * zero bytes when omitted (fine for a register→deposit→positionOf round-trip;
   * pass a real owner accountId to exercise the admin path).
   */
  readonly ownerAccount?: Uint8Array;
  /** Seed the deployer's private state instead of generating a fresh one. */
  readonly initialPrivateState?: ConfidentialCreditPoolPrivateState;
}

/**
 * An API for a deployed ConfidentialCreditPool.
 */
export interface DeployedConfidentialCreditPoolAPI {
  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<ConfidentialCreditPoolDerivedState>;

  /** One-time: register the caller's ElGamal keys; returns their accountId. */
  registerLender: () => Promise<Uint8Array>;
  /** Mint a confidential position of `amount` to a registered `account`. */
  deposit: (account: Uint8Array, amount: bigint) => Promise<void>;
  /** Burn `amount` of the caller's own confidential position (claim liquidity). */
  claim: (amount: bigint) => Promise<void>;
  /** Owner-only: accrue confidential yield onto a lender's position. */
  accrueYield: (account: Uint8Array, yieldAmount: bigint) => Promise<void>;
  /** Read a lender's SPENDABLE confidential position as an ElGamal ciphertext. */
  positionOf: (account: Uint8Array) => Promise<Ciphertext>;
  /** Read a lender's PENDING (deposited-but-not-yet-swept) confidential position. */
  pendingOf: (account: Uint8Array) => Promise<Ciphertext>;
  /** Roll the caller's pending deposit into their spendable position; returns accountId. */
  sweep: () => Promise<Uint8Array>;
  /** Whether an account is registered to hold a confidential position. */
  isLenderRegistered: (account: Uint8Array) => Promise<boolean>;
  /** Owner-only: emergency pause. */
  pause: () => Promise<void>;
  /** Owner-only: resume. */
  unpause: () => Promise<void>;
}

/**
 * Adapts a deployed {@link DeployedConfidentialCreditPoolContract} into a
 * {@link DeployedConfidentialCreditPoolAPI}.
 *
 * @remarks
 * The `ConfidentialCreditPoolPrivateState` (the wallet's confidential SK/EK +
 * plaintext cache) is managed by the private state provider and shared across
 * API instances, keyed by contract address.
 */
export class ConfidentialCreditPoolAPI implements DeployedConfidentialCreditPoolAPI {
  /** @internal */
  private constructor(
    public readonly deployedContract: DeployedConfidentialCreditPoolContract,
    providers: ConfidentialCreditPoolProviders,
    private readonly logger?: Logger,
  ) {
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;
    providers.privateStateProvider.setContractAddress(this.deployedContractAddress);

    this.state$ = providers.publicDataProvider
      .contractStateObservable(this.deployedContractAddress, { type: 'latest' })
      .pipe(
        map((contractState) => CCP.ledger(contractState.data)),
        tap((ledgerState) =>
          logger?.trace({
            ledgerStateChanged: {
              positionCount: ledgerState.positionCount,
              yieldAccrualCount: ledgerState.yieldAccrualCount,
              paused: ledgerState.paused,
              owner: toHex(ledgerState.owner),
            },
          }),
        ),
        map(
          (ledgerState): ConfidentialCreditPoolDerivedState => ({
            owner: toHex(ledgerState.owner),
            paused: ledgerState.paused,
            positionCount: ledgerState.positionCount,
            yieldAccrualCount: ledgerState.yieldAccrualCount,
            poolInitialized: ledgerState.poolInitialized,
          }),
        ),
      );
  }

  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<ConfidentialCreditPoolDerivedState>;

  async registerLender(): Promise<Uint8Array> {
    this.logger?.info('registerLender');
    const txData = await this.deployedContract.callTx.registerLender();
    this.logger?.trace({
      transactionAdded: { circuit: 'registerLender', txHash: txData.public.txHash },
    });
    return txData.private.result;
  }

  async deposit(account: Uint8Array, amount: bigint): Promise<void> {
    this.logger?.info(`deposit: ${amount} to ${toHex(account)}`);
    const txData = await this.deployedContract.callTx.deposit(account, amount);
    this.logger?.trace({
      transactionAdded: { circuit: 'deposit', txHash: txData.public.txHash },
    });
  }

  async claim(amount: bigint): Promise<void> {
    this.logger?.info(`claim: ${amount}`);
    const txData = await this.deployedContract.callTx.claim(amount);
    this.logger?.trace({
      transactionAdded: { circuit: 'claim', txHash: txData.public.txHash },
    });
  }

  async accrueYield(account: Uint8Array, yieldAmount: bigint): Promise<void> {
    this.logger?.info(`accrueYield: ${yieldAmount} to ${toHex(account)}`);
    const txData = await this.deployedContract.callTx.accrueYield(account, yieldAmount);
    this.logger?.trace({
      transactionAdded: { circuit: 'accrueYield', txHash: txData.public.txHash },
    });
  }

  async positionOf(account: Uint8Array): Promise<Ciphertext> {
    this.logger?.info(`positionOf: ${toHex(account)}`);
    const txData = await this.deployedContract.callTx.positionOf(account);
    return txData.private.result;
  }

  async pendingOf(account: Uint8Array): Promise<Ciphertext> {
    this.logger?.info(`pendingOf: ${toHex(account)}`);
    const txData = await this.deployedContract.callTx.pendingOf(account);
    return txData.private.result;
  }

  async sweep(): Promise<Uint8Array> {
    this.logger?.info('sweep');
    const txData = await this.deployedContract.callTx.sweep();
    this.logger?.trace({
      transactionAdded: { circuit: 'sweep', txHash: txData.public.txHash },
    });
    return txData.private.result;
  }

  async isLenderRegistered(account: Uint8Array): Promise<boolean> {
    const txData = await this.deployedContract.callTx.isLenderRegistered(account);
    return txData.private.result;
  }

  async pause(): Promise<void> {
    this.logger?.info('pause');
    await this.deployedContract.callTx.pause();
  }

  async unpause(): Promise<void> {
    this.logger?.info('unpause');
    await this.deployedContract.callTx.unpause();
  }

  /**
   * Deploys a new ConfidentialCreditPool contract to the network.
   */
  static async deploy(
    providers: ConfidentialCreditPoolProviders,
    config: ConfidentialCreditPoolConfig = {},
    logger?: Logger,
  ): Promise<ConfidentialCreditPoolAPI> {
    logger?.info('deployContract');

    const deployed = await deployContract(providers, {
      compiledContract: CompiledConfidentialCreditPoolContract,
      privateStateId: confidentialCreditPoolPrivateStateKey,
      initialPrivateState: config.initialPrivateState ?? ConfidentialCreditPoolPrivateState.generate(),
      args: [
        config.name ?? 'DeFa Confidential Position',
        config.symbol ?? 'dLP',
        config.decimals ?? 6n,
        config.ownerAccount ?? new Uint8Array(32),
      ],
    });

    logger?.trace({
      contractDeployed: {
        finalizedDeployTxData: deployed.deployTxData.public,
      },
    });

    return new ConfidentialCreditPoolAPI(deployed, providers, logger);
  }

  /**
   * Finds an already-deployed ConfidentialCreditPool contract and joins it.
   */
  static async join(
    providers: ConfidentialCreditPoolProviders,
    contractAddress: ContractAddress,
    logger?: Logger,
  ): Promise<ConfidentialCreditPoolAPI> {
    logger?.info({ joinContract: { contractAddress } });

    const deployed = await findDeployedContract<ConfidentialCreditPoolContract>(providers, {
      contractAddress,
      compiledContract: CompiledConfidentialCreditPoolContract,
      privateStateId: confidentialCreditPoolPrivateStateKey,
      initialPrivateState: await ConfidentialCreditPoolAPI.getPrivateState(providers, contractAddress),
    });

    logger?.trace({
      contractJoined: {
        finalizedDeployTxData: deployed.deployTxData.public,
      },
    });

    return new ConfidentialCreditPoolAPI(deployed, providers, logger);
  }

  private static async getPrivateState(
    providers: ConfidentialCreditPoolProviders,
    contractAddress: ContractAddress,
  ): Promise<ConfidentialCreditPoolPrivateState> {
    providers.privateStateProvider.setContractAddress(contractAddress);
    const existing = await providers.privateStateProvider.get(confidentialCreditPoolPrivateStateKey);
    return existing ?? ConfidentialCreditPoolPrivateState.generate();
  }
}

/**
 * A namespace that represents the exports from the `'utils'` sub-package.
 *
 * @public
 */
export * as utils from './utils/index.js';

export * from './common-types.js';

// Re-export the private-state helper + ciphertext type so a consumer (e.g. the
// FE wallet) has a single import surface for the confidential lender flow.
export { ConfidentialCreditPoolPrivateState } from '../../contract/src/witnesses.js';
export type { Ciphertext } from '../../contract/src/witnesses.js';
