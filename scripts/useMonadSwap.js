require("dotenv").config();
const { ethers } = require("ethers");
const colors = require("colors");

// Fungsi untuk retry jika terjadi error RPC
async function retryOperation(operation, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (
        error.code === "SERVER_ERROR" ||
        error.message.includes("bad response")
      ) {
        console.log(
          `\n⚠️ RPC Error, mencoba lagi dalam 5 detik... (${
            i + 1
          }/${maxRetries})`.yellow
        );
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries reached");
}

// Alamat kontrak dan token
const MONADSWAP_ADDRESS = "0x1422a7114DC23BC1473D86378D89a1EE134a0f6c";
const TOKENS = {
  USDC: {
    address: "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
    decimals: 6,
    symbol: "USDC",
  },
  USDT: {
    address: "0x88b8E2161DEDC77EF4ab7585569D2415a1C1055D",
    decimals: 6,
    symbol: "USDT",
  },
  WETH: {
    address: "0xB5a30b0FDc5EA94A52fDc42e3E9760Cb8449Fb37",
    decimals: 18,
    symbol: "WETH",
  },
};

// ABI untuk MonadSwap dan ERC20
const MONADSWAP_ABI = [
  "function swap(address fromToken, address toToken, uint256 amountIn) external returns (uint256 amountOut)",
  "function supportedPairs(address, address) external view returns (bool)",
  "function exchangeRates(address, address) external view returns (uint256)",
  "function depositToken(address token, uint256 amount) external",
  "function owner() external view returns (address)",
  "function calculateFee(uint256 amount) public pure returns (uint256)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
];

async function main() {
  // Setup provider dan wallet
  const provider = new ethers.providers.JsonRpcProvider(
    "https://testnet-rpc.monad.xyz/"
  );
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  // Inisialisasi kontrak
  const monadSwap = new ethers.Contract(
    MONADSWAP_ADDRESS,
    MONADSWAP_ABI,
    wallet
  );

  // Menu interaksi
  const actions = {
    1: checkBalance,
    2: approveToken,
    3: checkAllowance,
    4: performSwap,
    5: checkRate,
    6: depositToken,
  };

  console.log("\n🔄 MonadSwap Interaction Menu:".green);
  console.log("1. Check Balance");
  console.log("2. Approve Token");
  console.log("3. Check Allowance");
  console.log("4. Perform Swap");
  console.log("5. Check Rate");
  console.log("6. Deposit Token (Owner Only)");

  const action = await prompt("Pilih aksi (1-6): ");
  if (actions[action]) {
    await actions[action](wallet, monadSwap);
  } else {
    console.log("Aksi tidak valid".red);
  }
}

async function checkBalance(wallet) {
  console.log("\n💰 Balance:".cyan);

  for (const [symbol, token] of Object.entries(TOKENS)) {
    const tokenContract = new ethers.Contract(token.address, ERC20_ABI, wallet);
    const balance = await tokenContract.balanceOf(wallet.address);
    console.log(
      `${symbol}: ${ethers.utils.formatUnits(balance, token.decimals)}`.cyan
    );
  }
}

async function approveToken(wallet, monadSwap) {
  console.log("\n🔑 Token Approval:".yellow);

  // Pilih token
  console.log("Pilih token untuk approve:");
  Object.entries(TOKENS).forEach(([symbol], index) => {
    console.log(`${index + 1}. ${symbol}`);
  });

  const tokenIndex = await prompt("Pilih token (1-3): ");
  const token = Object.values(TOKENS)[tokenIndex - 1];

  if (!token) {
    console.log("Token tidak valid".red);
    return;
  }

  const tokenContract = new ethers.Contract(token.address, ERC20_ABI, wallet);

  try {
    const tx = await tokenContract.approve(
      MONADSWAP_ADDRESS,
      ethers.constants.MaxUint256
    );
    console.log(`Transaction hash: ${tx.hash}`.cyan);
    await tx.wait();
    console.log(`✅ ${token.symbol} berhasil diapprove`.green);
  } catch (error) {
    console.error("❌ Approve gagal:".red, error.message);
  }
}

async function checkAllowance(wallet, monadSwap) {
  console.log("\n👀 Token Allowance:".yellow);

  for (const [symbol, token] of Object.entries(TOKENS)) {
    const tokenContract = new ethers.Contract(token.address, ERC20_ABI, wallet);
    const allowance = await tokenContract.allowance(
      wallet.address,
      MONADSWAP_ADDRESS
    );
    console.log(
      `${symbol}: ${ethers.utils.formatUnits(allowance, token.decimals)}`.cyan
    );
  }
}

async function performSwap(wallet, monadSwap) {
  console.log("\n🔄 Perform Swap:".yellow);

  try {
    // Check balance MON dulu
    const monBalance = await retryOperation(() => wallet.getBalance());
    console.log(
      `\n💰 MON Balance: ${ethers.utils.formatEther(monBalance)}`.cyan
    );
    if (monBalance.lt(ethers.utils.parseEther("0.01"))) {
      console.log("❌ MON balance tidak cukup untuk gas".red);
      return;
    }

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

    if (!fromToken || !toToken) {
      console.log("Token tidak valid".red);
      return;
    }

    // Check balance token sumber dengan retry
    const tokenContract = new ethers.Contract(
      fromToken.address,
      ERC20_ABI,
      wallet
    );
    const tokenBalance = await retryOperation(() =>
      tokenContract.balanceOf(wallet.address)
    );
    console.log(
      `\n💰 ${fromToken.symbol} Balance: ${ethers.utils.formatUnits(
        tokenBalance,
        fromToken.decimals
      )}`.cyan
    );

    // Input jumlah
    const amount = await prompt(`\nMasukkan jumlah ${fromToken.symbol}: `);
    const amountIn = ethers.utils.parseUnits(amount, fromToken.decimals);

    // Validasi jumlah
    if (amountIn.gt(tokenBalance)) {
      console.log("❌ Balance tidak cukup".red);
      return;
    }

    // Check allowance dengan retry
    const allowance = await retryOperation(() =>
      tokenContract.allowance(wallet.address, MONADSWAP_ADDRESS)
    );
    console.log(
      `\n👀 Current allowance: ${ethers.utils.formatUnits(
        allowance,
        fromToken.decimals
      )} ${fromToken.symbol}`.cyan
    );

    if (allowance.lt(amountIn)) {
      console.log("\n🔄 Melakukan approve token...".yellow);
      const approveTx = await retryOperation(() =>
        tokenContract.approve(MONADSWAP_ADDRESS, ethers.constants.MaxUint256)
      );
      console.log(`Transaction hash (approve): ${approveTx.hash}`.cyan);
      await approveTx.wait();
      console.log("✅ Token berhasil diapprove".green);
    }

    // Get rate dan validasi dengan retry
    const rate = await retryOperation(() =>
      monadSwap.exchangeRates(fromToken.address, toToken.address)
    );
    if (rate.isZero()) {
      console.log("❌ Rate tidak valid (0)".red);
      return;
    }

    const amountOut = amountIn.mul(rate).div(ethers.constants.WeiPerEther);
    const feeAmount = await monadSwap.calculateFee(amountOut);
    const amountOutAfterFee = amountOut.sub(feeAmount);

    console.log(`\n📊 Swap Details:`.yellow);
    console.log(`Rate: ${ethers.utils.formatUnits(rate, 18)}`.cyan);
    console.log(`Input: ${amount} ${fromToken.symbol}`.cyan);
    console.log(
      `Expected output (before fee): ${ethers.utils.formatUnits(
        amountOut,
        toToken.decimals
      )} ${toToken.symbol}`.cyan
    );
    console.log(
      `Fee (2%): ${ethers.utils.formatUnits(feeAmount, toToken.decimals)} ${
        toToken.symbol
      }`.cyan
    );
    console.log(
      `Expected output (after fee): ${ethers.utils.formatUnits(
        amountOutAfterFee,
        toToken.decimals
      )} ${toToken.symbol}`.cyan
    );

    // Konfirmasi swap
    const confirm = await prompt("\nLanjutkan swap? (y/n): ");
    if (confirm.toLowerCase() !== "y") {
      console.log("Swap dibatalkan".yellow);
      return;
    }

    // Lakukan swap dengan retry
    console.log("\n🔄 Mengirim transaksi swap...".yellow);
    const tx = await retryOperation(() =>
      monadSwap.swap(fromToken.address, toToken.address, amountIn, {
        gasLimit: 500000,
      })
    );

    console.log(`\nTransaction hash: ${tx.hash}`.cyan);
    console.log("Menunggu konfirmasi...".yellow);

    const receipt = await tx.wait();

    if (receipt.status === 1) {
      console.log(`\n✅ Swap berhasil!`.green);
      console.log(`Gas used: ${receipt.gasUsed.toString()}`.cyan);

      // Parse events
      const events = receipt.logs
        .map((log) => {
          try {
            return monadSwap.interface.parseLog(log);
          } catch (e) {
            return null;
          }
        })
        .filter(Boolean);

      if (events.length > 0) {
        console.log("\n📊 Swap Events:".yellow);
        events.forEach((event) => {
          if (event.name === "TokenSwapped") {
            console.log(
              `Amount In: ${ethers.utils.formatUnits(
                event.args.amountIn,
                fromToken.decimals
              )} ${fromToken.symbol}`.cyan
            );
            console.log(
              `Amount Out: ${ethers.utils.formatUnits(
                event.args.amountOut,
                toToken.decimals
              )} ${toToken.symbol}`.cyan
            );
            console.log(
              `Fee: ${ethers.utils.formatUnits(
                event.args.feeAmount,
                toToken.decimals
              )} ${toToken.symbol}`.cyan
            );
          }
        });
      }

      console.log("\n📊 Balance setelah swap:".yellow);
      await checkBalance(wallet);
    } else {
      console.log(`\n❌ Transaksi gagal`.red);
      console.log(`Gas used: ${receipt.gasUsed.toString()}`.cyan);
    }
  } catch (error) {
    console.log("\n❌ Error detail:".red);
    if (error.reason) {
      console.error("Reason:", error.reason);
    }
    if (error.code) {
      console.error("Code:", error.code);
    }
    if (error.data) {
      console.error("Data:", error.data);
    }
    if (error.transaction) {
      console.error("Transaction data:", error.transaction.data);
    }
    console.error("Full error:", error);
  }
}

async function checkRate(wallet, monadSwap) {
  console.log("\n📊 Exchange Rates:".yellow);

  for (const [fromSymbol, fromToken] of Object.entries(TOKENS)) {
    for (const [toSymbol, toToken] of Object.entries(TOKENS)) {
      if (fromSymbol !== toSymbol) {
        try {
          const rate = await monadSwap.exchangeRates(
            fromToken.address,
            toToken.address
          );
          const formattedRate = ethers.utils.formatUnits(rate, 18);
          console.log(`${fromSymbol} -> ${toSymbol}: ${formattedRate}`.cyan);
        } catch (error) {
          console.log(`${fromSymbol} -> ${toSymbol}: Pair tidak didukung`.red);
        }
      }
    }
  }
}

async function depositToken(wallet, monadSwap) {
  console.log("\n💰 Deposit Token:".yellow);

  // Check if caller is owner
  const owner = await monadSwap.owner();
  if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.log("❌ Hanya owner yang bisa deposit token".red);
    return;
  }

  // Pilih token
  console.log("Pilih token untuk deposit:");
  Object.entries(TOKENS).forEach(([symbol], index) => {
    console.log(`${index + 1}. ${symbol}`);
  });

  const tokenIndex = await prompt("Pilih token (1-3): ");
  const token = Object.values(TOKENS)[tokenIndex - 1];

  if (!token) {
    console.log("Token tidak valid".red);
    return;
  }

  // Check balance
  const tokenContract = new ethers.Contract(token.address, ERC20_ABI, wallet);
  const balance = await tokenContract.balanceOf(wallet.address);
  console.log(
    `\n💰 ${token.symbol} Balance: ${ethers.utils.formatUnits(
      balance,
      token.decimals
    )}`.cyan
  );

  // Input jumlah
  const amount = await prompt(
    `\nMasukkan jumlah ${token.symbol} untuk deposit: `
  );
  const amountIn = ethers.utils.parseUnits(amount, token.decimals);

  // Check allowance
  const allowance = await tokenContract.allowance(
    wallet.address,
    MONADSWAP_ADDRESS
  );
  if (allowance.lt(amountIn)) {
    console.log("\n🔄 Melakukan approve token...".yellow);
    const approveTx = await tokenContract.approve(
      MONADSWAP_ADDRESS,
      ethers.constants.MaxUint256
    );
    console.log(`Transaction hash (approve): ${approveTx.hash}`.cyan);
    await approveTx.wait();
    console.log("✅ Token berhasil diapprove".green);
  }

  try {
    console.log("\n🔄 Mengirim transaksi deposit...".yellow);
    const tx = await monadSwap.depositToken(token.address, amountIn, {
      gasLimit: 300000,
    });
    console.log(`Transaction hash: ${tx.hash}`.cyan);
    console.log("Menunggu konfirmasi...".yellow);
    await tx.wait();
    console.log("\n✅ Deposit berhasil!".green);

    // Check balance kontrak
    const contractBalance = await tokenContract.balanceOf(MONADSWAP_ADDRESS);
    console.log(
      `\n💰 Contract ${token.symbol} Balance: ${ethers.utils.formatUnits(
        contractBalance,
        token.decimals
      )}`.cyan
    );
  } catch (error) {
    console.log("\n❌ Error detail:".red);
    console.error(error);
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

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
