require("dotenv").config();
const { ethers } = require("ethers");
const colors = require("colors");
const prompts = require("prompts");

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

// Fungsi untuk mendapatkan angka random antara min dan max
function getRandomAmount(min, max) {
  return Math.random() * (max - min) + min;
}

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
    return true;
  } catch (error) {
    console.error(`❌ Swap gagal:`.red, error.message);
    if (error.transaction) {
      console.log("Data transaksi:", error.transaction.data);
      console.log("Gas limit:", error.transaction.gasLimit.toString());
    }
    return false;
  }
}

async function swapMonToUsdc(amountIn) {
  try {
    console.log(
      `🔄 Swapping ${ethers.utils.formatEther(amountIn)} MON to USDC...`.yellow
    );

    // Method swapExactEthForTokens
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
      gasLimit: 250000,
    });

    console.log(`Transaction hash: ${EXPLORER_URL}${tx.hash}`.cyan);
    console.log("Menunggu konfirmasi transaksi...".yellow);

    const receipt = await tx.wait();
    if (receipt.status === 1) {
      console.log(`✅ Swap berhasil!`.green);
      const transferEvents = receipt.logs.filter(
        (log) =>
          log.topics[0] ===
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
      );
      if (transferEvents.length > 0) {
        console.log(`✅ Token berhasil ditransfer`.green);
      }
    }
    return true;
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
    return false;
  }
}

async function checkBalance() {
  const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, wallet);
  const balance = await usdcContract.balanceOf(wallet.address);
  const decimals = await usdcContract.decimals();
  console.log(
    `💰 USDC Balance: ${ethers.utils.formatUnits(balance, decimals)}`.cyan
  );

  const monBalance = await provider.getBalance(wallet.address);
  console.log(`💰 MON Balance: ${ethers.utils.formatEther(monBalance)}`.cyan);
}

async function performRandomSwap() {
  // Random pilih antara MON ke USDC atau USDC ke MON
  const isMonToUsdc = Math.random() < 0.5;

  if (isMonToUsdc) {
    // MON ke USDC (0.001 - 0.01 MON)
    const randomAmount = getRandomAmount(0.001, 0.01);
    console.log(
      `\n🎲 Random swap MON ke USDC: ${randomAmount.toFixed(6)} MON`.yellow
    );
    const amount = ethers.utils.parseEther(randomAmount.toFixed(6));
    return await swapMonToUsdc(amount);
  } else {
    // USDC ke MON (0.1 - 1 USDC)
    const randomAmount = getRandomAmount(0.1, 1);
    console.log(
      `\n🎲 Random swap USDC ke MON: ${randomAmount.toFixed(6)} USDC`.yellow
    );
    return await swapUsdcToMon(randomAmount.toFixed(6));
  }
}

async function main() {
  console.log(`\n🚀 Bean Random Swap Bot - MON <> USDC`.green);

  // Tampilkan balance
  await checkBalance();

  // Menu pilihan
  const choices = [
    { title: "Mulai Random Swap", value: "random_swap" },
    { title: "Swap Manual MON ke USDC", value: "mon_to_usdc" },
    { title: "Swap Manual USDC ke MON", value: "usdc_to_mon" },
    { title: "Exit", value: "exit" },
  ];

  while (true) {
    const response = await prompts({
      type: "select",
      name: "action",
      message: "Pilih aksi yang ingin dilakukan:",
      choices: choices,
    });

    if (!response.action || response.action === "exit") {
      console.log("👋 Terima kasih telah menggunakan Bean Swap Bot!".green);
      break;
    }

    if (response.action === "random_swap") {
      const countResponse = await prompts({
        type: "number",
        name: "count",
        message: "Berapa kali ingin melakukan random swap?",
        initial: 5,
      });

      const delayResponse = await prompts({
        type: "number",
        name: "delay",
        message: "Berapa detik jeda antar swap? (minimal 15)",
        initial: 20,
        validate: (value) => (value >= 15 ? true : "Minimal jeda 15 detik"),
      });

      console.log(
        `\n🚀 Memulai ${countResponse.count}x random swap dengan jeda ${delayResponse.delay} detik`
          .green
      );

      for (let i = 0; i < countResponse.count; i++) {
        console.log(`\n📍 Random Swap ${i + 1}/${countResponse.count}:`.yellow);
        const success = await performRandomSwap();

        // Tampilkan balance setelah swap
        if (success) {
          console.log("\n📊 Balance setelah swap:".yellow);
          await checkBalance();
        }

        if (i < countResponse.count - 1) {
          console.log(
            `\n⏳ Menunggu ${delayResponse.delay} detik sebelum swap berikutnya...`
              .yellow
          );
          await new Promise((resolve) =>
            setTimeout(resolve, delayResponse.delay * 1000)
          );
        }
        console.log("\n" + "=".repeat(50) + "\n");
      }
    } else if (response.action === "mon_to_usdc") {
      const amountResponse = await prompts({
        type: "number",
        name: "amount",
        message: "Masukkan jumlah MON yang ingin di-swap (0.001 - 0.01):",
        initial: 0.005,
        validate: (value) =>
          value >= 0.001 && value <= 0.01
            ? true
            : "Jumlah harus antara 0.001 - 0.01",
      });
      const amount = ethers.utils.parseEther(amountResponse.amount.toString());
      await swapMonToUsdc(amount);
    } else if (response.action === "usdc_to_mon") {
      const amountResponse = await prompts({
        type: "number",
        name: "amount",
        message: "Masukkan jumlah USDC yang ingin di-swap (0.1 - 1):",
        initial: 0.5,
        validate: (value) =>
          value >= 0.1 && value <= 1 ? true : "Jumlah harus antara 0.1 - 1",
      });
      await swapUsdcToMon(amountResponse.amount);
    }

    // Tampilkan balance setelah swap manual
    if (response.action !== "random_swap") {
      console.log("\n📊 Balance setelah swap:".yellow);
      await checkBalance();
      console.log("\n" + "=".repeat(50) + "\n");
    }
  }
}

main().catch(console.error);
