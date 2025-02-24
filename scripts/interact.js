const { ethers } = require("hardhat");

async function main() {
  const PROXY_ADDRESS = "0xD70a46C012d101C0D42Bc31CAB65b46C7afc831a";

  // Token addresses di Monad Testnet
  const USDC = "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea";
  const USDT = "0x88b8E2161DEDC77EF4ab7585569D2415a1C1055D";
  const WETH = "0xB5a30b0FDc5EA94A52fDc42e3E9760Cb8449Fb37";
  const WMON = "0x760afe86e5de5fa0ee542fc7b7b713e1c5425701";

  // Get contract
  const aggregator = await ethers.getContractAt(
    "MonadSwapAggregatorV2",
    PROXY_ADDRESS
  );

  // Get signer
  const [owner] = await ethers.getSigners();
  console.log("Interacting with:", PROXY_ADDRESS);
  console.log("Owner address:", owner.address);

  try {
    // 1. Check router address
    const router = await aggregator.beanRouter();
    console.log("\nBeanRouter address:", router);

    // 2. Check WMON address
    const wmonAddress = await aggregator.wmon();
    console.log("WMON address:", wmonAddress);

    // 3. Set fee collector
    console.log("\nSetting fee collector...");
    const feeCollectorTx = await aggregator.setFeeCollector(owner.address);
    await feeCollectorTx.wait();
    console.log("Fee collector set to:", owner.address);

    // 4. Set swap fee (0.5%)
    console.log("\nSetting swap fee...");
    const setFeeTx = await aggregator.setSwapFee(50);
    await setFeeTx.wait();
    console.log("Swap fee set to: 0.5%");

    // 5. Set preferred pair (USDC-USDT)
    console.log("\nSetting preferred pair USDC-USDT...");
    const setPairTx = await aggregator.setPreferredPair(USDC, USDT, true);
    await setPairTx.wait();
    console.log("Preferred pair set");

    // 6. Try different amount out estimations
    console.log("\nTesting different swap routes:");

    // Test MON to USDC
    try {
      console.log("\nTesting MON -> USDC swap estimation:");
      const monAmount = ethers.utils.parseEther("1"); // 1 MON
      const monToUsdcOut = await aggregator.getAmountOut(
        ethers.constants.AddressZero, // Native MON
        USDC,
        monAmount
      );
      console.log(
        "1 MON = ",
        ethers.utils.formatUnits(monToUsdcOut, 6),
        "USDC"
      );
    } catch (error) {
      console.log("MON -> USDC estimation failed:", error.message);
    }

    // Test USDC to WMON
    try {
      console.log("\nTesting USDC -> WMON swap estimation:");
      const usdcAmount = ethers.utils.parseUnits("100", 6); // 100 USDC
      const usdcToWmonOut = await aggregator.getAmountOut(
        USDC,
        WMON,
        usdcAmount
      );
      console.log(
        "100 USDC = ",
        ethers.utils.formatEther(usdcToWmonOut),
        "WMON"
      );
    } catch (error) {
      console.log("USDC -> WMON estimation failed:", error.message);
    }

    // Test USDC to USDT (direct pair)
    try {
      console.log("\nTesting USDC -> USDT swap estimation:");
      const usdcAmount = ethers.utils.parseUnits("100", 6); // 100 USDC
      const usdcToUsdtOut = await aggregator.getAmountOut(
        USDC,
        USDT,
        usdcAmount
      );
      console.log(
        "100 USDC = ",
        ethers.utils.formatUnits(usdcToUsdtOut, 6),
        "USDT"
      );
    } catch (error) {
      console.log("USDC -> USDT estimation failed:", error.message);
    }
  } catch (error) {
    console.error("\nError occurred:", error.message);
    // Check if we have more error details
    if (error.data) {
      console.error("Error data:", error.data);
    }
    if (error.transaction) {
      console.error("Failed transaction:", error.transaction);
    }
  }

  console.log("\nScript execution completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
