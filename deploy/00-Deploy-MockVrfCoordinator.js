const { ethers, network } = require("hardhat");
const { localNetworks } = require("../Helper-Hardhat-Config.js")

const BASE_FEE = ethers.parseEther("0.25")
const GAS_PRICE_LINK = 1e9;

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    if (localNetworks.includes(network.name)) {
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            args: [BASE_FEE, GAS_PRICE_LINK],
            log: true,
        })
    }
}

module.exports.tags = ["mocks"]