import { createConfig, http, injected } from "wagmi";
import { mainnet } from "wagmi/chains";
import { metaMask } from "wagmi/connectors";
import { getDevWalletRpc } from "./devNetwork";

const walletRpc = getDevWalletRpc();

/** Single chain: mainnet (id 1) with JSON-RPC pointing at the local Hardhat node. */
export const wagmiConfig = createConfig({
	chains: [mainnet],
	connectors: [metaMask(), injected()],
	transports: {
		[mainnet.id]: http(walletRpc),
	},
	ssr: false,
});
