# d-EURO dev environment

Local UI plus a **Hardhat node** that can **fork Ethereum mainnet** (chain id `1` on `http://127.0.0.1:8545`).

## Setup

1. Copy `.env.example` to `.env`.
2. Set **`FORK_URL`** to an archive-capable mainnet HTTPS RPC (e.g. Alchemy/Infura). Same value as `RPC_URL_MAINNET` if you already use that name.

## Run (fork + app)

```bash
yarn install   # or npm install
yarn dev:with-chain
```

Then open [http://localhost:3040](http://localhost:3040). The Next app talks to the node via `RPC_URL` (default `http://127.0.0.1:8545`).

**`yarn dev` alone** only starts the web app; without **`yarn chain`** in another process (or `dev:with-chain`), nothing serves the fork on port 8545.

## Run (two terminals)

```bash
yarn chain    # Hardhat fork — keep running
yarn dev      # Next on port 3040
```

## Wallet

Add the local RPC in MetaMask (see in-app copy): mainnet chain id **1**, URL **`http://127.0.0.1:8545`**.
