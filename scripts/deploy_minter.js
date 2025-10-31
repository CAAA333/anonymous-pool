import "dotenv/config";
import { ethers } from "ethers";
import hre from "hardhat";
import fs from "node:fs";

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_SEPOLIA_URL);
  const wallet   = new ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY, provider);

  console.log("Deploying Minter...");
  const MinterFactory = await hre.ethers.getContractFactory("Minter", wallet);
  const minter = await MinterFactory.deploy(
    process.env.IDENTITY_REGISTRY_ADDRESS,
    process.env.COMPLIANCE_CONTRACT_ADDRESS,
    "zUnderlyingToken",
    "zUSDC",
    6,    // decimal places
    ethers.constants.AddressZero
  );
  await minter.waitForDeployment();
  console.log("Minter deployed to:", await minter.getAddress());

  // Save addresses
  fs.writeFileSync("deployment-minter.json", JSON.stringify({
    minter: await minter.getAddress(),
    timestamp: new Date().toISOString()
  }, null, 2));

  // Verification
  if (process.env.ETHERSCAN_KEY) {
    await hre.run("verify:verify", {
      address: await minter.getAddress(),
      constructorArguments: [
        process.env.IDENTITY_REGISTRY_ADDRESS,
        process.env.COMPLIANCE_CONTRACT_ADDRESS,
        "zUnderlyingToken",
        "zUSDC",
        6,
        ethers.constants.AddressZero
      ]
    });
    console.log("Minter contract verified");

    const ZToken = await hre.ethers.getContractFactory("ZToken", deployer);
    const zUSDC = await ZToken.deploy("zUSDC", "zUSDC", 6);
    await zUSDC.waitForDeployment();

    const Minter = await hre.ethers.getContractFactory("Minter", deployer);
    const minter = await Minter.deploy();
    await minter.waitForDeployment();

    // Map USDC
    await minter.addToken(usdcAddress, zUSDC.address);

  }
}

main().catch(e => { console.error(e); process.exit(1); });
