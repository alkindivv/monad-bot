const { ethers, upgrades } = require("hardhat");

async function main() {
  // Alamat proxy yang sudah di-deploy
  const PROXY_ADDRESS = "0xD70a46C012d101C0D42Bc31CAB65b46C7afc831a";

  console.log("Memulai upgrade ke MonadSwapAggregatorV2...");

  // Deploy implementation baru
  const MonadSwapV2 = await ethers.getContractFactory("MonadSwapAggregatorV2");
  console.log("Upgrading proxy...");

  await upgrades.upgradeProxy(PROXY_ADDRESS, MonadSwapV2);

  console.log("Upgrade selesai!");
  console.log("Proxy tetap di address:", PROXY_ADDRESS);
  console.log(
    "Implementation V2 deployed to:",
    await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
