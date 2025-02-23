require("dotenv").config();
const { ethers } = require("ethers");
const colors = require("colors");
const prompts = require("prompts");

const RPC_URL = "https://testnet-rpc.monad.xyz/";
const EXPLORER_URL = "https://testnet.monadexplorer.com/tx/";

// Contract addresses
const ROUTER_ADDRESS = "0xca810d095e90daae6e867c19df6d9a8c56db2c89";
const WMON_ADDRESS = "0x760afe86e5de5fa0ee542fc7b7b713e1c5425701";

// Daftar token yang didukung
const TOKENS = {
  USDC: {
    address: "0xf817257fed379853cde0fa4f97ab987181b1e5ea",
    symbol: "USDC",
    name: "USD Coin",
    minAmount: 0.01,
    maxAmount: 1,
    decimals: 6,
  },
  USDT: {
    address: "0x88b8E2161DEDC77EF4ab7585569D2415a1C1055D",
    symbol: "USDT",
    name: "Tether USD",
    minAmount: 0.01,
    maxAmount: 1,
    decimals: 6,
  },
  WETH: {
    address: "0xB5a30b0FDc5EA94A52fDc42e3E9760Cb8449Fb37",
    symbol: "WETH",
    name: "Wrapped ETH",
    minAmount: 0.0000001,
    maxAmount: 0.000001,
    decimals: 18,
    retryDelay: 5000, // delay in ms before retry
    maxRetries: 3, // maksimum jumlah retry
  },
};

// Initialize provider dan wallet
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// ABI untuk approve token
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
];

// Fungsi untuk mendapatkan angka random antara min dan max
function getRandomAmount(min, max) {
  return Math.random() * (max - min) + min;
}

async function approveToken(tokenAddress, amount) {
  try {
    console.log("🔄 Mengecek approval token...".yellow);

    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
    const symbol = await tokenContract.symbol();
    const decimals = await tokenContract.decimals();
    const amountInDecimals = ethers.utils.parseUnits(
      amount.toString(),
      decimals
    );

    const allowance = await tokenContract.allowance(
      wallet.address,
      ROUTER_ADDRESS
    );
    if (allowance.lt(amountInDecimals)) {
      console.log(`🔄 Melakukan approve ${symbol}...`.yellow);
      const tx = await tokenContract.approve(
        ROUTER_ADDRESS,
        ethers.constants.MaxUint256
      );
      await tx.wait();
      console.log(`✅ ${symbol} berhasil diapprove`.green);
    } else {
      console.log(`✅ ${symbol} sudah diapprove sebelumnya`.green);
    }
    return amountInDecimals;
  } catch (error) {
    console.error("❌ Approve gagal:".red, error.message);
    throw error;
  }
}

async function retryOperation(operation, maxRetries = 3, delay = 5000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (
        error.message.includes("bad response") ||
        error.message.includes("SERVER_ERROR")
      ) {
        if (i < maxRetries - 1) {
          console.log(
            `❌ RPC Node error, mencoba ulang dalam ${delay / 1000} detik... (Percobaan ${i + 1}/${maxRetries})`
              .yellow
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }
      throw error;
    }
  }
  throw new Error("Maksimum retry tercapai");
}

async function checkTokenAvailability(token) {
  const operation = async () => {
    const tokenContract = new ethers.Contract(token.address, ERC20_ABI, wallet);
    await tokenContract.balanceOf(wallet.address);
    return true;
  };

  try {
    return await retryOperation(
      operation,
      token.maxRetries || 3,
      token.retryDelay || 5000
    );
  } catch (error) {
    console.log(
      `⚠️ Token ${token.symbol} tidak tersedia: ${error.message}`.yellow
    );
    return false;
  }
}

async function swapTokenToMon(tokenSymbol, amount) {
  const token = TOKENS[tokenSymbol];
  try {
    // Cek dulu apakah token bisa diakses
    const tokenContract = new ethers.Contract(token.address, ERC20_ABI, wallet);
    await tokenContract.balanceOf(wallet.address); // Test if token is accessible

    console.log(`🔄 Swapping ${amount} ${tokenSymbol} to MON...`.yellow);

    // Approve dulu
    const amountInDecimals = await approveToken(token.address, amount);

    // Method swapExactTokensForETH
    const data = ethers.utils.hexConcat([
      "0x18cbafe5", // swapExactTokensForETH
      ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256", "address[]", "address", "uint256"],
        [
          amountInDecimals, // amountIn
          0, // amountOutMin
          [token.address, WMON_ADDRESS], // path
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

async function swapMonToToken(tokenSymbol, amountIn) {
  const token = TOKENS[tokenSymbol];
  try {
    console.log(
      `🔄 Swapping ${ethers.utils.formatEther(amountIn)} MON to ${tokenSymbol}...`
        .yellow
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
          [WMON_ADDRESS, token.address], // path swap
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
  console.log("\n💰 Balance:".cyan);

  try {
    // Check MON balance
    const monBalance = await provider.getBalance(wallet.address);
    console.log(`MON: ${ethers.utils.formatEther(monBalance)}`.cyan);

    // Check semua token balance
    for (const [symbol, token] of Object.entries(TOKENS)) {
      try {
        const tokenContract = new ethers.Contract(
          token.address,
          ERC20_ABI,
          wallet
        );
        const balance = await tokenContract.balanceOf(wallet.address);
        console.log(
          `${symbol}: ${ethers.utils.formatUnits(balance, token.decimals)}`.cyan
        );
      } catch (error) {
        console.log(`${symbol}: Error membaca balance`.red);
        console.error(`Error detail untuk ${symbol}:`.red, error.message);
      }
    }
  } catch (error) {
    console.error("❌ Error mengecek balance:".red, error.message);
  }
}

async function performRandomSwap() {
  try {
    // Random pilih antara MON ke Token atau Token ke MON
    const isMonToToken = Math.random() < 0.5;

    // Random pilih token yang berfungsi
    const tokenSymbols = Object.keys(TOKENS);
    let availableTokens = [];

    // Cek token yang tersedia
    for (const symbol of tokenSymbols) {
      const token = TOKENS[symbol];
      if (await checkTokenAvailability(token)) {
        availableTokens.push(symbol);
      }
    }

    if (availableTokens.length === 0) {
      console.log("❌ Tidak ada token yang tersedia untuk swap".red);
      return false;
    }

    const randomTokenSymbol =
      availableTokens[Math.floor(Math.random() * availableTokens.length)];
    const token = TOKENS[randomTokenSymbol];

    if (isMonToToken) {
      // MON ke Token (0.001 - 0.01 MON)
      const randomAmount = getRandomAmount(0.001, 0.01);
      console.log(
        `\n🎲 Random swap MON ke ${randomTokenSymbol}: ${randomAmount.toFixed(6)} MON`
          .yellow
      );
      const amount = ethers.utils.parseEther(randomAmount.toFixed(6));
      return await swapMonToToken(randomTokenSymbol, amount);
    } else {
      // Token ke MON
      const randomAmount = getRandomAmount(token.minAmount, token.maxAmount);
      console.log(
        `\n🎲 Random swap ${randomTokenSymbol} ke MON: ${randomAmount.toFixed(6)} ${randomTokenSymbol}`
          .yellow
      );
      return await swapTokenToMon(randomTokenSymbol, randomAmount.toFixed(6));
    }
  } catch (error) {
    console.error("❌ Error dalam random swap:".red, error.message);
    return false;
  }
}

async function main() {
  console.log(`\n🚀 Bean Random Swap Bot - Multi Token`.green);

  // Tampilkan balance
  await checkBalance();

  // Menu pilihan
  const choices = [
    { title: "Mulai Random Swap", value: "random_swap" },
    { title: "Swap Manual MON ke Token", value: "mon_to_token" },
    { title: "Swap Manual Token ke MON", value: "token_to_mon" },
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
    } else if (response.action === "mon_to_token") {
      // Pilih token tujuan
      const tokenChoices = Object.entries(TOKENS).map(([symbol, token]) => ({
        title: `${token.name} (${symbol})`,
        value: symbol,
      }));

      const tokenResponse = await prompts({
        type: "select",
        name: "token",
        message: "Pilih token tujuan:",
        choices: tokenChoices,
      });

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
      await swapMonToToken(tokenResponse.token, amount);
    } else if (response.action === "token_to_mon") {
      // Pilih token sumber
      const tokenChoices = Object.entries(TOKENS).map(([symbol, token]) => ({
        title: `${token.name} (${symbol})`,
        value: symbol,
      }));

      const tokenResponse = await prompts({
        type: "select",
        name: "token",
        message: "Pilih token sumber:",
        choices: tokenChoices,
      });

      const token = TOKENS[tokenResponse.token];
      const amountResponse = await prompts({
        type: "number",
        name: "amount",
        message: `Masukkan jumlah ${tokenResponse.token} yang ingin di-swap (${token.minAmount} - ${token.maxAmount}):`,
        initial: (token.minAmount + token.maxAmount) / 2,
        validate: (value) =>
          value >= token.minAmount && value <= token.maxAmount
            ? true
            : `Jumlah harus antara ${token.minAmount} - ${token.maxAmount}`,
      });

      await swapTokenToMon(tokenResponse.token, amountResponse.amount);
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
