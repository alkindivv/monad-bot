require("dotenv").config();
const { ethers } = require("ethers");
const colors = require("colors");

const RPC_URL = "https://testnet-rpc.monad.xyz/";
const EXPLORER_URL = "https://testnet.monadexplorer.com/tx/";

// Contract addresses
const ROUTER_ADDRESS = "0xca810d095e90daae6e867c19df6d9a8c56db2c89";
const WMON_ADDRESS = "0x760afe86e5de5fa0ee542fc7b7b713e1c5425701";
const USDC_ADDRESS = "0x3B428Df09c3508D884C30266Ac1577f099313CF6";

// Initialize provider dan wallet
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

async function swapMonToUsdc(amountIn) {
  try {
    console.log(
      `🔄 Swapping ${ethers.utils.formatEther(amountIn)} MON to USDC...`.yellow
    );

    // Method swapExactEthForTokens yang sering berhasil
    const data = ethers.utils.hexConcat([
      "0x7ff36ab5", // swapExactEthForTokens
      ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256", "address", "uint256", "address[]"],
        [
          0, // amountOutMin
          160, // offset untuk path array (0xa0 in hex)
          wallet.address, // recipient
          Math.floor(Date.now() / 1000) + 1200, // deadline 20 menit
          [WMON_ADDRESS, USDC_ADDRESS], // path swap
        ]
      ),
    ]);

    const tx = await wallet.sendTransaction({
      to: ROUTER_ADDRESS,
      data: data,
      value: amountIn,
      gasLimit: 250000, // Gas limit yang cukup berdasarkan transaksi sukses
    });

    console.log(`Transaction hash: ${EXPLORER_URL}${tx.hash}`.cyan);
    console.log("Menunggu konfirmasi transaksi...".yellow);

    const receipt = await tx.wait();
    if (receipt.status === 1) {
      console.log(`✅ Swap berhasil!`.green);
      // Cek transfer events untuk melihat jumlah USDC yang diterima
      const transferEvents = receipt.logs.filter(
        (log) =>
          log.topics[0] ===
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
      );
      if (transferEvents.length > 0) {
        console.log(`✅ Token berhasil ditransfer`.green);
      }
    }
  } catch (error) {
    console.error(`❌ Swap gagal:`.red, error.message);
    if (error.transaction) {
      console.log("Data transaksi:", error.transaction.data);
      console.log("Gas limit:", error.transaction.gasLimit.toString());
      console.log(
        "Value:",
        ethers.utils.formatEther(error.transaction.value),
        "MON"
      );
    }
  }
}

async function main() {
  console.log(`\n🚀 MON to USDC Swap Bot`.green);
  const amount = ethers.utils.parseEther("0.1"); // 0.01 MON (jumlah yang sering berhasil)
  await swapMonToUsdc(amount);
}

main();
