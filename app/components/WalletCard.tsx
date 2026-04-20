"use client";

import { getDevAddEthereumChainParameter, getDevWalletRpc } from "@/lib/devNetwork";
import { PRESET_ERC20_TRANSFER_TOKENS } from "@/lib/presetTokens";
import { erc20Abi, formatUnits, isAddress, type Address } from "viem";
import { useCallback, useMemo, useState } from "react";
import {
	useBalance,
	useChainId,
	useConnect,
	useConnection,
	useConnectors,
	useDisconnect,
	useReadContract,
} from "wagmi";

const cardClass =
	"max-w-md rounded-2xl border border-zinc-200/80 bg-white p-8 shadow-xl shadow-zinc-950/[0.04] ring-1 ring-zinc-950/[0.03] dark:border-zinc-700/80 dark:bg-zinc-900 dark:shadow-black/50 dark:ring-white/[0.06]";

/** Match `ForkBlock` control buttons */
const btn =
	"rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700";

const btnSolid =
	"rounded-md border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-sm text-zinc-900 hover:bg-zinc-200 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700";

function shortenAddress(address: string) {
	return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

type EthereumRequester = {
	request: (args: { method: string; params?: unknown }) => Promise<unknown>;
};

function getInjectedProvider(): EthereumRequester | undefined {
	if (typeof window === "undefined") return undefined;
	const w = window as unknown as { ethereum?: EthereumRequester };
	return w.ethereum;
}

export function WalletCard() {
	const { address, isConnected } = useConnection();
	const chainId = useChainId();
	const connectors = useConnectors();
	const { mutate: connect, isPending, error } = useConnect();
	const { mutate: disconnect } = useDisconnect();

	const [addNetPending, setAddNetPending] = useState(false);
	const [addNetError, setAddNetError] = useState<string | null>(null);

	const [fundEth, setFundEth] = useState("10");
	const [fundToken, setFundToken] = useState("");
	const [fundMappingSlot, setFundMappingSlot] = useState("");
	const [fundPending, setFundPending] = useState(false);
	const [fundError, setFundError] = useState<string | null>(null);

	const fundTokenTrimmed = fundToken.trim();
	const fundTokenAddress = isAddress(fundTokenTrimmed)
		? fundTokenTrimmed
		: undefined;

	const nativeBalance = useBalance({
		address:
			isConnected && address && !fundTokenAddress ? address : undefined,
		query: { enabled: Boolean(isConnected && address && !fundTokenAddress) },
	});

	const erc20Enabled = Boolean(isConnected && address && fundTokenAddress);

	const { data: erc20Balance, refetch: refetchErc20Bal } = useReadContract({
		address: fundTokenAddress ? (fundTokenAddress as Address) : undefined,
		abi: erc20Abi,
		functionName: "balanceOf",
		args: address ? [address as Address] : undefined,
		query: { enabled: erc20Enabled },
	});
	const { data: erc20Decimals, refetch: refetchErc20Dec } = useReadContract({
		address: fundTokenAddress ? (fundTokenAddress as Address) : undefined,
		abi: erc20Abi,
		functionName: "decimals",
		query: { enabled: erc20Enabled },
	});
	const { data: erc20Symbol, refetch: refetchErc20Sym } = useReadContract({
		address: fundTokenAddress ? (fundTokenAddress as Address) : undefined,
		abi: erc20Abi,
		functionName: "symbol",
		query: { enabled: erc20Enabled },
	});

	const refetchBalance = useCallback(async () => {
		await Promise.all([
			nativeBalance.refetch(),
			refetchErc20Bal(),
			refetchErc20Dec(),
			refetchErc20Sym(),
		]);
	}, [
		nativeBalance.refetch,
		refetchErc20Bal,
		refetchErc20Dec,
		refetchErc20Sym,
	]);

	const balanceLine = useMemo(() => {
		if (fundTokenAddress) {
			if (
				erc20Balance === undefined ||
				erc20Decimals === undefined
			) {
				return "…";
			}
			const sym =
				typeof erc20Symbol === "string" ? erc20Symbol : "";
			return `${formatUnits(erc20Balance, erc20Decimals)} ${sym}`.trim();
		}
		const nb = nativeBalance.data;
		if (!nb) return "…";
		return `${formatUnits(nb.value, nb.decimals)} ${nb.symbol}`.trim();
	}, [
		fundTokenAddress,
		erc20Balance,
		erc20Decimals,
		erc20Symbol,
		nativeBalance.data,
	]);

	const erc20SymbolLabel =
		typeof erc20Symbol === "string" ? erc20Symbol : "tokens";

	const addDevNetwork = useCallback(async () => {
		setAddNetError(null);
		const provider = getInjectedProvider();
		if (!provider?.request) {
			setAddNetError("No injected wallet found. Install MetaMask or connect first.");
			return;
		}
		setAddNetPending(true);
		try {
			const params = getDevAddEthereumChainParameter();
			await provider.request({
				method: "wallet_addEthereumChain",
				params: [params],
			});
			await provider.request({
				method: "wallet_switchEthereumChain",
				params: [{ chainId: params.chainId }],
			});
		} catch (e) {
			const msg =
				e instanceof Error ? e.message : "Could not add or switch network.";
			setAddNetError(msg);
		} finally {
			setAddNetPending(false);
		}
	}, []);

	const fundSelf = useCallback(async () => {
		if (!address) return;
		setFundError(null);
		setFundPending(true);
		try {
			const amount = Number.parseFloat(fundEth);
			if (!Number.isFinite(amount) || amount <= 0) {
				setFundError("Enter a positive amount.");
				return;
			}
			const slotRaw = fundMappingSlot.trim();
			const slotParsed =
				slotRaw === ""
					? undefined
					: Number.parseInt(slotRaw, 10);
			const body: Record<string, unknown> = {
				address,
				amount,
			};
			if (fundTokenAddress) {
				body.token = fundTokenAddress;
				if (
					slotParsed !== undefined &&
					Number.isInteger(slotParsed) &&
					slotParsed >= 0
				) {
					body.balanceMappingSlot = slotParsed;
				}
			}
			const r = await fetch("/api/fund", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			const data = (await r.json()) as { error?: string };
			if (!r.ok) {
				throw new Error(data.error ?? "Fund failed");
			}
			await refetchBalance();
		} catch (e) {
			setFundError(e instanceof Error ? e.message : "Fund failed");
		} finally {
			setFundPending(false);
		}
	}, [address, fundEth, fundMappingSlot, fundTokenAddress, refetchBalance]);

	/** Wagmi v3: no `ready` flag like v2 — don’t filter on it. MetaMask uses id `metaMaskSDK`. */
	const metaMaskConnector = connectors.find((c) => c.type === "metaMask");
	const injectedConnector = connectors.find((c) => c.id === "injected");
	const otherConnectors = connectors.filter(
		(c) => c.type !== "metaMask" && c.id !== "injected",
	);

	return (
		<article className={cardClass}>
			<div className="space-y-4">
				<h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
					Wallet
				</h2>

				{isConnected && address ? (
					<>
						<p className="break-all font-mono text-lg text-zinc-900 dark:text-zinc-50">
							{shortenAddress(address)}
						</p>
						<p className="font-mono text-xs text-zinc-500 dark:text-zinc-500">
							Full: {address}
						</p>
						<p className="text-sm text-zinc-600 dark:text-zinc-400">
							Chain ID{" "}
							<span className="font-mono tabular-nums">{chainId}</span>
						</p>
						<p className="text-sm text-zinc-600 dark:text-zinc-400">
							Balance{" "}
							<span className="font-mono tabular-nums">{balanceLine}</span>
						</p>
						<button type="button" onClick={() => disconnect()} className={btnSolid}>
							Disconnect
						</button>
					</>
				) : (
					<>
						<p className="text-sm text-zinc-600 dark:text-zinc-400">
							Connect an injected browser wallet (e.g. MetaMask, Rabby). Add
							your local node if needed (
							<span className="font-mono text-xs">127.0.0.1:8545</span> — Hardhat
							uses chain id <span className="font-mono">1</span> like mainnet).
						</p>
						<div className="flex flex-col gap-2">
							{metaMaskConnector ? (
								<button
									type="button"
									disabled={isPending}
									onClick={() => connect({ connector: metaMaskConnector })}
									className={`w-full text-left ${btnSolid}`}
								>
									Connect MetaMask
								</button>
							) : null}
							{injectedConnector ? (
								<button
									type="button"
									disabled={isPending}
									onClick={() => connect({ connector: injectedConnector })}
									className={`w-full text-left ${metaMaskConnector ? btn : btnSolid}`}
								>
									Connect injected wallet
								</button>
							) : null}
							{otherConnectors.map((connector) => (
								<button
									key={connector.uid}
									type="button"
									disabled={isPending}
									onClick={() => connect({ connector })}
									className={`w-full text-left ${btn}`}
								>
									Connect {connector.name}
								</button>
							))}
							{connectors.length === 0 ? (
								<p className="text-sm text-amber-700 dark:text-amber-400">
									No connectors configured.
								</p>
							) : null}
						</div>
						<p className="text-xs text-zinc-500 dark:text-zinc-500">
							If a button does nothing, unlock the extension and allow this site
							(localhost).
						</p>
					</>
				)}

				{error ? (
					<p className="text-sm text-red-600 dark:text-red-400">
						{error.message}
					</p>
				) : null}

				<div className="border-t border-zinc-100 pt-4 dark:border-zinc-800" />

				<div className="space-y-3">
					<h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
						Add network
					</h3>
					<p className="text-xs text-zinc-500 dark:text-zinc-500">
						Proposes <span className="font-mono">chain id 1</span> (Ethereum) with
						RPC{" "}
						<span className="font-mono break-all">{getDevWalletRpc()}</span> to
						match Hardhat. If MetaMask already has Ethereum Mainnet, set its RPC
						to this URL instead —{" "}
						<code className="font-mono">wallet_addEthereumChain</code> may say the
						network exists.
					</p>
					<button
						type="button"
						disabled={addNetPending}
						onClick={() => void addDevNetwork()}
						className={`w-full text-left ${btnSolid}`}
					>
						{addNetPending ? "Adding…" : "Add local Ethereum (chain 1) to wallet"}
					</button>
					{addNetError ? (
						<p className="text-sm text-red-600 dark:text-red-400">
							{addNetError}
						</p>
					) : null}
				</div>

				<div className="border-t border-zinc-100 pt-4 dark:border-zinc-800" />

				<div className="space-y-3">
					<h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
						Transfer me ETH / ERC-20
					</h3>
					<p className="text-xs text-zinc-500 dark:text-zinc-500">
						Native: <code className="font-mono">hardhat_setBalance</code>. ERC-20:{" "}
						<code className="font-mono">hardhat_impersonateAccount</code> +{" "}
						<code className="font-mono">transfer</code> from a fork holder; if that
						fails, optional <code className="font-mono">hardhat_setStorageAt</code>{" "}
						(auto-detect mapping slot or set below).{" "}
						<code className="font-mono">totalSupply</code> is unchanged for storage
						funding.
					</p>
					<div className="flex flex-wrap gap-1.5">
						{PRESET_ERC20_TRANSFER_TOKENS.map((p) => (
							<button
								key={p.address}
								type="button"
								disabled={!isConnected || !address || fundPending}
								onClick={() => {
									setFundToken(p.address);
									setFundMappingSlot("");
								}}
								className={btn}
							>
								{p.label}
							</button>
						))}
					</div>
					<input
						type="text"
						placeholder="ERC-20 contract (optional, native if empty)"
						value={fundToken}
						onChange={(e) => setFundToken(e.target.value)}
						disabled={!isConnected || !address || fundPending}
						className="w-full min-w-0 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 font-mono text-xs text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
					/>
					{fundTokenAddress ? (
						<input
							type="number"
							min={0}
							step={1}
							placeholder="Balance mapping slot (only if auto/transfer fails)"
							value={fundMappingSlot}
							onChange={(e) => setFundMappingSlot(e.target.value)}
							disabled={!isConnected || !address || fundPending}
							className="w-full min-w-0 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 font-mono text-xs text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
						/>
					) : null}
					<div className="flex flex-wrap items-center gap-2">
						<input
							type="number"
							min={0.000000000000000001}
							step="any"
							value={fundEth}
							onChange={(e) => setFundEth(e.target.value)}
							disabled={!isConnected || !address || fundPending}
							className="w-28 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 font-mono text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
						/>
						<span className="text-sm text-zinc-500 dark:text-zinc-400">
							{fundTokenAddress ? erc20SymbolLabel : "ETH"}
						</span>
						<button
							type="button"
							disabled={!isConnected || !address || fundPending}
							onClick={() => void fundSelf()}
							className={btnSolid}
						>
							{fundPending ? "Sending…" : "Add to my wallet"}
						</button>
					</div>
					{fundError ? (
						<p className="text-sm text-red-600 dark:text-red-400">
							{fundError}
						</p>
					) : null}
				</div>
			</div>
		</article>
	);
}
