const { run } = require("hardhat")

const verifyContract = async(contractAddress, args) => {
    try {
        console.log("Verifying the contract....")

        await run("verify:verify", {
            address: contractAddress,
            constructorArguments: args
        })
    }
    catch (err) {
        if (err.message.toLowerCase().includes("already verified")) {
            console.log("The contract has already been verified")
        }
        else {
            console.log(err)
        }
    }
}

module.exports = { verifyContract }