import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

dotenv.config();

/** Mainnet HTTPS RPC used only when starting `hardhat node` (fork source). */
const forkUrl =
	process.env.FORK_URL?.trim() ||
	process.env.RPC_URL_MAINNET?.trim() ||
	undefined;

const config: HardhatUserConfig = {
	solidity: "0.8.28",
	networks: {
		hardhat: {
			// Wallets read `eth_chainId` from the node — use 1 so MetaMask treats this as Ethereum mainnet.
			chainId: 1,
			forking: forkUrl
				? {
						url: forkUrl,
						enabled: true,
					}
				: undefined,
		},
	},
};

export default config;
