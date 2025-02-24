const hre = require("hardhat");

async function main() {
  console.log("Deploying MonadSwapAggregator contract...");

  // Deploy contract
  const MonadSwapAggregator = await hre.ethers.getContractFactory(
    "MonadSwapAggregator"
  );
  const aggregator = await MonadSwapAggregator.deploy();
  await aggregator.deployed();

  console.log("\n✅ MonadSwapAggregator deployed to:", aggregator.address);
  console.log("\nSupported DEXes:");
  console.log("- Bean DEX: 0xCa810D095e90Daae6e867c19DF6D9A8C56db2c89");
  console.log("- Ambient DEX: 0x88B96aF200c8a9c35442C8AC6cd3D22695AaE4F0");

  // Verify contract
  console.log("\nContract deployed! Verify on explorer:");
  console.log(
    "https://testnet.monadexplorer.com/address/" + aggregator.address
  );
  console.log("\nWait a few minutes then run this command to verify:");
  console.log(`npx hardhat verify --network monad ${aggregator.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
