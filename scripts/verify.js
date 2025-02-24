const fs = require("fs");
const path = require("path");
const FormData = require("form-data");
const axios = require("axios");

async function main() {
  const contractAddress = "0x1422a7114DC23BC1473D86378D89a1EE134a0f6c";
  const chainId = "10143";
  const contractPath = path.join(__dirname, "../contracts/MonadSwap.sol");
  const metadataPath = path.join(
    __dirname,
    "../artifacts/contracts/MonadSwap.sol/MonadSwap.json"
  );

  // Compile kontrak terlebih dahulu
  const { execSync } = require("child_process");
  execSync("npx hardhat compile", { stdio: "inherit" });

  const contractSource = fs.readFileSync(contractPath, "utf8");
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));

  const formData = new FormData();
  formData.append("address", contractAddress);
  formData.append("chain", chainId);
  formData.append("files", Buffer.from(contractSource), "MonadSwap.sol");
  formData.append(
    "files",
    Buffer.from(JSON.stringify(metadata)),
    "metadata.json"
  );

  try {
    const response = await axios.post(
      "https://sourcify-api-monad.blockvision.org/verify",
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          "Content-Type": "multipart/form-data",
        },
      }
    );

    console.log("Verification response:", response.data);
    console.log("\nContract verified! View on explorer:");
    console.log(`https://testnet.monadexplorer.com/address/${contractAddress}`);
  } catch (error) {
    console.error(
      "Verification failed:",
      error.response?.data || error.message
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
