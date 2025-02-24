// require("@nomicfoundation/hardhat-toolbox");
// require("@openzeppelin/hardhat-upgrades");
// require("dotenv").config();

// /** @type import('hardhat/config').HardhatUserConfig */
// module.exports = {
//   solidity: {
//     compilers: [
//       {
//         version: "0.8.22",
//         settings: {
//           optimizer: {
//             enabled: true,
//             runs: 200,
//           },
//         },
//       },
//     ],
//   },
//   paths: {
//     sources: "./contracts",
//     tests: "./test",
//     cache: "./cache",
//     artifacts: "./artifacts",
//   },
//   networks: {
//     monad: {
//       url: "https://testnet-rpc.monad.xyz/",
//       accounts: [process.env.PRIVATE_KEY],
//       chainId: 10143,
//     },
//   },
//   sourcify: {
//     enabled: true,
//     apiUrl: "https://sourcify-api-monad.blockvision.org",
//     browserUrl: "https://testnet.monadexplorer.com",
//   },
//   etherscan: {
//     enabled: false,
//   },
//   verifyURL: "https://testnet.monadexplorer.com/api",
// };

require("@nomiclabs/hardhat-waffle");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.22",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      metadata: {
        bytecodeHash: "none", // disable ipfs
        useLiteralContent: true, // store source code in the json file directly
      },
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    monad: {
      url: "https://testnet-rpc.monad.xyz/",
      accounts: [process.env.PRIVATE_KEY],
      chainId: 10143,
    },
  },
  sourcify: {
    enabled: true,
    apiUrl: "https://sourcify-api-monad.blockvision.org",
    browserUrl: "https://testnet.monadexplorer.com",
  },
  etherscan: {
    enabled: false,
  },
  verifyURL: "https://testnet.monadexplorer.com/api",
};
