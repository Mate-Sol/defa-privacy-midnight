// DeFa × Midnight — ConfidentialCreditPool contract entrypoint.
//
// Re-exports the compiled ConfidentialCreditPool artifacts + witnesses and wires
// them into a CompiledContract the API layer can deploy/join. Adapted from the
// midnightntwrk/example-bboard template.
// SPDX-License-Identifier: Apache-2.0

import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";

export * from "./managed/ConfidentialCreditPool/contract/index.js";
export * from "./witnesses";

import * as CompiledCCP from "./managed/ConfidentialCreditPool/contract/index.js";
import * as Witnesses from "./witnesses";

export const CompiledConfidentialCreditPoolContract = CompiledContract.make<
  CompiledCCP.Contract<Witnesses.ConfidentialCreditPoolPrivateState>
>(
  "ConfidentialCreditPool",
  CompiledCCP.Contract<Witnesses.ConfidentialCreditPoolPrivateState>,
).pipe(
  CompiledContract.withWitnesses(
    Witnesses.witnesses<CompiledCCP.Ledger>(),
  ),
  CompiledContract.withCompiledFileAssets("./managed/ConfidentialCreditPool"),
);
