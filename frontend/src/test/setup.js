import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock window.ethereum
Object.defineProperty(window, 'ethereum', {
  value: {
    isMetaMask: true,
    request: vi.fn(),
    providers: null,
    isCoinbaseWallet: false,
  },
  writable: true,
})
