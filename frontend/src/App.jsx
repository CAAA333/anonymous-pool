import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import './App.css'
import WalletConnection from './components/WalletConnection'
import CreateZToken from './components/CreateZToken'
import AnonymousDeposit from './components/AnonymousDeposit'
import AnonymousWithdrawal from './components/AnonymousWithdrawal'

// Pool contract address with token withdrawal support
const POOL_ADDRESS = '0xB4bc248dCE51D479b8DF381FC716B74D10DfE14D'
//'0xFAEEaBB19b6851ef9E1a943d0c545e8e0b29558c' // New pool with token support
// Old pool (no token withdrawals): 0x1ABEaa5730eA066e9F6FbD972e2Abf74B5D52AcF

function App() {
  const [account, setAccount] = useState(null)
  const [provider, setProvider] = useState(null)
  const [signer, setSigner] = useState(null)
  const [deployedTokens, setDeployedTokens] = useState([])

  useEffect(() => {
    checkWalletConnection()
    setupEventListeners()
  }, [])

  const getEthereumProvider = () => {
    // Strategy 1: Check if multiple providers are available via providers array
    if (window.ethereum?.providers && Array.isArray(window.ethereum.providers)) {
      // Look for MetaMask specifically - must have isMetaMask and NOT be Coinbase
      const metaMaskProvider = window.ethereum.providers.find(
        p => p.isMetaMask === true && !p.isCoinbaseWallet
      )
      if (metaMaskProvider) {
        return metaMaskProvider
      }
      // No MetaMask found in providers array
      return null
    }
    
    // Strategy 2: Check if window.ethereum itself is MetaMask
    // Must be MetaMask AND NOT Coinbase Wallet
    if (window.ethereum?.isMetaMask === true && !window.ethereum?.isCoinbaseWallet) {
      // Double-check it's not Coinbase masquerading
      if (window.ethereum.isCoinbaseWallet !== true) {
        return window.ethereum
      }
    }
    
    // Strategy 3: If window.ethereum exists but is Coinbase, don't use it
    // Check if MetaMask might be available through a different path
    if (window.ethereum?.isCoinbaseWallet === true) {
      // Don't use Coinbase - check if MetaMask exists elsewhere
      // Some browsers might expose MetaMask differently when Coinbase is primary
      return null
    }
    
    // Strategy 4: Final check - only return if explicitly MetaMask
    if (window.ethereum?.isMetaMask === true) {
      return window.ethereum
    }
    
    // No MetaMask found
    return null
  }

  const checkWalletConnection = async () => {
    const ethereum = getEthereumProvider()
    if (!ethereum) return

    try {
      const accounts = await ethereum.request({ method: 'eth_accounts' })
      if (accounts.length > 0) {
        const provider = new ethers.BrowserProvider(ethereum)
        const signer = await provider.getSigner()
        const network = await provider.getNetwork()
        
        // Check if we're on Sepolia (chainId: 11155111)
        if (Number(network.chainId) !== 11155111) {
          console.warn('Not on Sepolia network. Please switch to Sepolia testnet.')
        }
        
        setProvider(provider)
        setSigner(signer)
        setAccount(accounts[0])
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error)
    }
  }

  const setupEventListeners = () => {
    const ethereum = getEthereumProvider()
    if (!ethereum) return

    ethereum.on('accountsChanged', (accounts) => {
      if (accounts.length === 0) {
        setAccount(null)
        setProvider(null)
        setSigner(null)
      } else {
        checkWalletConnection()
      }
    })

    ethereum.on('chainChanged', () => {
      window.location.reload()
    })
  }

  const connectWallet = async () => {
    const ethereum = getEthereumProvider()
    
    if (!ethereum) {
      if (window.ethereum && (window.ethereum.isCoinbaseWallet || window.ethereum.providers)) {
        alert('MetaMask not detected. Please install MetaMask extension and make sure it\'s enabled.\n\nVisit https://metamask.io/ to install MetaMask.')
      } else {
        alert('Please install MetaMask! Visit https://metamask.io/')
      }
      return
    }
    
    // Double-check it's actually MetaMask
    if (!ethereum.isMetaMask) {
      alert('MetaMask not found. Please install MetaMask extension.\n\nVisit https://metamask.io/')
      return
    }

    try {
      // Request account access
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' })
      
      if (accounts.length === 0) {
        alert('Please unlock your MetaMask wallet and try again.')
        return
      }

      const provider = new ethers.BrowserProvider(ethereum)
      const network = await provider.getNetwork()
      
      // Check if we're on Sepolia
      if (Number(network.chainId) !== 11155111) {
        try {
          // Try to switch to Sepolia
          await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xaa36a7' }], // Sepolia chainId in hex
          })
        } catch (switchError) {
          // If switch fails, user might need to add the network
          if (switchError.code === 4902) {
            try {
              await ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: '0xaa36a7',
                  chainName: 'Sepolia',
                  nativeCurrency: {
                    name: 'ETH',
                    symbol: 'ETH',
                    decimals: 18
                  },
                  rpcUrls: ['https://sepolia.infura.io/v3/'],
                  blockExplorerUrls: ['https://sepolia.etherscan.io']
                }],
              })
            } catch (addError) {
              console.error('Error adding Sepolia network:', addError)
            }
          }
        }
        // Reload after network switch
        window.location.reload()
        return
      }

      const signer = await provider.getSigner()
      const address = await signer.getAddress()
      
      setProvider(provider)
      setSigner(signer)
      setAccount(address)
    } catch (error) {
      console.error('Error connecting wallet:', error)
      if (error.code === 4001) {
        alert('Please approve the connection request in MetaMask.')
      } else {
        alert(`Failed to connect wallet: ${error.message}`)
      }
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🛡️ Anonymous Pool</h1>
        <p>Create ZTokens & Make Anonymous Deposits/Withdrawals</p>
        <WalletConnection 
          account={account} 
          onConnect={connectWallet}
        />
      </header>

      <main className="app-main">
        <div className="cards-grid">
          <div className="card">
            <h2>Create ZToken</h2>
            <p>Deploy a new ERC20 token with custom parameters</p>
            <CreateZToken 
              signer={signer} 
              account={account}
              onTokenCreated={(token) => {
                setDeployedTokens([...deployedTokens, token])
              }}
            />
          </div>

          <div className="card">
            <h2>Anonymous Deposit</h2>
            <p>Make an anonymous deposit to the pool (0.001 ETH)</p>
            <AnonymousDeposit 
              signer={signer} 
              account={account} 
              poolAddress={POOL_ADDRESS}
              deployedTokens={deployedTokens}
            />
          </div>

          <div className="card">
            <h2>Anonymous Withdrawal</h2>
            <p>Withdraw your anonymous deposit using your nullifier</p>
            <AnonymousWithdrawal 
              signer={signer} 
              account={account} 
              poolAddress={POOL_ADDRESS}
              deployedTokens={deployedTokens}
            />
          </div>
        </div>
      </main>
    </div>
  )
}

export default App

