import './WalletConnection.css'

function WalletConnection({ account, onConnect }) {
  if (account) {
    return (
      <div className="account-info">
        Connected: <span>{account}</span>
      </div>
    )
  }

  return (
    <button className="button" onClick={onConnect}>
      Connect Wallet
    </button>
  )
}

export default WalletConnection

