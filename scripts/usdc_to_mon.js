require("dotenv").config();
const { ethers } = require("ethers");
const colors = require("colors");

const RPC_URL = "https://testnet-rpc.monad.xyz/";
const EXPLORER_URL = "https://testnet.monadexplorer.com/tx/";

// Contract addresses
const ROUTER_ADDRESS = "0xca810d095e90daae6e867c19df6d9a8c56db2c89";
const WMON_ADDRESS = "0x760afe86e5de5fa0ee542fc7b7b713e1c5425701";
const USDC_ADDRESS = "0xf817257fed379853cde0fa4f97ab987181b1e5ea";

// Initialize provider dan wallet
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// ABI untuk approve USDC
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
];

async function approveUSDC(amount) {
  try {
    console.log("🔄 Mengecek approval USDC...".yellow);

    const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, wallet);
    const decimals = await usdcContract.decimals();
    const amountInDecimals = ethers.utils.parseUnits(
      amount.toString(),
      decimals
    );

    const allowance = await usdcContract.allowance(
      wallet.address,
      ROUTER_ADDRESS
    );
    if (allowance.lt(amountInDecimals)) {
      console.log("🔄 Melakukan approve USDC...".yellow);
      const tx = await usdcContract.approve(
        ROUTER_ADDRESS,
        ethers.constants.MaxUint256
      );
      await tx.wait();
      console.log("✅ USDC berhasil diapprove".green);
    } else {
      console.log("✅ USDC sudah diapprove sebelumnya".green);
    }
    return amountInDecimals;
  } catch (error) {
    console.error("❌ Approve gagal:".red, error.message);
    throw error;
  }
}

async function swapUsdcToMon(amount) {
  try {
    console.log(`🔄 Swapping ${amount} USDC to MON...`.yellow);

    // Approve dulu
    const amountInDecimals = await approveUSDC(amount);

    // Method swapExactTokensForETH
    const data = ethers.utils.hexConcat([
      "0x18cbafe5", // swapExactTokensForETH
      ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256", "address[]", "address", "uint256"],
        [
          amountInDecimals, // amountIn
          0, // amountOutMin
          [USDC_ADDRESS, WMON_ADDRESS], // path
          wallet.address, // recipient
          Math.floor(Date.now() / 1000) + 1200, // deadline 20 menit
        ]
      ),
    ]);

    const tx = await wallet.sendTransaction({
      to: ROUTER_ADDRESS,
      data: data,
      gasLimit: 350000,
    });

    console.log(`Transaction hash: ${EXPLORER_URL}${tx.hash}`.cyan);
    console.log("Menunggu konfirmasi transaksi...".yellow);

    const receipt = await tx.wait();
    if (receipt.status === 1) {
      console.log(`✅ Swap berhasil!`.green);
      // Cek transfer events
      const transferEvents = receipt.logs.filter(
        (log) =>
          log.topics[0] ===
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
      );
      if (transferEvents.length > 0) {
        console.log(`✅ MON berhasil diterima`.green);
      }
    }
  } catch (error) {
    console.error(`❌ Swap gagal:`.red, error.message);
    if (error.transaction) {
      console.log("Data transaksi:", error.transaction.data);
      console.log("Gas limit:", error.transaction.gasLimit.toString());
    }
  }
}

async function main() {
  console.log(`\n🚀 USDC to MON Swap Bot`.green);

  // Cek balance USDC dulu
  const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, wallet);
  const balance = await usdcContract.balanceOf(wallet.address);
  const decimals = await usdcContract.decimals();
  console.log(
    `💰 USDC Balance: ${ethers.utils.formatUnits(balance, decimals)}`.cyan
  );

  // Swap 1 USDC
  await swapUsdcToMon(0.5);
}

main();
