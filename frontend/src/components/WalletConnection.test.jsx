import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import WalletConnection from './WalletConnection'

describe('WalletConnection', () => {
  it('should render connect button when not connected', () => {
    const mockOnConnect = vi.fn()
    render(<WalletConnection account={null} onConnect={mockOnConnect} />)
    
    const button = screen.getByText('Connect Wallet')
    expect(button).toBeInTheDocument()
  })

  it('should render account info when connected', () => {
    const account = '0x1234567890123456789012345678901234567890'
    render(<WalletConnection account={account} onConnect={vi.fn()} />)
    
    expect(screen.getByText(/Connected:/)).toBeInTheDocument()
    expect(screen.getByText(account)).toBeInTheDocument()
  })

  it('should call onConnect when button is clicked', async () => {
    const user = await import('@testing-library/user-event').then(m => m.default)
    const mockOnConnect = vi.fn()
    
    render(<WalletConnection account={null} onConnect={mockOnConnect} />)
    
    const button = screen.getByText('Connect Wallet')
    await user.click(button)
    
    expect(mockOnConnect).toHaveBeenCalledTimes(1)
  })
})

