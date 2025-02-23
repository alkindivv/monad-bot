const hre = require("hardhat");

async function main() {
  console.log("Deploying MonadSwap contract...");

  // Deploy contract
  const MonadSwap = await hre.ethers.getContractFactory("MonadSwap");
  const monadSwap = await MonadSwap.deploy();
  await monadSwap.deployed();

  console.log("MonadSwap deployed to:", monadSwap.address);

  // Verify contract
  console.log("\nContract deployed! Verify on explorer:");
  console.log("https://testnet.monadexplorer.com/address/" + monadSwap.address);
  console.log("Wait a few minutes then run this command to verify:");
  console.log(`npx hardhat verify --network monad ${monadSwap.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
