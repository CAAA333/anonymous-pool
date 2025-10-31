# Anonymous Pool

A privacy-preserving pool for making anonymous deposits and withdrawals on Ethereum. Deposit ETH or custom tokens, and later withdraw them without revealing your identity or transaction history.

## How It Works

The Anonymous Pool enables private transactions using:

1. **Commitments**: When you deposit, you create a commitment (hash of a secret + nullifier) that gets added to a Merkle tree. Your identity and deposit amount are hidden.

2. **Nullifiers**: When you withdraw, you use your nullifier to prove you made a deposit without revealing which one. Each nullifier can only be used once, preventing double-spending.

3. **Merkle Tree**: All commitments are stored in a Merkle tree, making it impossible to link deposits to withdrawals while maintaining cryptographic proof of deposits.

## Quick Start

### Prerequisites

- Node.js 18+
- MetaMask or compatible Web3 wallet
- Sepolia testnet ETH (for testing)

### Installation

1. **Clone and install dependencies:**
```bash
npm install
cd frontend && npm install && cd ..
```

2. **Set up environment variables** (create `.env` file):
```env
ALCHEMY_SEPOLIA_URL=your_alchemy_sepolia_url
SEPOLIA_PRIVATE_KEY=your_private_key
ETHERSCAN_KEY=your_etherscan_api_key  # Optional, for contract verification
```

3. **Compile contracts:**
```bash
npm run compile
```

4. **Deploy to Sepolia** (optional - pool may already be deployed):
```bash
npm run deploy:pool
```

Update `POOL_ADDRESS` in `frontend/src/App.jsx` with the deployed address.

5. **Start the frontend:**
```bash
cd frontend
npm run dev
```

Visit `http://localhost:3000` in your browser.

## Making Anonymous Deposits and Withdrawals

### Step 1: Connect Your Wallet

1. Open the frontend in your browser
2. Click "Connect Wallet" and select MetaMask
3. Switch to Sepolia network if prompted

### Step 2: Make an Anonymous Deposit

**Option A: Deposit ETH**

1. Go to the "Anonymous Deposit" section
2. Click "Generate Commitment" to create your secret and nullifier
3. **IMPORTANT**: Save your Secret and Nullifier values - you'll need them to withdraw!
4. Click "Deposit ETH" and confirm the transaction

**Option B: Deposit a ZToken (Custom Token)**

1. First, create a ZToken in the "Create ZToken" section (10,000 tokens will be minted to your address)
2. Go to "Anonymous Deposit"
3. Select your ZToken from the dropdown
4. Approve the token (first time only)
5. Generate a commitment and save your Secret/Nullifier
6. Click "Deposit ZToken" and confirm

### Step 3: Make an Anonymous Withdrawal

1. Go to the "Anonymous Withdrawal" section
2. Enter your saved **Nullifier** value
3. Select withdrawal type (ETH or Token)
4. If withdrawing a token, select the token and enter amount
5. Click "Generate Nullifier Hash" to create the withdrawal proof
6. Enter your saved **Secret** to generate the commitment
7. Click "Withdraw" and confirm

**Important Notes:**
- You can withdraw to any address (yourself or someone else)
- Your nullifier can only be used once per deposit
- You must have a valid commitment in the Merkle tree
- Each deposit has its own unique secret and nullifier pair

## Architecture

### Smart Contracts

- **AnonymousPool.sol**: Main pool contract handling deposits and withdrawals
- **ZToken.sol**: Custom ERC20 token with minting/burning capabilities
- **IncrementalMerkleTree.sol**: Merkle tree implementation for commitment storage
- **SimplifiedPoseidon.sol**: ZK-friendly hash function for commitments

### Frontend

- React + Vite application
- Ethers.js for Web3 interactions
- Wallet connection via MetaMask
- Real-time pool statistics and balance tracking

## Testing

Run Solidity contract tests:
```bash
npm test
```

Run frontend tests:
```bash
cd frontend && npm test
```

## Security Considerations

⚠️ **Important Security Notes:**

- This is a **simplified version for testing**. Production deployment requires:
  - ZK proof verification (currently simplified for testing)
  - Additional security audits
  - Proper secret management
  
- **Never share your secret and nullifier values** - anyone with these can withdraw your deposit

- Always verify you're on the correct network (Sepolia for testing)

- Keep backups of your secrets and nullifiers in a secure location

## Project Structure

```
anonymous-pool1/
├── contracts/          # Solidity smart contracts
├── test/              # Solidity tests (.t.sol files)
├── scripts/           # Deployment scripts
├── frontend/          # React frontend application
│   ├── src/
│   │   ├── components/  # React components
│   │   └── artifacts/   # Contract ABIs
│   └── package.json
└── hardhat.config.js  # Hardhat configuration
```

## License

MIT
