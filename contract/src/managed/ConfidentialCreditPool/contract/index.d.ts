import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  wit_ConfidentialTokenSK(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  wit_ConfidentialTokenEK(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  wit_PlaintextBalance(context: __compactRuntime.WitnessContext<Ledger, PS>,
                       ct_0: { c1: __compactRuntime.JubjubPoint,
                               c2: __compactRuntime.JubjubPoint
                             }): [PS, bigint];
  wit_RandomnessSeed(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  pool_callerSK(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  registerLender(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, Uint8Array>;
  deposit(context: __compactRuntime.CircuitContext<PS>,
          account_0: Uint8Array,
          amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  positionOf(context: __compactRuntime.CircuitContext<PS>, account_0: Uint8Array): __compactRuntime.CircuitResults<PS, { c1: __compactRuntime.JubjubPoint,
                                                                                                                         c2: __compactRuntime.JubjubPoint
                                                                                                                       }>;
  isLenderRegistered(context: __compactRuntime.CircuitContext<PS>,
                     account_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  sweep(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, Uint8Array>;
  pendingOf(context: __compactRuntime.CircuitContext<PS>, account_0: Uint8Array): __compactRuntime.CircuitResults<PS, { c1: __compactRuntime.JubjubPoint,
                                                                                                                        c2: __compactRuntime.JubjubPoint
                                                                                                                      }>;
  claim(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  accrueYield(context: __compactRuntime.CircuitContext<PS>,
              account_0: Uint8Array,
              yieldAmount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  pause(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  unpause(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  registerLender(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, Uint8Array>;
  deposit(context: __compactRuntime.CircuitContext<PS>,
          account_0: Uint8Array,
          amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  positionOf(context: __compactRuntime.CircuitContext<PS>, account_0: Uint8Array): __compactRuntime.CircuitResults<PS, { c1: __compactRuntime.JubjubPoint,
                                                                                                                         c2: __compactRuntime.JubjubPoint
                                                                                                                       }>;
  isLenderRegistered(context: __compactRuntime.CircuitContext<PS>,
                     account_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  sweep(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, Uint8Array>;
  pendingOf(context: __compactRuntime.CircuitContext<PS>, account_0: Uint8Array): __compactRuntime.CircuitResults<PS, { c1: __compactRuntime.JubjubPoint,
                                                                                                                        c2: __compactRuntime.JubjubPoint
                                                                                                                      }>;
  claim(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  accrueYield(context: __compactRuntime.CircuitContext<PS>,
              account_0: Uint8Array,
              yieldAmount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  pause(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  unpause(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  registerLender(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, Uint8Array>;
  deposit(context: __compactRuntime.CircuitContext<PS>,
          account_0: Uint8Array,
          amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  positionOf(context: __compactRuntime.CircuitContext<PS>, account_0: Uint8Array): __compactRuntime.CircuitResults<PS, { c1: __compactRuntime.JubjubPoint,
                                                                                                                         c2: __compactRuntime.JubjubPoint
                                                                                                                       }>;
  isLenderRegistered(context: __compactRuntime.CircuitContext<PS>,
                     account_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  sweep(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, Uint8Array>;
  pendingOf(context: __compactRuntime.CircuitContext<PS>, account_0: Uint8Array): __compactRuntime.CircuitResults<PS, { c1: __compactRuntime.JubjubPoint,
                                                                                                                        c2: __compactRuntime.JubjubPoint
                                                                                                                      }>;
  claim(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  accrueYield(context: __compactRuntime.CircuitContext<PS>,
              account_0: Uint8Array,
              yieldAmount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  pause(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  unpause(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly owner: Uint8Array;
  readonly paused: boolean;
  readonly positionCount: bigint;
  readonly yieldAccrualCount: bigint;
  readonly poolInitialized: boolean;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               name__0: string,
               symbol__0: string,
               decimals__0: bigint,
               ownerAccount_0: Uint8Array): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
