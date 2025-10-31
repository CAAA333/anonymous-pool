import { useState } from 'react'
import { ethers } from 'ethers'
import ZTokenABI from '../artifacts/contracts/ZToken.sol/ZToken.json'

function CreateZToken({ signer, account, onTokenCreated }) {
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [decimals, setDecimals] = useState('18')
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [tokenAddress, setTokenAddress] = useState(null)

  const handleDeploy = async () => {
    if (!signer || !account) {
      setStatus({ type: 'error', message: 'Please connect your wallet first' })
      return
    }

    if (!name || !symbol || !decimals) {
      setStatus({ type: 'error', message: 'Please fill in all fields' })
      return
    }

    const decimalsNum = parseInt(decimals)
    if (isNaN(decimalsNum) || decimalsNum < 0 || decimalsNum > 18) {
      setStatus({ type: 'error', message: 'Decimals must be between 0 and 18' })
      return
    }

    setLoading(true)
    setStatus(null)

    try {
      // Deploy ZToken contract
      const factory = new ethers.ContractFactory(
        ZTokenABI.default?.abi || ZTokenABI.abi,
        ZTokenABI.default?.bytecode || ZTokenABI.bytecode,
        signer
      )

      const token = await factory.deploy(name, symbol, decimalsNum)
      setStatus({ type: 'info', message: 'Deploying contract...' })
      
      await token.waitForDeployment()
      const address = await token.getAddress()
      
      setTokenAddress(address)
      
      // Get token info
      const tokenName = await token.name()
      const tokenSymbol = await token.symbol()
      const tokenDecimals = await token.decimals()
      
      // Mint 10,000 tokens to the deployer
      setStatus({ type: 'info', message: 'Minting 10,000 tokens to your address...' })
      const mintAmount = ethers.parseUnits('10000', tokenDecimals)
      const mintTx = await token.mint(account, mintAmount)
      await mintTx.wait()
      
      // Notify parent component
      if (onTokenCreated) {
        onTokenCreated({
          address,
          name: tokenName,
          symbol: tokenSymbol,
          decimals: Number(tokenDecimals)
        })
      }
      
      setStatus({ 
        type: 'success', 
        message: `ZToken deployed successfully! 10,000 ${tokenSymbol} minted to your address. Address: ${address}` 
      })
      
      // Reset form
      setName('')
      setSymbol('')
      setDecimals('18')
    } catch (error) {
      console.error('Error deploying ZToken:', error)
      setStatus({ 
        type: 'error', 
        message: error.reason || error.message || 'Failed to deploy ZToken' 
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="input-group">
        <label>Token Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., My Token"
          disabled={loading}
        />
      </div>

      <div className="input-group">
        <label>Token Symbol</label>
        <input
          type="text"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="e.g., MTK"
          disabled={loading}
        />
      </div>

      <div className="input-group">
        <label>Decimals</label>
        <input
          type="number"
          value={decimals}
          onChange={(e) => setDecimals(e.target.value)}
          placeholder="18"
          min="0"
          max="18"
          disabled={loading}
        />
      </div>

      <button 
        className="button" 
        onClick={handleDeploy}
        disabled={loading || !signer}
      >
        {loading ? 'Deploying...' : 'Deploy ZToken'}
      </button>

      {status && (
        <div className={`status ${status.type}`}>
          {status.message}
        </div>
      )}

      {tokenAddress && (
        <div className="text-mono" style={{ marginTop: '1rem' }}>
          <strong>Token Address:</strong><br />
          {tokenAddress}
        </div>
      )}
    </div>
  )
}

export default CreateZToken

