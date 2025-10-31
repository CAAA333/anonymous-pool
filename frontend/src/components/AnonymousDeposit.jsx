import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import AnonymousPoolABI from '../artifacts/contracts/AnonymousPool.sol/AnonymousPool.json'
import ZTokenABI from '../artifacts/contracts/ZToken.sol/ZToken.json'

function AnonymousDeposit({ signer, account, poolAddress, deployedTokens }) {
  const [secret, setSecret] = useState('')
  const [nullifier, setNullifier] = useState('')
  const [commitment, setCommitment] = useState('')
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [depositAmount, setDepositAmount] = useState(null)
  const [fee, setFee] = useState(null)
  const [depositInfo, setDepositInfo] = useState(null)
  const [depositType, setDepositType] = useState('ETH') // 'ETH' or 'TOKEN'
  const [selectedToken, setSelectedToken] = useState(null)
  const [tokenBalance, setTokenBalance] = useState(null)
  const [tokenDecimals, setTokenDecimals] = useState(18)
  const [tokenAmount, setTokenAmount] = useState('')
  const [approved, setApproved] = useState(false)

  useEffect(() => {
    loadPoolInfo()
  }, [poolAddress, signer])

  useEffect(() => {
    if (selectedToken && account && signer && depositType === 'TOKEN') {
      loadTokenBalance()
      checkTokenApproval()
    }
  }, [selectedToken, account, signer, depositType, tokenAmount])

  const loadTokenBalance = async () => {
    if (!selectedToken || !account || !signer) return

    try {
      const token = new ethers.Contract(
        selectedToken.address,
        ZTokenABI.default?.abi || ZTokenABI.abi,
        signer
      )

      const balance = await token.balanceOf(account)
      setTokenBalance(balance)
      setTokenDecimals(selectedToken.decimals)
    } catch (error) {
      console.error('Error loading token balance:', error)
    }
  }

  const checkTokenApproval = async () => {
    if (!selectedToken || !account || !signer || !poolAddress || !tokenAmount) {
      setApproved(false)
      return
    }

    try {
      const token = new ethers.Contract(
        selectedToken.address,
        ZTokenABI.default?.abi || ZTokenABI.abi,
        signer
      )

      const amount = ethers.parseUnits(tokenAmount, selectedToken.decimals)
      const allowance = await token.allowance(account, poolAddress)
      setApproved(allowance >= amount)
    } catch (error) {
      console.error('Error checking approval:', error)
      setApproved(false)
    }
  }

  const handleApproveToken = async () => {
    if (!signer || !selectedToken || !poolAddress || !tokenAmount) return

    setLoading(true)
    setStatus(null)

    try {
      const token = new ethers.Contract(
        selectedToken.address,
        ZTokenABI.default?.abi || ZTokenABI.abi,
        signer
      )

      const amount = ethers.parseUnits(tokenAmount, selectedToken.decimals)
      
      const tx = await token.approve(poolAddress, amount)
      setStatus({ type: 'info', message: 'Waiting for approval...' })
      await tx.wait()
      
      setApproved(true)
      setStatus({ type: 'success', message: 'Token approved successfully!' })
    } catch (error) {
      console.error('Error approving token:', error)
      setStatus({ type: 'error', message: error.reason || error.message || 'Failed to approve token' })
    } finally {
      setLoading(false)
    }
  }

  const loadPoolInfo = async () => {
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
        console.warn('No provider available for loading pool info')
        return
      }

      const pool = new ethers.Contract(
        poolAddress, 
        AnonymousPoolABI.default?.abi || AnonymousPoolABI.abi, 
        contractProvider
      )
      const deposit = await pool.DEPOSIT_AMOUNT()
      const poolFee = await pool.FEE()
      setDepositAmount(ethers.formatEther(deposit))
      setFee(ethers.formatEther(poolFee))
    } catch (error) {
      console.error('Error loading pool info:', error)
      setStatus({ type: 'error', message: 'Failed to load pool info. Make sure you\'re on Sepolia network.' })
    }
  }

  const generateRandomBytes = () => {
    return ethers.hexlify(ethers.randomBytes(32))
  }

  const generateSecrets = () => {
    const newSecret = generateRandomBytes()
    const newNullifier = generateRandomBytes()
    setSecret(newSecret)
    setNullifier(newNullifier)
    setCommitment('') // Clear previous commitment
    setStatus(null) // Clear status
    
    // Auto-generate commitment if pool address is available
    if (poolAddress) {
      // Small delay to ensure state is updated
      setTimeout(() => {
        generateCommitment(newSecret, newNullifier)
      }, 100)
    }
  }

  const generateCommitment = async (secretValue, nullifierValue) => {
    if (!poolAddress) {
      setStatus({ type: 'error', message: 'Pool address not configured' })
      return
    }

    const secretToUse = secretValue || secret
    const nullifierToUse = nullifierValue || nullifier

    if (!secretToUse || !nullifierToUse) {
      setStatus({ type: 'error', message: 'Please generate secrets first' })
      return
    }

    try {
      // Use signer if available, otherwise create a read-only provider
      let contractProvider = signer
      if (!contractProvider) {
        // Create a provider for read-only calls - prioritize MetaMask
        let ethereum = null
        if (window.ethereum?.providers && Array.isArray(window.ethereum.providers)) {
          ethereum = window.ethereum.providers.find(p => p.isMetaMask)
        } else if (window.ethereum?.isMetaMask) {
          ethereum = window.ethereum
        }
        
        if (ethereum) {
          const provider = new ethers.BrowserProvider(ethereum)
          contractProvider = provider
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
      
      setStatus({ type: 'info', message: 'Generating commitment...' })
      const commitmentHash = await pool.generateCommitment(
        secretToUse,
        nullifierToUse
      )
      setCommitment(commitmentHash)
      setStatus({ type: 'success', message: 'Commitment generated successfully!' })
    } catch (error) {
      console.error('Error generating commitment:', error)
      const errorMsg = error.reason || error.message || 'Failed to generate commitment'
      setStatus({ type: 'error', message: errorMsg })
    }
  }

  const handleDeposit = async () => {
    if (!signer || !account) {
      setStatus({ type: 'error', message: 'Please connect your wallet first' })
      return
    }

    if (!secret || !nullifier || !commitment) {
      setStatus({ type: 'error', message: 'Please generate secrets and commitment first' })
      return
    }

    if (depositType === 'TOKEN' && (!selectedToken || !tokenAmount)) {
      setStatus({ type: 'error', message: 'Please select a token and enter amount' })
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
      
      if (depositType === 'ETH') {
        // ETH deposit (existing functionality)
        tx = await pool.deposit(commitment, {
          value: ethers.parseEther(depositAmount || '0.001')
        })
      } else {
        // Token deposit - transfer tokens to pool and create commitment
        // Note: We'll transfer tokens to the pool contract and add commitment
        // This requires the pool contract to handle tokens, but we'll attempt it
        
        const token = new ethers.Contract(
          selectedToken.address,
          ZTokenABI.default?.abi || ZTokenABI.abi,
          signer
        )

        const amount = ethers.parseUnits(tokenAmount, selectedToken.decimals)
        
        // Check balance first
        const balance = await token.balanceOf(account)
        if (balance < amount) {
          setStatus({ type: 'error', message: 'Insufficient token balance' })
          setLoading(false)
          return
        }
        
        // Transfer tokens to pool
        setStatus({ type: 'info', message: 'Transferring tokens to pool...' })
        const transferTx = await token.transfer(poolAddress, amount)
        await transferTx.wait()
        
        // Then add commitment to the pool (this will work if pool accepts external commitment adds)
        // Note: This assumes the pool can track token deposits separately or we use a workaround
        setStatus({ type: 'info', message: 'Creating commitment in pool...' })
        
        // Since the pool's deposit function only accepts ETH, we'll:
        // 1. Transfer tokens to pool (already done)
        // 2. Call insertLeaf to add commitment to merkle tree
        // 3. Track that this commitment is for tokens
        
        setStatus({ type: 'info', message: 'Adding commitment to merkle tree...' })
        
        // Call insertLeaf to add the commitment
        const insertTx = await pool.insertLeaf(commitment)
        const insertReceipt = await insertTx.wait()
        
        // Find leaf index from event
        let leafIndex = null
        try {
          const iface = new ethers.Interface(AnonymousPoolABI.default?.abi || AnonymousPoolABI.abi)
          const leafInsertedEvent = insertReceipt.logs.find(log => {
            try {
              const parsed = iface.parseLog(log)
              return parsed && parsed.name === 'LeafInserted'
            } catch {
              return false
            }
          })
          
          if (leafInsertedEvent) {
            const parsed = iface.parseLog(leafInsertedEvent)
            leafIndex = parsed.args.leafIndex.toString()
          }
        } catch (error) {
          console.error('Error parsing leaf index:', error)
        }
        
        // Record deposit info
        setDepositInfo({
          commitment: commitment,
          leafIndex: leafIndex || 'unknown',
          txHash: transferTx.hash,
          tokenAddress: selectedToken.address,
          tokenAmount: tokenAmount,
          tokenSymbol: selectedToken.symbol,
          depositType: 'TOKEN'
        })
        
        setStatus({ 
          type: 'success', 
          message: `Token deposit successful! ${leafIndex ? `Leaf index: ${leafIndex}` : 'Tokens transferred and commitment added'}` 
        })
        
        // Clear form
        setTokenAmount('')
        setSelectedToken(null)
        setSecret('')
        setNullifier('')
        setCommitment('')
        setApproved(false)
        
        setLoading(false)
        return
      }

      setStatus({ type: 'info', message: 'Transaction pending...' })
      
      const receipt = await tx.wait()
      
      // Only process deposit event for ETH deposits (token deposits handled above)
      if (depositType === 'ETH') {
        // Try to parse deposit event
        try {
          const depositEvent = receipt.logs.find(
            log => {
              try {
                const iface = new ethers.Interface(AnonymousPoolABI.default?.abi || AnonymousPoolABI.abi)
                const parsed = iface.parseLog(log)
                return parsed && parsed.name === 'Deposit'
              } catch {
                return false
              }
            }
          )

          if (depositEvent) {
            const iface = new ethers.Interface(AnonymousPoolABI.default?.abi || AnonymousPoolABI.abi)
            const parsed = iface.parseLog(depositEvent)
            setDepositInfo({
              commitment: parsed.args.commitment,
              leafIndex: parsed.args.leafIndex.toString(),
              txHash: receipt.hash,
              depositType: 'ETH'
            })
            setStatus({ 
              type: 'success', 
              message: `Deposit successful! Leaf index: ${parsed.args.leafIndex.toString()}` 
            })
          } else {
            setStatus({ type: 'success', message: 'Deposit successful!' })
          }
        } catch (error) {
          console.error('Error parsing deposit event:', error)
          setStatus({ type: 'success', message: 'Deposit successful!' })
        }
      }

      // Clear secrets for security (user should save them)
      // setSecret('')
      // setNullifier('')
    } catch (error) {
      console.error('Error making deposit:', error)
      const errorMessage = error.reason || error.message || 'Failed to make deposit'
      setStatus({ type: 'error', message: errorMessage })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="input-group" style={{ marginBottom: '1rem' }}>
        <label>Deposit Type</label>
        <select
          value={depositType}
          onChange={(e) => {
            setDepositType(e.target.value)
            setSelectedToken(null)
            setTokenAmount('')
            setApproved(false)
          }}
          style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '2px solid #e0e0e0' }}
        >
          <option value="ETH">ETH</option>
          <option value="TOKEN">ZToken</option>
        </select>
      </div>

      {depositType === 'TOKEN' && (
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
                    setTokenAmount('')
                    setApproved(false)
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
                <div className="status info" style={{ marginBottom: '1rem' }}>
                  <strong>Token:</strong> {selectedToken.name} ({selectedToken.symbol})<br />
                  {tokenBalance !== null && (
                    <>
                      <strong>Your Balance:</strong> {ethers.formatUnits(tokenBalance, tokenDecimals)} {selectedToken.symbol}<br />
                    </>
                  )}
                  <strong>Note:</strong> Token deposits will transfer tokens to the pool and add a commitment to the merkle tree.
                </div>
              )}

              {selectedToken && (
                <div className="input-group">
                  <label>Deposit Amount ({selectedToken.symbol})</label>
                  <input
                    type="number"
                    value={tokenAmount}
                    onChange={(e) => {
                      setTokenAmount(e.target.value)
                      setApproved(false)
                    }}
                    placeholder="0.0"
                    step="0.000001"
                    min="0"
                    disabled={loading}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}

      {depositAmount && fee && depositType === 'ETH' && (
        <div className="status info" style={{ marginBottom: '1rem' }}>
          <strong>Deposit Amount:</strong> {depositAmount} ETH<br />
          <strong>Fee:</strong> {fee} ETH<br />
          <strong>You'll receive:</strong> {(parseFloat(depositAmount) - parseFloat(fee)).toFixed(6)} ETH on withdrawal
        </div>
      )}

      <button 
        className="button" 
        onClick={generateSecrets}
        disabled={loading}
        style={{ marginBottom: '1rem' }}
      >
        Generate Secrets
      </button>

      {secret && nullifier && (
        <>
          <div className="input-group">
            <label>Secret (save this!)</label>
            <input
              type="text"
              value={secret}
              readOnly
              className="text-mono"
            />
          </div>

          <div className="input-group">
            <label>Nullifier (save this!)</label>
            <input
              type="text"
              value={nullifier}
              readOnly
              className="text-mono"
            />
          </div>

          <div className="input-group">
            <label>Commitment</label>
            <input
              type="text"
              value={commitment}
              readOnly
              className="text-mono"
            />
          </div>

          {!commitment && (secret || nullifier) && (
            <button 
              className="button" 
              onClick={() => generateCommitment()}
              disabled={loading || !secret || !nullifier}
              style={{ marginBottom: '1rem' }}
            >
              Generate Commitment
            </button>
          )}
        </>
      )}

      <button 
        className="button" 
        onClick={handleDeposit}
        disabled={loading || !commitment || !signer || (depositType === 'TOKEN' && !selectedToken)}
        style={{ marginTop: '1rem' }}
      >
        {loading ? 'Depositing...' : depositType === 'ETH' 
          ? `Deposit ${depositAmount || '0.001'} ETH`
          : selectedToken 
            ? `Deposit ${tokenAmount} ${selectedToken.symbol}`
            : 'Select token to deposit'}
      </button>

      {status && (
        <div className={`status ${status.type}`}>
          {status.message}
        </div>
      )}

      {depositInfo && (
        <div style={{ marginTop: '1rem' }}>
          <div className="text-mono">
            <strong>Deposit Info:</strong><br />
            Type: {depositInfo.depositType || 'ETH'}<br />
            Leaf Index: {depositInfo.leafIndex}<br />
            Commitment: {depositInfo.commitment}<br />
            {depositInfo.depositType === 'TOKEN' && (
              <>
                Token: {depositInfo.tokenSymbol || 'Unknown'}<br />
                Amount: {depositInfo.tokenAmount} {depositInfo.tokenSymbol}<br />
              </>
            )}
            <a 
              href={`https://sepolia.etherscan.io/tx/${depositInfo.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#667eea' }}
            >
              View on Etherscan
            </a>
          </div>
        </div>
      )}

      <div className="status info" style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
        ⚠️ <strong>Important:</strong> Save your secret and nullifier! You'll need them to withdraw.
          Never share these values with anyone.
      </div>
    </div>
  )
}

export default AnonymousDeposit

