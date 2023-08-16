const { ethers, network } = require("hardhat");
const helpers = require("@nomicfoundation/hardhat-network-helpers")
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers")
const { networkConfig, localNetworks } = require("../../Helper-Hardhat-Config.js")
const { assert, expect } = require("chai")

!localNetworks.includes(network.name)
    ? describe.skip :
    describe("Raffle Testing", () => {
        let raffle
        let vrfCoordinator
        let signer
        let accounts
        let chainId
        let fees
        let interval
        let gasLane
        let callbackGasLimit
        let abi

        beforeEach(async() => {
            const { deployer } = await getNamedAccounts()
            signer = await ethers.getSigner(deployer)

            const contracts = await deployments.fixture(["main", "mocks"])

            raffle = await ethers.getContractAt("Raffle", contracts["Raffle"].address, signer)
            vrfCoordinator = await ethers.getContractAt("VRFCoordinatorV2Mock", contracts["VRFCoordinatorV2Mock"].address, signer)

            accounts = await ethers.getSigners()
            chainId = network.config.chainId
            fees = networkConfig[chainId].fees
            interval = networkConfig[chainId].interval
            gasLane = networkConfig[chainId].gasLane
            callbackGasLimit = networkConfig[chainId].callbackGasLimit
            subId = networkConfig[chainId].subId
            abi = new ethers.AbiCoder()
        })

        describe("Constructor Testing", () => {
            it("Sets up State variable correctly", async() => {
                const actualFees = await raffle.getRaffleFees()
                const actualInterval = await raffle.getInterval()
                const actualVrfCoordinator = await raffle.getVrfCoordinator()
                const actualGasLane = await raffle.getGasLane()
                const actualCallbackGasLimit = await raffle.getCallbackGasLimit()

                assert.equal(actualFees, fees)
                assert.equal(actualInterval, interval)
                assert.equal(actualVrfCoordinator, vrfCoordinator.target)
                assert.equal(actualGasLane, gasLane)
                assert.equal(actualCallbackGasLimit, callbackGasLimit)
            })

            it("Initializes Lottery round and initially lottery is OPEN", async() => {
                const actualRound = await raffle.getCurrentRound()
                const actualState = await raffle.getRaffleState()

                assert.equal(actualRound, 1)
                assert.equal(actualState, 0)
            })
        })

        describe("Enter Raffle Testing", async() => {
            it("Reverts if less eth sent", async() => {
                await expect(raffle.enterRaffle()).to.be.revertedWithCustomError(raffle, "Raffle__LessEthSent")
            })

            it("Reverts if user has entered once in a round", async() => {
                const enterTxn = await raffle.enterRaffle({ value: fees })
                await enterTxn.wait(1)

                await expect(raffle.enterRaffle({ value: fees })).to.be.revertedWithCustomError(raffle, "Raffle__AlreadyEntered")
            })

            it("Reverts if lottery is not OPEN", async() => {
                const enterTxn = await raffle.enterRaffle({ value: fees})
                await enterTxn.wait(1)

                // at this point there is atleast one user in raffle, lottery is also open
                // but we need to pass enough interval to perform choose winner
                await ethers.provider.send("evm_increaseTime", [interval])
                await ethers.provider.send("evm_mine")

                // now we can choose winner ass every condition is satisfied

                const performTxn = await raffle.performUpkeep("0x")
                await performTxn.wait(1)

                await expect(raffle.enterRaffle({ value: fees })).to.be.revertedWithCustomError(raffle, "Raffle__NotOpen")
            })

            it("Allows user to enter Raffle, if conditions are matched and also updates the state", async() => {
                const userInitBalance = await ethers.provider.getBalance(signer.address)
                const raffleInitBalance = await ethers.provider.getBalance(raffle.target)

                const enterRaffleTxn = await raffle.enterRaffle({ value: fees })
                const receipt = await enterRaffleTxn.wait(1)

                const { gasUsed, gasPrice } = receipt
                const logsUser = abi.decode(["address"], receipt.logs[0].topics[1])
                const logsAmount = abi.decode(["uint256"], receipt.logs[0].topics[2])
                const logsRound = abi.decode(["uint256"], receipt.logs[0].topics[3])
                // console.table([logsUser, logsAmount, logsRound])


                const participant = await raffle.getParticipant(0)
                const userBalance = await ethers.provider.getBalance(signer.address)
                const raffleBalance = await ethers.provider.getBalance(raffle.target)
                const userLastPlayedRound = await raffle.getUserLastRoundPlayed(signer.address)
                
                assert.equal(participant, signer.address)
                assert.equal(raffleBalance, raffleInitBalance + fees)
                assert.equal(userBalance, userInitBalance - fees - (gasUsed * gasPrice))
                assert.equal(userLastPlayedRound, 1)
            })

            it("Emits event when user enters", async() => {
                await expect(raffle.enterRaffle({ value: fees })).to.emit(raffle, "EnteredRaffle").withArgs(signer.address, fees, 1)
            })
        })

        // 3 conditions - participants, interval passed, lottery OPEN
        describe("Check Upkeep Testing", async() => {
            it("Returns false if no one has entered the lottery", async() => {
                await ethers.provider.send("evm_increaseTime", [interval])
                await ethers.provider.send("evm_mine")

                const { upkeepNeeded } = await raffle.checkUpkeep("0x")
                assert(upkeepNeeded == false)
            })

            it("Returns false if interval has not passed", async() => {
                const response = await raffle.enterRaffle({ value: fees })
                await response.wait(1)

                const { upkeepNeeded } = await raffle.checkUpkeep("0x")
                assert(upkeepNeeded == false)
            })

            it("Returns false if raffle is in calculating state", async() => {
                const response = await raffle.enterRaffle({ value: fees })
                await response.wait(1)

                await ethers.provider.send("evm_increaseTime", [interval])
                await ethers.provider.send("evm_mine")

                const performTxn = await raffle.performUpkeep("0x")
                await performTxn.wait(1)

                // now raffle is in calculating state, but there are participants and interval has passed
                const { upkeepNeeded } = await raffle.checkUpkeep("0x")
                assert(upkeepNeeded == false)
            })

            it("Returns true if every condition is satisfied", async() => {
                const enterResponse = await raffle.enterRaffle({ value: fees })
                await enterResponse.wait(1)

                // await ethers.provider.send("evm_increaseTime", [interval])
                await helpers.time.increase(interval)
                // await ethers.provider.send("evm_mine")
                await helpers.mine()

                const { upkeepNeeded } = await raffle.checkUpkeep("0x")
                assert(upkeepNeeded == true)
            })
        })

        describe("Perform Upkeep Testing", async() => {
            it("Reverts if check upkeed not required", async() => {
                const response = await raffle.enterRaffle({ value: fees })
                await response.wait(1)

                await expect(raffle.performUpkeep("0x")).to.be.revertedWithCustomError(
                    raffle, "Raffle__UpkeepNotNeeded"
                )
            })

            it("Sends request to coordinator and emits request id", async() => {
                const enterResponse = await raffle.enterRaffle({ value: fees })
                await enterResponse.wait(1)

                helpers.time.increase(interval)
                helpers.mine()

                const upkeepResponse = await raffle.performUpkeep("0x")
                const upkeepReceipt = await upkeepResponse.wait(1)

                const eventArgsEncoded = upkeepReceipt.logs[1].topics[1]
                const eventArgs = abi.decode(["uint256"], eventArgsEncoded)
                const reqId = eventArgs[0]
                const raffleState = await raffle.getRaffleState()

                // console.log(reqId)
                const CALCULATING = 1
                assert(reqId > 0)
                assert.equal(raffleState, CALCULATING)
            })
        })

        describe("Fulfill Randomness Testing", async() => {
            it("Picks a winner, reward the winner and updates the state correctly", async() => {
                const initBalances = {

                }

                // Multiple participants in Raffle
                for (let i = 1; i <= 10; i++) {
                    const raffleInstance = await raffle.connect(accounts[i])

                    const enterResponse = await raffleInstance.enterRaffle({ value: fees })
                    await enterResponse.wait(1)

                    initBalances[accounts[i].address] = await ethers.provider.getBalance(accounts[i].address)
                }

                // Increase the interval and mine block
                helpers.time.increase(interval)
                helpers.mine()

                const initRaffleBalance = await ethers.provider.getBalance(raffle.target)
                const initRound = await raffle.getCurrentRound()
                const initTimestamp = await raffle.getLastTimestamp()
                
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
                            assert.equal(winnerFinalBalance, initBalances[winner] + initRaffleBalance)
                            assert(finalTimestamp > initTimestamp)
                            await expect(raffle.getParticipant(0)).to.be.reverted
                            
                            resolve()
                        }
                        catch (err) {
                            reject(err)
                        }
                    })

                    // Perform upkeep
                    const upkeepResponse = await raffle.performUpkeep("0x")
                    const upkeepReceipt = await upkeepResponse.wait(1)

                    const reqId = abi.decode(["uint256"], upkeepReceipt.logs[1].topics[1])

                    await vrfCoordinator.fulfillRandomWords(reqId[0], raffle.target)
                })
            })
        })
    })