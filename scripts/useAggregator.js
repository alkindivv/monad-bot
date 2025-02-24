require("dotenv").config();
const { ethers } = require("ethers");
const colors = require("colors");
const prompts = require("prompts");

// Network configuration
const NETWORK_CONFIG = {
  url: "https://testnet-rpc.monad.xyz/",
  chainId: 10143,
  name: "Monad Testnet",
};

const EXPLORER_URL = "https://testnet.monadexplorer.com/tx/";

// Contract addresses
const AGGREGATOR_ADDRESS = "0x1D89835BF9733C6617EF43b082795961a5963a4D";

// Daftar token yang didukung
const TOKENS = {
  USDC: {
    address: "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  USDT: {
    address: "0x88b8E2161DEDC77EF4ab7585569D2415a1C1055D",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
  },
  WETH: {
    address: "0xB5a30b0FDc5EA94A52fDc42e3E9760Cb8449Fb37",
    symbol: "WETH",
    name: "Wrapped ETH",
    decimals: 18,
  },
};

// ABI untuk MonadSwapAggregator
const AGGREGATOR_ABI = [
  "function getAmountOut(address fromToken, address toToken, uint256 amountIn) public view returns (uint256 amountOut)",
  "function swap(address fromToken, address toToken, uint256 amountIn, uint256 amountOutMin) external returns (uint256 amountOut)",
  "function calculateFee(uint256 amount) public pure returns (uint256)",
];

// ABI untuk ERC20
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
];

// DEX Router addresses
const BEAN_ROUTER = "0xCa810D095e90Daae6e867c19DF6D9A8C56db2c89";
const AMBIENT_ROUTER = "0x88B96aF200c8a9c35442C8AC6cd3D22695AaE4F0";

// Initialize provider dan wallet
let provider = new ethers.providers.JsonRpcProvider(NETWORK_CONFIG.url);
let wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

async function retryOperation(operation, maxRetries = 3, delay = 5000) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (
        error.code === "SERVER_ERROR" ||
        error.message.includes("bad response")
      ) {
        console.log(
          `\n⚠️ RPC Error, mencoba ulang dalam ${
            delay / 1000
          } detik... (Percobaan ${i + 1}/${maxRetries})`.yellow
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }

  console.log("\n❌ RPC tidak merespon. Silakan coba lagi nanti.".red);
  throw lastError;
}

async function checkBalance(wallet) {
  console.log("\n💰 Balance:".cyan);

  for (const [symbol, token] of Object.entries(TOKENS)) {
    try {
      const tokenContract = new ethers.Contract(
        token.address,
        ERC20_ABI,
        wallet
      );
      const balance = await retryOperation(() =>
        tokenContract.balanceOf(wallet.address)
      );
      console.log(
        `${symbol}: ${ethers.utils.formatUnits(balance, token.decimals)}`.cyan
      );
    } catch (error) {
      console.log(`${symbol}: Error membaca balance - ${error.message}`.red);
    }
  }
}

async function approveToken(wallet, tokenAddress) {
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
  const symbol = await tokenContract.symbol();

  console.log(`\n🔄 Checking approvals for ${symbol}...`.yellow);

  // Check allowance untuk kedua DEX
  const [aggregatorAllowance, beanAllowance, ambientAllowance] =
    await Promise.all([
      tokenContract.allowance(wallet.address, AGGREGATOR_ADDRESS),
      tokenContract.allowance(wallet.address, BEAN_ROUTER),
      tokenContract.allowance(wallet.address, AMBIENT_ROUTER),
    ]);

  // Approve jika allowance kurang
  if (aggregatorAllowance.lt(ethers.constants.MaxUint256.div(2))) {
    console.log(`🔄 Approving ${symbol} for Aggregator...`.yellow);
    const tx = await tokenContract.approve(
      AGGREGATOR_ADDRESS,
      ethers.constants.MaxUint256
    );
    console.log(`Transaction hash: ${EXPLORER_URL}${tx.hash}`.cyan);
    await tx.wait();
    console.log(`✅ ${symbol} approved for Aggregator`.green);
  }

  if (beanAllowance.lt(ethers.constants.MaxUint256.div(2))) {
    console.log(`🔄 Approving ${symbol} for Bean DEX...`.yellow);
    const tx = await tokenContract.approve(
      BEAN_ROUTER,
      ethers.constants.MaxUint256
    );
    console.log(`Transaction hash: ${EXPLORER_URL}${tx.hash}`.cyan);
    await tx.wait();
    console.log(`✅ ${symbol} approved for Bean DEX`.green);
  }

  if (ambientAllowance.lt(ethers.constants.MaxUint256.div(2))) {
    console.log(`🔄 Approving ${symbol} for Ambient DEX...`.yellow);
    const tx = await tokenContract.approve(
      AMBIENT_ROUTER,
      ethers.constants.MaxUint256
    );
    console.log(`Transaction hash: ${EXPLORER_URL}${tx.hash}`.cyan);
    await tx.wait();
    console.log(`✅ ${symbol} approved for Ambient DEX`.green);
  }
}

async function checkRate(wallet, fromToken, toToken, amount) {
  const aggregator = new ethers.Contract(
    AGGREGATOR_ADDRESS,
    AGGREGATOR_ABI,
    wallet
  );
  const amountIn = ethers.utils.parseUnits(
    amount.toString(),
    fromToken.decimals
  );

  console.log("\n🔍 Checking rate...".yellow);

  try {
    const amountOut = await retryOperation(() =>
      aggregator.getAmountOut(fromToken.address, toToken.address, amountIn)
    );

    // Validasi output amount
    if (amountOut.isZero()) {
      throw new Error("No liquidity available");
    }

    const fee = await aggregator.calculateFee(amountOut);
    const amountOutAfterFee = amountOut.sub(fee);

    console.log("\n📊 Swap Details:".cyan);
    console.log(`Input: ${amount} ${fromToken.symbol}`.cyan);
    console.log(
      `Output (before fee): ${ethers.utils.formatUnits(
        amountOut,
        toToken.decimals
      )} ${toToken.symbol}`.cyan
    );
    console.log(
      `Fee (2%): ${ethers.utils.formatUnits(fee, toToken.decimals)} ${
        toToken.symbol
      }`.cyan
    );
    console.log(
      `Output (after fee): ${ethers.utils.formatUnits(
        amountOutAfterFee,
        toToken.decimals
      )} ${toToken.symbol}`.cyan
    );

    return { amountOut, amountOutAfterFee };
  } catch (error) {
    console.log("\n❌ Error checking rate:".red, error.message);
    throw error;
  }
}

async function performSwap(wallet) {
  const aggregator = new ethers.Contract(
    AGGREGATOR_ADDRESS,
    AGGREGATOR_ABI,
    wallet
  );

  try {
    // Tampilkan balance
    await checkBalance(wallet);

    // Pilih token sumber
    console.log("\nPilih token sumber:");
    Object.entries(TOKENS).forEach(([symbol], index) => {
      console.log(`${index + 1}. ${symbol}`);
    });

    const fromTokenIndex = await prompt("Pilih token sumber (1-3): ");
    const fromToken = Object.values(TOKENS)[fromTokenIndex - 1];

    // Pilih token tujuan
    console.log("\nPilih token tujuan:");
    Object.entries(TOKENS)
      .filter((_, index) => index !== fromTokenIndex - 1)
      .forEach(([symbol], index) => {
        console.log(`${index + 1}. ${symbol}`);
      });

    const toTokenIndex = await prompt("Pilih token tujuan (1-2): ");
    const toToken = Object.values(TOKENS).filter(
      (_, index) => index !== fromTokenIndex - 1
    )[toTokenIndex - 1];

    // Input jumlah
    const amount = await prompt(`\nMasukkan jumlah ${fromToken.symbol}: `);
    const amountIn = ethers.utils.parseUnits(amount, fromToken.decimals);

    // Check dan approve token
    await approveToken(wallet, fromToken.address);

    // Check rate dan validasi
    const { amountOutAfterFee } = await checkRate(
      wallet,
      fromToken,
      toToken,
      amount
    );

    if (amountOutAfterFee.isZero()) {
      throw new Error("Output amount is zero");
    }

    // Konfirmasi swap
    const confirm = await prompt("\nLanjutkan swap? (y/n): ");
    if (confirm.toLowerCase() !== "y") {
      console.log("Swap dibatalkan".yellow);
      return;
    }

    // Execute swap dengan slippage 10%
    console.log("\n🔄 Executing swap...".yellow);
    const minAmountOut = amountOutAfterFee.mul(90).div(100); // 10% slippage

    console.log("\n📊 Swap Parameters:".cyan);
    console.log(
      `Minimum output: ${ethers.utils.formatUnits(
        minAmountOut,
        toToken.decimals
      )} ${toToken.symbol}`.cyan
    );

    const tx = await retryOperation(() =>
      aggregator.swap(
        fromToken.address,
        toToken.address,
        amountIn,
        minAmountOut,
        { gasLimit: 1000000 } // Increased gas limit
      )
    );

    console.log(`Transaction hash: ${EXPLORER_URL}${tx.hash}`.cyan);
    console.log("Menunggu konfirmasi...".yellow);
    const receipt = await tx.wait();

    if (receipt.status === 1) {
      console.log("\n✅ Swap berhasil!".green);
      // Tampilkan balance setelah swap
      await checkBalance(wallet);
    } else {
      throw new Error("Transaction failed");
    }
  } catch (error) {
    console.log("\n❌ Error detail:".red);
    console.error(error.message);
    if (error.transaction) {
      console.log("Transaction data:", error.transaction.data);
      console.log("Gas limit:", error.transaction.gasLimit.toString());
    }
  }
}

function prompt(question) {
  const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    readline.question(question, (answer) => {
      readline.close();
      resolve(answer);
    });
  });
}

async function main() {
  console.log("\n🚀 MonadSwap Aggregator - Best Rate Swapper".green);
  console.log("\nWallet address:", wallet.address);

  const actions = {
    1: checkBalance,
    2: performSwap,
  };

  while (true) {
    console.log("\n📋 Menu:".green);
    console.log("1. Check Balance");
    console.log("2. Swap Tokens");
    console.log("3. Exit");

    const choice = await prompt("\nPilih menu (1-3): ");

    if (choice === "3") {
      console.log(
        "\n👋 Terima kasih telah menggunakan MonadSwap Aggregator!".green
      );
      break;
    }

    if (actions[choice]) {
      await actions[choice](wallet);
    } else {
      console.log("Menu tidak valid".red);
    }
  }
}

main().catch(console.error);
