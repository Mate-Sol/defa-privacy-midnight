// Witnesses for ConfidentialCreditPool.
//
// These supply the private, off-chain state the confidential circuits need:
// the lender's account secret (SK), their ElGamal encryption secret (EK), a
// plaintext cache so the wallet can answer "what does this ciphertext decrypt
// to?", and a randomness seed for encryption. The pool adds `pool_callerSK`,
// which MUST return the same SK as `wit_ConfidentialTokenSK` (owner-gating
// derives the caller's accountId from it and compares to the on-chain owner).
//
// Adapted from OpenZeppelin's reference ConfidentialFungibleToken witnesses.
// SECURITY: the OZ reference ships a FIXED randomness seed for reproducible
// tests, which destroys confidentiality (a known seed lets an observer strip
// the ElGamal mask and read amounts). We instead generate a cryptographically
// random seed per wallet session. For maximum confidentiality a production
// wallet should rotate the seed per circuit invocation; a per-session seed is
// the pragmatic Wave-1 choice and keeps balances/allowances/supply sound.

import { getRandomValues } from 'node:crypto';
import type {
  JubjubPoint,
  WitnessContext,
} from '@midnight-ntwrk/compact-runtime';
import { ecMulGenerator } from '@midnight-ntwrk/compact-runtime';

export type Ciphertext = {
  c1: JubjubPoint;
  c2: JubjubPoint;
};

function serializeCiphertext(ct: Ciphertext): string {
  return `${ct.c1.x.toString(16)}:${ct.c1.y.toString(16)}:${ct.c2.x.toString(16)}:${ct.c2.y.toString(16)}`;
}

// encryptZero() = (identity, identity); a wallet knows it decrypts to 0 without
// a cache entry. Read on freshly-created (zero) balance/escrow slots.
const ZERO_CIPHERTEXT_KEY: string = (() => {
  const identity = ecMulGenerator(0n) as JubjubPoint;
  return serializeCiphertext({ c1: identity, c2: identity });
})();

/** Private state for a ConfidentialCreditPool lender/admin wallet. */
export type ConfidentialCreditPoolPrivateState = {
  /** 32-byte account secret. Derives the on-chain accountId (persistentHash(SK)). */
  secretKey: Uint8Array;
  /** 32-byte ElGamal encryption secret. Derives the encryption pk. */
  encryptionKey: Uint8Array;
  /** Cached plaintexts, keyed by canonical ciphertext serialization. */
  plaintextCache: Map<string, bigint>;
  /** 32-byte randomness seed for ElGamal encryption. */
  randomnessSeed: Uint8Array;
};

export const ConfidentialCreditPoolPrivateState = {
  /** Fresh wallet: random SK, EK, and a RANDOM seed (real confidentiality). */
  generate: (): ConfidentialCreditPoolPrivateState => ({
    secretKey: new Uint8Array(getRandomValues(Buffer.alloc(32))),
    encryptionKey: new Uint8Array(getRandomValues(Buffer.alloc(32))),
    plaintextCache: new Map(),
    randomnessSeed: new Uint8Array(getRandomValues(Buffer.alloc(32))),
  }),

  /** Deterministic construction from supplied secrets (tests / key import). */
  withSecrets: (
    sk: Uint8Array,
    ek: Uint8Array,
    randomnessSeed?: Uint8Array,
  ): ConfidentialCreditPoolPrivateState => ({
    secretKey: sk,
    encryptionKey: ek,
    plaintextCache: new Map(),
    randomnessSeed:
      randomnessSeed ?? new Uint8Array(getRandomValues(Buffer.alloc(32))),
  }),

  /** Record a known plaintext for a ciphertext (on send/receive). */
  cachePlaintext: (
    state: ConfidentialCreditPoolPrivateState,
    ct: Ciphertext,
    plaintext: bigint,
  ): ConfidentialCreditPoolPrivateState => {
    const newCache = new Map(state.plaintextCache);
    newCache.set(serializeCiphertext(ct), plaintext);
    return { ...state, plaintextCache: newCache };
  },

  lookupPlaintext: (
    state: ConfidentialCreditPoolPrivateState,
    ct: Ciphertext,
  ): bigint | undefined => state.plaintextCache.get(serializeCiphertext(ct)),
};

/** Witness factory for ConfidentialCreditPool circuits. */
export const witnesses = <L>() => ({
  wit_ConfidentialTokenSK(
    context: WitnessContext<L, ConfidentialCreditPoolPrivateState>,
  ): [ConfidentialCreditPoolPrivateState, Uint8Array] {
    return [context.privateState, context.privateState.secretKey];
  },

  wit_ConfidentialTokenEK(
    context: WitnessContext<L, ConfidentialCreditPoolPrivateState>,
  ): [ConfidentialCreditPoolPrivateState, Uint8Array] {
    return [context.privateState, context.privateState.encryptionKey];
  },

  wit_PlaintextBalance(
    context: WitnessContext<L, ConfidentialCreditPoolPrivateState>,
    ct: Ciphertext,
  ): [ConfidentialCreditPoolPrivateState, bigint] {
    if (serializeCiphertext(ct) === ZERO_CIPHERTEXT_KEY) {
      return [context.privateState, 0n];
    }
    const plaintext = ConfidentialCreditPoolPrivateState.lookupPlaintext(
      context.privateState,
      ct,
    );
    if (plaintext === undefined) {
      throw new Error(
        `wit_PlaintextBalance: no cached plaintext for ciphertext ${serializeCiphertext(ct)}. ` +
          'The wallet must cache plaintexts for every ciphertext the contract may query.',
      );
    }
    return [context.privateState, plaintext];
  },

  wit_RandomnessSeed(
    context: WitnessContext<L, ConfidentialCreditPoolPrivateState>,
  ): [ConfidentialCreditPoolPrivateState, Uint8Array] {
    return [context.privateState, context.privateState.randomnessSeed];
  },

  // Pool-specific: owner-gating derives accountId from this. MUST match the SK
  // returned by wit_ConfidentialTokenSK.
  pool_callerSK(
    context: WitnessContext<L, ConfidentialCreditPoolPrivateState>,
  ): [ConfidentialCreditPoolPrivateState, Uint8Array] {
    return [context.privateState, context.privateState.secretKey];
  },
});
