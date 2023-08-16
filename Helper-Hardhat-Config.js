const { ethers } = require("hardhat")

const networkConfig = {
    11155111: {
        name: "sepolia",
        fees: ethers.parseEther("0.01"),
        interval: 60,
        vrfCoordinator: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625",
        gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
        subId: "4557",
        callbackGasLimit: "2500000"
    },

    31337: {
        name: "hardhat",
        fees: ethers.parseEther("0.01"),
        interval: 60,
        gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
        callbackGasLimit: "2500000"
    }
}

const localNetworks = ["hardhat", "localhost"]

module.exports = { networkConfig, localNetworks }