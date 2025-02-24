const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("Memulai deployment MonadSwap Aggregator...");

  // Alamat konstan
  const BEAN_ROUTER = "0xCa810D095e90Daae6e867c19DF6D9A8C56db2c89";
  const WMON = "0x760afe86e5de5fa0ee542fc7b7b713e1c5425701";

  // 1. Deploy Implementation V1
  console.log("Deploying MonadSwapAggregatorV1...");
  const MonadSwapV1 = await ethers.getContractFactory("MonadSwapAggregatorV1");
  const proxy = await upgrades.deployProxy(MonadSwapV1, [BEAN_ROUTER, WMON], {
    initializer: "initialize",
  });
  await proxy.deployed();

  console.log("MonadSwapAggregator deployed to:", proxy.address);
  console.log(
    "Implementation V1 deployed to:",
    await upgrades.erc1967.getImplementationAddress(proxy.address)
  );
  console.log(
    "ProxyAdmin deployed to:",
    await upgrades.erc1967.getAdminAddress(proxy.address)
  );

  console.log("\nDeployment selesai!");
  console.log("Gunakan proxy address untuk berinteraksi dengan kontrak");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
