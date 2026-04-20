import type { Address } from "viem";

export type PresetErc20 = { readonly label: string; readonly address: Address };

/** Shown in Wallet “Transfer” shortcuts and fund tooling. */
export const PRESET_ERC20_TRANSFER_TOKENS: readonly PresetErc20[] = [
	{ label: "9BE8…2541", address: "0x9BE89D2a4cd102D8Fecc6BF9dA793be995C22541" },
	{ label: "kBTC", address: "0x73E0C0d45E048D25Fc26Fa3159b0aA04BfA4Db98" },
	{ label: "cbBTC", address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf" },
	{ label: "WBTC", address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" },
	{ label: "WETH", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" },
	{ label: "GOOGLx", address: "0xe92f673Ca36C5E2Efd2DE7628f815f84807e803F" },
] as const;

/** Extra tokens listed only on the Balances card (not transfer shortcuts). */
export const PRESET_ERC20_BALANCE_ONLY_TOKENS: readonly PresetErc20[] = [
	{ label: "bA3f…a3ea", address: "0xbA3f535bbCcCcA2A154b573Ca6c5A49BAAE0a3ea" },
	{ label: "1037…A380", address: "0x103747924E74708139a9400e4Ab4BEA79FFFA380" },
	{ label: "c711…8eE6", address: "0xc71104001A3CCDA1BEf1177d765831Bd1bfE8eE6" },
] as const;

/** Full preset list for balances / watch-asset (transfer + balance-only). */
export const PRESET_ERC20_TOKENS: readonly PresetErc20[] = [
	...PRESET_ERC20_TRANSFER_TOKENS,
	...PRESET_ERC20_BALANCE_ONLY_TOKENS,
];
