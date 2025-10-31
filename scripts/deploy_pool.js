import "dotenv/config";
import { ethers } from "ethers";
import hre from "hardhat";
import fs from "node:fs";
import "@nomicfoundation/hardhat-verify";

async function main() {
  if (!process.env.ALCHEMY_SEPOLIA_URL || !process.env.SEPOLIA_PRIVATE_KEY) {
    throw new Error("Missing ALCHEMY_SEPOLIA_URL or SEPOLIA_PRIVATE_KEY in .env");
  }

  const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_SEPOLIA_URL);
  const signer   = new ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY, provider);

  const net = await provider.getNetwork();
  console.log("ChainId:", Number(net.chainId));
  console.log("Deployer:", signer.address);
  console.log("Balance:", ethers.formatEther(await provider.getBalance(signer.address)), "ETH");

  // 1) Deploy SimplifiedPoseidon
  const poseidonArt = await hre.artifacts.readArtifact("SimplifiedPoseidon");
  const Poseidon = new ethers.ContractFactory(poseidonArt.abi, poseidonArt.bytecode, signer);
  const poseidon = await Poseidon.deploy();
  await poseidon.waitForDeployment();
  const poseidonAddress = await poseidon.getAddress();
  console.log("SimplifiedPoseidon:", poseidonAddress);

  // 2) Deploy AnonymousPool with token withdrawal support
  const TREE_DEPTH = 10; // 2^10 = 1024
  const poolArt = await hre.artifacts.readArtifact("AnonymousPool");
  const Pool = new ethers.ContractFactory(poolArt.abi, poolArt.bytecode, signer);
  const pool = await Pool.deploy(TREE_DEPTH, poseidonAddress);
  await pool.waitForDeployment();
  const poolAddress = await pool.getAddress();
  console.log("AnonymousPool (with token support):", poolAddress);

  // Optional: read constants if present
  try {
    const deposit = await pool.DEPOSIT_AMOUNT();
    const fee     = await pool.FEE();
    console.log("Deposit Amount:", ethers.formatEther(deposit), "ETH");
    console.log("Fee:",            ethers.formatEther(fee),     "ETH");
  } catch (_) {}

  // 3) Save deployment info
  const out = {
    network: "sepolia",
    deployer: signer.address,
    poseidon: poseidonAddress,
    pool: poolAddress,
    treeDepth: TREE_DEPTH,
    blockNumber: await provider.getBlockNumber(),
    timestamp: new Date().toISOString(),
    supportsTokens: true
  };
  fs.writeFileSync("deployment-sepolia.json", JSON.stringify(out, null, 2));
  console.log("\n✅ Pool deployed with token withdrawal support!");
  console.log("📝 Update POOL_ADDRESS in frontend/src/App.jsx to:", poolAddress);
  console.log("Saved deployment-sepolia.json");

  // 4) Optional verification (needs ETHERSCAN_KEY)
  if (process.env.ETHERSCAN_KEY) {
    console.log("\nWaiting 5 confirmations for verification…");
    const tx = poseidon.deploymentTransaction();
    if (tx) await tx.wait(5);

    try { 
      await hre.run("verify:verify", { address: poseidonAddress, constructorArguments: [] }); 
      console.log("✅ Poseidon verified");
    }
    catch (e) { console.log("⚠️  Verify Poseidon:", e.message); }

    try { 
      await hre.run("verify:verify", { address: poolAddress, constructorArguments: [TREE_DEPTH, poseidonAddress] }); 
      console.log("✅ Pool verified");
    }
    catch (e) { console.log("⚠️  Verify Pool:", e.message); }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
