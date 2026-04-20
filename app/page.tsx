import { BalancesCard } from "./components/BalancesCard";
import { ForkBlock } from "./components/ForkBlock";
import { WalletCard } from "./components/WalletCard";

export default function Home() {
	return (
		<div className="flex min-h-full flex-col items-center gap-8 p-8 pt-12 sm:flex-row sm:flex-wrap sm:items-start sm:justify-center sm:pt-16">
			<ForkBlock />
			<WalletCard />
			<BalancesCard />
		</div>
	);
}
