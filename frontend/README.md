# Anonymous Pool Frontend

A React frontend for creating ZTokens and making anonymous deposits/withdrawals.

## Features

- **Create ZToken**: Deploy custom ERC20 tokens with configurable name, symbol, and decimals
- **Anonymous Deposit**: Make anonymous deposits to the pool (0.001 ETH)
- **Anonymous Withdrawal**: Withdraw deposits using your nullifier and secret

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

## Configuration

The pool address is hardcoded in `src/App.jsx`. Update it to match your deployed contract:

```javascript
const POOL_ADDRESS = '0x1ABEaa5730eA066e9F6FbD972e2Abf74B5D52AcF'
```

## Usage

1. **Connect Wallet**: Click "Connect Wallet" to connect your MetaMask wallet
2. **Create ZToken**: Fill in token name, symbol, and decimals, then deploy
3. **Anonymous Deposit**: 
   - Click "Generate Secrets" to create a secret and nullifier
   - Save these values securely (you'll need them to withdraw)
   - Click "Deposit" to make an anonymous deposit
4. **Anonymous Withdrawal**:
   - Enter your nullifier from the deposit
   - Generate the nullifier hash
   - Enter recipient address and withdraw

## Important Notes

- ⚠️ **Save your secret and nullifier!** You need them to withdraw your deposit
- Never share your secret/nullifier with anyone
- The pool is deployed on Sepolia testnet
- Make sure you have enough ETH for gas fees

