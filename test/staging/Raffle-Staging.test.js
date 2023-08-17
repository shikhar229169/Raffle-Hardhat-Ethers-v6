const { ethers, network, getNamedAccounts, deployments } = require("hardhat");
const { localNetworks } = require("../../Helper-Hardhat-Config.js")
const { assert, expect } = require("chai")

localNetworks.includes(network.name)
    ? describe.skip :
    describe("Raffle Testing", () => {
        let raffle
        let signer
        let entranceFees

        beforeEach(async() => {
            const { deployer } = await getNamedAccounts()
            signer = await ethers.getSigner(deployer)

            const _raffle = await deployments.get("Raffle")
            console.log("Raffle Contract Address -", _raffle.address)

            // My Deployed Raffle Address: 0x28F096cB7dA06c27D51B4d5de43AA9563d2aC9Ca
            raffle = await ethers.getContractAt("Raffle", _raffle.address, signer)
            
            entranceFees = await raffle.getRaffleFees()
            console.log("Entrance Fees -", entranceFees)
        })

        describe("Raffle Working", () => {
            it("Enters the lottery, random words requested and fulfilled and winner is chosen", async() => {
                let initRound = await raffle.getCurrentRound()
                let initRaffleBalance = await ethers.provider.getBalance(raffle.target)
                let initTimestamp = await raffle.getLastTimestamp()

                await new Promise(async(resolve, reject) => {
                    raffle.once("WinnerSelected", async() => {
                        try {
                            const winner = await raffle.getRecentWinner()
                            const newRound = await raffle.getCurrentRound()
                            const raffleState = await raffle.getRaffleState()
                            const raffleBalance = await ethers.provider.getBalance(raffle.target)
                            const winnerFinalBalance = await ethers.provider.getBalance(winner)
                            const finalTimestamp = await raffle.getLastTimestamp()
                            
                            assert.equal(newRound, initRound + BigInt(1))
                            assert.equal(raffleState, 0)
                            assert.equal(raffleBalance, 0)
                            // assert.equal(winnerFinalBalance, initBalances[winner] + initRaffleBalance)
                            assert(finalTimestamp > initTimestamp)
                            await expect(raffle.getParticipant(0)).to.be.reverted
                            
                            console.log("Winner is -", winner)
                            console.log("Final Balance - ", winnerFinalBalance)
                            resolve()
                        }
                        catch (err) {
                            reject(err)
                        }
                    })

                    console.log("Init Balance -", await ethers.provider.getBalance(signer.address))

                    console.log("Here")
                    const enterRaffleResponse = await raffle.enterRaffle({ value: entranceFees })
                    console.log("Here")
                    await enterRaffleResponse.wait(1)
                })
            })
        })
    })