import React from "react";
import midnightIcon from "@/assets/multiChain-ui/midnight-icon.png";

// Single-chain deploy — every consumer of chainOptions and getChainIcon
// (MainHeader dropdowns, PoolList header pill, PoolDetails header,
// chainSlice default) surfaces Midnight and only Midnight. The legacy
// Arc / Stellar / Stark Net / Zig Chain entries are gone in this build.
const chainMap = {
  midnight: { label: "Midnight", src: midnightIcon },
};

/**
 * getChainIcon — returns the icon element for a given blockchain type.
 * Any legacy key ("arc", "stellar", "starknet", "zigchain", "evm") falls
 * back to the Midnight icon so old mock rows still render an icon rather
 * than breaking the layout.
 */
export function getChainIcon(bcType, size = 16) {
  const chain = chainMap[bcType?.toLowerCase()] || chainMap.midnight;
  return <img src={chain.src} alt={chain.label} width={size} height={size} />;
}

/** chainOptions — list of chains for dropdowns etc. Single entry. */
export const chainOptions = Object.entries(chainMap).map(([key, val]) => ({
  key,
  label: val.label,
}));
