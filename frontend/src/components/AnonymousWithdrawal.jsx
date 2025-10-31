import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import AnonymousPoolABI from '../artifacts/contracts/AnonymousPool.sol/AnonymousPool.json'
import ZTokenABI from '../artifacts/contracts/ZToken.sol/ZToken.json'

function AnonymousWithdrawal({ signer, account, poolAddress, deployedTokens }) {
  const [nullifier, setNullifier] = useState('')
  const [nullifierHash, setNullifierHash] = useState('')
  const [recipient, setRecipient] = useState('')
  const [root, setRoot] = useState('')
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [withdrawalInfo, setWithdrawalInfo] = useState(null)
  const [poolStats, setPoolStats] = useState(null)
  const [withdrawalType, setWithdrawalType] = useState('ETH') // 'ETH' or 'TOKEN'
  const [selectedToken, setSelectedToken] = useState(null)
  const [tokenAmount, setTokenAmount] = useState('')
  const [tokenDecimals, setTokenDecimals] = useState(18)

  useEffect(() => {
    if (account) {
      setRecipient(account)
    }
    loadPoolStats()
  }, [account, poolAddress, signer])

  const loadPoolStats = async () => {
    if (!poolAddress) return

    try {
      // Use signer if available, otherwise create a read-only provider
      let contractProvider = signer
      if (!contractProvider) {
        // Prioritize MetaMask for read-only calls
        let ethereum = null
        if (window.ethereum?.providers && Array.isArray(window.ethereum.providers)) {
          ethereum = window.ethereum.providers.find(p => p.isMetaMask)
        } else if (window.ethereum?.isMetaMask) {
          ethereum = window.ethereum
        }
        
        if (ethereum) {
          contractProvider = new ethers.BrowserProvider(ethereum)
        }
      }

      if (!contractProvider) {
        console.warn('No provider available for loading pool stats')
        return
      }

      const pool = new ethers.Contract(
        poolAddress, 
        AnonymousPoolABI.default?.abi || AnonymousPoolABI.abi, 
        contractProvider
      )
      const stats = await pool.getStats()
      const latestRoot = await pool.getLatestRoot()
      
      setPoolStats({
        balance: ethers.formatEther(stats.poolBalance),
        deposits: stats.deposits.toString(),
        withdrawals: stats.withdrawals.toString(),
        anonymitySet: stats.anonymitySet.toString()
      })
      
      setRoot(latestRoot)
    } catch (error) {
      console.error('Error loading pool stats:', error)
      setStatus({ type: 'error', message: 'Failed to load pool stats. Make sure you\'re on Sepolia network.' })
    }
  }

  const handleGenerateNullifierHash = async () => {
    if (!nullifier || !poolAddress) {
      setStatus({ type: 'error', message: 'Please enter a nullifier' })
      return
    }

    try {
      // Use signer if available, otherwise create a read-only provider
      let contractProvider = signer
      if (!contractProvider) {
        // Prioritize MetaMask for read-only calls
        let ethereum = null
        if (window.ethereum?.providers && Array.isArray(window.ethereum.providers)) {
          ethereum = window.ethereum.providers.find(p => p.isMetaMask)
        } else if (window.ethereum?.isMetaMask) {
          ethereum = window.ethereum
        }
        
        if (ethereum) {
          contractProvider = new ethers.BrowserProvider(ethereum)
        } else {
          setStatus({ type: 'error', message: 'Please connect MetaMask wallet' })
          return
        }
      }

      const pool = new ethers.Contract(
        poolAddress, 
        AnonymousPoolABI.default?.abi || AnonymousPoolABI.abi, 
        contractProvider
      )
      setStatus({ type: 'info', message: 'Generating nullifier hash...' })
      const hash = await pool.generateNullifierHash(nullifier)
      setNullifierHash(hash)
      setStatus({ type: 'success', message: 'Nullifier hash generated!' })
    } catch (error) {
      console.error('Error generating nullifier hash:', error)
      const errorMsg = error.reason || error.message || 'Failed to generate nullifier hash'
      setStatus({ type: 'error', message: errorMsg })
    }
  }

  const handleWithdraw = async () => {
    if (!signer || !account) {
      setStatus({ type: 'error', message: 'Please connect your wallet first' })
      return
    }

    if (!nullifierHash) {
      setStatus({ type: 'error', message: 'Please generate nullifier hash first' })
      return
    }

    if (!recipient || !ethers.isAddress(recipient)) {
      setStatus({ type: 'error', message: 'Please enter a valid recipient address' })
      return
    }

    if (!root) {
      setStatus({ type: 'error', message: 'Please load the latest root first' })
      return
    }

    setLoading(true)
    setStatus(null)

    try {
      const pool = new ethers.Contract(
        poolAddress, 
        AnonymousPoolABI.default?.abi || AnonymousPoolABI.abi, 
        signer
      )
      
      let tx
      let receipt
      
      if (withdrawalType === 'TOKEN') {
        // For token withdrawals, the pool contract doesn't support token withdrawals
        // We'll need to either modify the pool contract or use a workaround
        // For now, we'll verify the nullifier and note that tokens need manual recovery
        
        if (!selectedToken || !tokenAmount) {
          setStatus({ type: 'error', message: 'Please select token and enter amount for token withdrawal' })
          setLoading(false)
          return
        }

        // Check pool balance first
        const token = new ethers.Contract(
          selectedToken.address,
          ZTokenABI.default?.abi || ZTokenABI.abi,
          signer
        )
        
        const amount = ethers.parseUnits(tokenAmount, selectedToken.decimals)
        const poolBalance = await token.balanceOf(poolAddress)
        
        if (poolBalance < amount) {
          setStatus({ type: 'error', message: `Pool doesn't have enough tokens. Pool balance: ${ethers.formatUnits(poolBalance, selectedToken.decimals)} ${selectedToken.symbol}` })
          setLoading(false)
          return
        }

        // Check if nullifier is already used
        const isUsed = await pool.nullifierHashes(nullifierHash)
        if (isUsed) {
          setStatus({ type: 'error', message: 'This nullifier has already been used. Each deposit can only be withdrawn once.' })
          setLoading(false)
          return
        }

        // Try to withdraw tokens using withdrawTokens function
        setStatus({ type: 'info', message: 'Checking contract function...' })
        
        // First verify the function exists in the ABI
        const contractInterface = new ethers.Interface(AnonymousPoolABI.default?.abi || AnonymousPoolABI.abi)
        const hasFunction = contractInterface.hasFunction('withdrawTokens')
        
        if (!hasFunction) {
          setStatus({ 
            type: 'error', 
            message: `The pool contract ABI doesn't include withdrawTokens function. Please refresh the page or update the ABI file.` 
          })
          setLoading(false)
          return
        }
        
        setStatus({ type: 'info', message: 'Withdrawing tokens...' })
        
        try {
          // Try to call withdrawTokens function
          tx = await pool.withdrawTokens(
            nullifierHash,
            recipient,
            root,
            selectedToken.address,
            amount
          )
          
          setStatus({ type: 'info', message: 'Transaction pending...' })
          
          receipt = await tx.wait()
          
          // Try to parse token withdrawal event
          try {
            const iface = new ethers.Interface(AnonymousPoolABI.default?.abi || AnonymousPoolABI.abi)
            const tokenWithdrawalEvent = receipt.logs.find(log => {
              try {
                const parsed = iface.parseLog(log)
                return parsed && parsed.name === 'TokenWithdrawal'
              } catch {
                return false
              }
            })
            
            if (tokenWithdrawalEvent) {
              const parsed = iface.parseLog(tokenWithdrawalEvent)
              setWithdrawalInfo({
                recipient: parsed.args.to,
                nullifierHash: parsed.args.nullifierHash,
                txHash: receipt.hash,
                withdrawalType: 'TOKEN',
                tokenAddress: selectedToken.address,
                tokenSymbol: selectedToken.symbol,
                tokenAmount: tokenAmount
              })
              setStatus({ 
                type: 'success', 
                message: `Token withdrawal successful! ${tokenAmount} ${selectedToken.symbol} sent to ${recipient}` 
              })
            } else {
              setStatus({ type: 'success', message: 'Token withdrawal successful!' })
            }
          } catch (error) {
            console.error('Error parsing token withdrawal event:', error)
            setStatus({ type: 'success', message: 'Token withdrawal successful!' })
          }
          
        } catch (error) {
          console.error('Token withdrawal error:', error)
          console.error('Error details:', {
            code: error.code,
            reason: error.reason,
            message: error.message,
            data: error.data,
            transaction: error.transaction
          })
          
          // Check error types
          const isMissingFunction = 
            error.message?.includes('withdrawTokens') || 
            error.message?.includes('does not exist') ||
            error.message?.includes('execution reverted (unknown custom error)') ||
            (error.code === 'CALL_EXCEPTION' && error.data === '0x90b8ec18') // Function selector not found
          
          if (isMissingFunction || (error.code === 'CALL_EXCEPTION' && error.data === '0x90b8ec18')) {
            setStatus({ 
              type: 'error', 
              message: `The pool contract at ${poolAddress} doesn't have a withdrawTokens function. This might mean: (1) The contract was deployed before the function was added, (2) The browser cache needs to be cleared (Ctrl+Shift+R), or (3) A new pool needs to be deployed. Pool has ${ethers.formatUnits(poolBalance, selectedToken.decimals)} ${selectedToken.symbol} available.` 
            })
          } else {
            const errorMsg = error.reason || error.message || error.data || 'Failed to withdraw tokens'
            setStatus({ 
              type: 'error', 
              message: `Withdrawal failed: ${errorMsg}. Check browser console for details.` 
            })
          }
          
          setWithdrawalInfo({
            recipient: recipient,
            nullifierHash: nullifierHash,
            txHash: 'not_executed',
            withdrawalType: 'TOKEN',
            tokenAddress: selectedToken.address,
            tokenSymbol: selectedToken.symbol,
            tokenAmount: tokenAmount,
            poolAddress: poolAddress,
            poolBalance: ethers.formatUnits(poolBalance, selectedToken.decimals),
            note: 'Pool contract needs withdrawTokens function. Deploy a new pool with token support.'
          })
          
          setLoading(false)
          return
        }
        
      } else {
        // ETH withdrawal (existing functionality)
        tx = await pool.withdraw(
          nullifierHash,
          recipient,
          root,
          ethers.ZeroAddress // No relayer
        )

        setStatus({ type: 'info', message: 'Transaction pending...' })
        
        receipt = await tx.wait()
        
        // Try to parse withdrawal event
        try {
          const withdrawalEvent = receipt.logs.find(
            log => {
              try {
                const iface = new ethers.Interface(AnonymousPoolABI.default?.abi || AnonymousPoolABI.abi)
                const parsed = iface.parseLog(log)
                return parsed && parsed.name === 'Withdrawal'
              } catch {
                return false
              }
            }
          )

          if (withdrawalEvent) {
            const iface = new ethers.Interface(AnonymousPoolABI.default?.abi || AnonymousPoolABI.abi)
            const parsed = iface.parseLog(withdrawalEvent)
            setWithdrawalInfo({
              recipient: parsed.args.to,
              nullifierHash: parsed.args.nullifierHash,
              txHash: receipt.hash,
              withdrawalType: 'ETH'
            })
            setStatus({ 
              type: 'success', 
              message: 'ETH withdrawal successful!' 
            })
          } else {
            setStatus({ type: 'success', message: 'Withdrawal successful!' })
          }
        } catch (error) {
          console.error('Error parsing withdrawal event:', error)
          setStatus({ type: 'success', message: 'Withdrawal successful!' })
        }
      }

      // Refresh stats
      loadPoolStats()
      
      // Clear form
      setNullifier('')
      setNullifierHash('')
      if (withdrawalType === 'TOKEN') {
        setSelectedToken(null)
        setTokenAmount('')
      }
    } catch (error) {
      console.error('Error withdrawing:', error)
      const errorMessage = error.reason || error.message || 'Failed to withdraw'
      setStatus({ type: 'error', message: errorMessage })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="input-group" style={{ marginBottom: '1rem' }}>
        <label>Withdrawal Type</label>
        <select
          value={withdrawalType}
          onChange={(e) => {
            setWithdrawalType(e.target.value)
            setSelectedToken(null)
            setTokenAmount('')
          }}
          style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '2px solid #e0e0e0' }}
        >
          <option value="ETH">ETH</option>
          <option value="TOKEN">ZToken</option>
        </select>
      </div>

      {poolStats && (
        <div className="status info" style={{ marginBottom: '1rem' }}>
          <strong>Pool Stats:</strong><br />
          Total Deposits: {poolStats.deposits}<br />
          Total Withdrawals: {poolStats.withdrawals}<br />
          Anonymity Set: {poolStats.anonymitySet}<br />
          Pool Balance: {parseFloat(poolStats.balance).toFixed(6)} ETH
        </div>
      )}

      <button 
        className="button" 
        onClick={loadPoolStats}
        disabled={loading}
        style={{ marginBottom: '1rem' }}
      >
        Refresh Pool Info
      </button>

      {withdrawalType === 'TOKEN' && (
        <>
          {deployedTokens.length === 0 ? (
            <div className="status info" style={{ marginBottom: '1rem' }}>
              No ZTokens created yet. Please create a ZToken first.
            </div>
          ) : (
            <>
              <div className="input-group">
                <label>Select ZToken</label>
                <select
                  value={selectedToken?.address || ''}
                  onChange={(e) => {
                    const token = deployedTokens.find(t => t.address === e.target.value)
                    setSelectedToken(token)
                    if (token) {
                      setTokenDecimals(token.decimals)
                    }
                  }}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '2px solid #e0e0e0' }}
                >
                  <option value="">Select a token...</option>
                  {deployedTokens.map((token) => (
                    <option key={token.address} value={token.address}>
                      {token.name} ({token.symbol})
                    </option>
                  ))}
                </select>
              </div>

              {selectedToken && (
                <>
                  <div className="input-group">
                    <label>Withdraw Amount ({selectedToken.symbol})</label>
                    <input
                      type="number"
                      value={tokenAmount}
                      onChange={(e) => setTokenAmount(e.target.value)}
                      placeholder="0.0"
                      step="0.000001"
                      min="0"
                      disabled={loading}
                    />
                  </div>

                  <div className="status info" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                    <strong>Note:</strong> Token withdrawals verify your nullifier but require the pool contract to have a token withdrawal function. The current pool only supports ETH withdrawals. Tokens will need manual recovery or pool contract modification.
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      <div className="input-group">
        <label>Nullifier (from your deposit)</label>
        <input
          type="text"
          value={nullifier}
          onChange={(e) => setNullifier(e.target.value)}
          placeholder="Enter the nullifier you saved during deposit"
          disabled={loading}
        />
      </div>

      {nullifier && (
        <button 
          className="button" 
          onClick={handleGenerateNullifierHash}
          disabled={loading}
          style={{ marginBottom: '1rem' }}
        >
          Generate Nullifier Hash
        </button>
      )}

      {nullifierHash && (
        <>
          <div className="input-group">
            <label>Nullifier Hash</label>
            <input
              type="text"
              value={nullifierHash}
              readOnly
              className="text-mono"
            />
          </div>

          <div className="input-group">
            <label>Recipient Address</label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Address to receive funds"
              disabled={loading}
            />
          </div>

          <div className="input-group">
            <label>Merkle Root</label>
            <input
              type="text"
              value={root}
              readOnly
              className="text-mono"
            />
          </div>
        </>
      )}

      <button 
        className="button" 
        onClick={handleWithdraw}
        disabled={loading || !nullifierHash || !root || !recipient || !signer || (withdrawalType === 'TOKEN' && (!selectedToken || !tokenAmount))}
        style={{ marginTop: '1rem' }}
      >
        {loading ? 'Withdrawing...' : withdrawalType === 'ETH' ? 'Withdraw ETH' : selectedToken ? `Withdraw ${tokenAmount} ${selectedToken.symbol}` : 'Select token to withdraw'}
      </button>

      {status && (
        <div className={`status ${status.type}`}>
          {status.message}
        </div>
      )}

      {withdrawalInfo && (
        <div style={{ marginTop: '1rem' }}>
          <div className="text-mono">
            <strong>Withdrawal Info:</strong><br />
            Type: {withdrawalInfo.withdrawalType || 'ETH'}<br />
            Recipient: {withdrawalInfo.recipient}<br />
            Nullifier Hash: {withdrawalInfo.nullifierHash}<br />
            {withdrawalInfo.withdrawalType === 'TOKEN' && (
              <>
                Token: {withdrawalInfo.tokenSymbol || 'Unknown'}<br />
                Amount: {withdrawalInfo.tokenAmount} {withdrawalInfo.tokenSymbol}<br />
                Token Address: {withdrawalInfo.tokenAddress}<br />
                Pool Address: {withdrawalInfo.poolAddress}<br />
              </>
            )}
            {withdrawalInfo.txHash && withdrawalInfo.txHash !== 'manual' && (
              <>
                <a 
                  href={`https://sepolia.etherscan.io/tx/${withdrawalInfo.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#667eea' }}
                >
                  View on Etherscan
                </a>
                <br />
              </>
            )}
            {withdrawalInfo.note && (
              <>
                <strong>Note:</strong> {withdrawalInfo.note}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default AnonymousWithdrawal

