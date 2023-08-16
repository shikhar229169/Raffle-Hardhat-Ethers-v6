const { ethers, network } = require("hardhat");
const { networkConfig, localNetworks } = require("../Helper-Hardhat-Config.js")
require("dotenv").config()
const { verifyContract } = require("../utils/verifyContract.js")

const FUND_AMT = ethers.parseEther("50")

module.exports = async({ deployments, getNamedAccounts }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const signer = await ethers.getSigner(deployer)
    const abi = new ethers.AbiCoder()

    const chainId = network.config.chainId
    const fees = networkConfig[chainId].fees
    const interval = networkConfig[chainId].interval
    const gasLane = networkConfig[chainId].gasLane
    const callbackGasLimit = networkConfig[chainId].callbackGasLimit
    let vrfCoordinator
    let vrfCoordinatorAddr
    let subId

    if (localNetworks.includes(network.name)) {
        const coordinator = await deployments.get("VRFCoordinatorV2Mock")
        vrfCoordinatorAddr = coordinator.address
        vrfCoordinator = await ethers.getContractAt("VRFCoordinatorV2Mock", coordinator.address, signer)

        const subTxn = await vrfCoordinator.createSubscription()
        const subResponse = await subTxn.wait(1)

        const _subId = subResponse.logs[0].topics[1]
        const data = abi.decode(["uint256"], _subId)
        subId = data[0]
        
        const fundTxn = await vrfCoordinator.fundSubscription(subId, FUND_AMT)
        await fundTxn.wait(1)
    }
    else {
        vrfCoordinatorAddr = networkConfig[chainId].vrfCoordinator
        subId = networkConfig[chainId].subId
    }
    
    const args = [fees, interval, vrfCoordinatorAddr, gasLane, subId, callbackGasLimit]

    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1
    })

    const _vrfCoordinator = await ethers.getContractAt("VRFCoordinatorV2", vrfCoordinatorAddr, signer)
    const consumerAddTxn = await _vrfCoordinator.addConsumer(subId, raffle.address)
    await consumerAddTxn.wait(1)

    if (!localNetworks.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        await verifyContract(raffle.address, args)
    }
}

module.exports.tags = ["main"]