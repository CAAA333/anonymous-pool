import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CreateZToken from './CreateZToken'
import { ethers } from 'ethers'

// Mock ethers
vi.mock('ethers', () => {
  const mockContract = {
    waitForDeployment: vi.fn().mockResolvedValue(true),
    getAddress: vi.fn().mockResolvedValue('0xTokenAddress123456789012345678901234567890'),
    name: vi.fn().mockResolvedValue('Test Token'),
    symbol: vi.fn().mockResolvedValue('TEST'),
    decimals: vi.fn().mockResolvedValue(18),
    mint: vi.fn().mockResolvedValue({
      wait: vi.fn().mockResolvedValue({ hash: '0xMintTxHash' })
    }),
  }

  const mockFactory = {
    deploy: vi.fn().mockResolvedValue(mockContract),
  }

  const mockContractFactory = vi.fn().mockReturnValue(mockFactory)
  mockContractFactory.prototype.deploy = mockFactory.deploy

  return {
    default: {
      ContractFactory: mockContractFactory,
      parseUnits: vi.fn((value) => BigInt(value * 1e18)),
      parseEther: vi.fn((value) => BigInt(value * 1e18)),
    },
    ContractFactory: mockContractFactory,
    parseUnits: vi.fn((value) => BigInt(value * 1e18)),
    parseEther: vi.fn((value) => BigInt(value * 1e18)),
  }
})

describe('CreateZToken', () => {
  const mockSigner = {}
  const mockAccount = '0x1234567890123456789012345678901234567890'
  const mockOnTokenCreated = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render form fields', () => {
    render(<CreateZToken signer={mockSigner} account={mockAccount} onTokenCreated={mockOnTokenCreated} />)
    
    expect(screen.getByPlaceholderText(/My Token/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/MTK/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/18/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Deploy ZToken/i })).toBeInTheDocument()
  })

  it('should disable button when wallet is not connected', () => {
    render(<CreateZToken signer={null} account={null} onTokenCreated={mockOnTokenCreated} />)
    
    const deployButton = screen.getByRole('button', { name: /Deploy ZToken/i })
    // Button should be disabled when signer or account are null
    expect(deployButton).toBeDisabled()
  })

  it('should show error when fields are empty', async () => {
    const user = userEvent.setup()
    render(<CreateZToken signer={mockSigner} account={mockAccount} onTokenCreated={mockOnTokenCreated} />)
    
    const deployButton = screen.getByRole('button', { name: /Deploy ZToken/i })
    await user.click(deployButton)

    await waitFor(() => {
      expect(screen.getByText(/Please fill in all fields/i)).toBeInTheDocument()
    })
  })

  it('should show error for invalid decimals', async () => {
    const user = userEvent.setup()
    render(<CreateZToken signer={mockSigner} account={mockAccount} onTokenCreated={mockOnTokenCreated} />)
    
    const nameInput = screen.getByPlaceholderText(/My Token/i)
    const symbolInput = screen.getByPlaceholderText(/MTK/i)
    const decimalsInput = screen.getByPlaceholderText(/18/i)
    const deployButton = screen.getByRole('button', { name: /Deploy ZToken/i })

    await user.type(nameInput, 'Test Token')
    await user.type(symbolInput, 'TEST')
    await user.clear(decimalsInput)
    await user.type(decimalsInput, '19')
    await user.click(deployButton)

    await waitFor(() => {
      expect(screen.getByText(/Decimals must be between 0 and 18/i)).toBeInTheDocument()
    })
  })

  it('should have deploy button', () => {
    render(<CreateZToken signer={mockSigner} account={mockAccount} onTokenCreated={mockOnTokenCreated} />)
    
    const deployButton = screen.getByRole('button', { name: /Deploy ZToken/i })
    expect(deployButton).toBeInTheDocument()
    // Button should be enabled when signer and account are provided
    expect(deployButton).not.toBeDisabled()
  })
})

