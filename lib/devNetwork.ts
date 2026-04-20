import { type AddEthereumChainParameter, numberToHex } from "viem";

/** Matches `hardhat.config.ts` `networks.hardhat.chainId` (mainnet = 1). */
export const DEV_CHAIN_ID = 1;

export function getDevWalletRpc(): string {
	if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_WALLET_RPC_URL) {
		return process.env.NEXT_PUBLIC_WALLET_RPC_URL;
	}
	return "http://127.0.0.1:8545";
}

/** Params for `wallet_addEthereumChain` — same chain id as the local Hardhat node. */
export function getDevAddEthereumChainParameter(): AddEthereumChainParameter {
	return {
		chainId: numberToHex(DEV_CHAIN_ID),
		chainName: "Ethereum",
		nativeCurrency: {
			decimals: 18,
			name: "Ether",
			symbol: "ETH",
		},
		rpcUrls: [getDevWalletRpc()],
	};
}
