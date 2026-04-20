import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

dotenv.config();

const forkUrl = process.env.RPC_URL_MAINNET;

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
