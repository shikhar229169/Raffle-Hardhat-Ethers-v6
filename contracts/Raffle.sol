// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/interfaces/AutomationCompatibleInterface.sol";
import {VRFCoordinatorV2Interface} from "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import {VRFConsumerBaseV2} from "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";

contract Raffle is VRFConsumerBaseV2, AutomationCompatibleInterface {
    // Errors
    error Raffle__LessEthSent();
    error Raffle__UpkeepNotNeeded(uint256 intervalPassed, uint256 raffleBalance, RaffleState raffleState);
    error Raffle__NotOpen();
    error Raffle__EthTransferFailed();
    error Raffle__AlreadyEntered();

    enum RaffleState {
        OPEN,
        CALCULATING
    }

    // state variables
    uint256 private immutable i_fees;
    uint256 private immutable i_interval;
    uint256 private s_lastTimestamp;
    address[] private s_participants;
    mapping(address user => uint256 lastRoundPlayed) private userRound;
    uint256 private s_round;
    address private s_recentWinner;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;

    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subId;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private immutable i_callbackGasLimit;
    uint32 private constant NUM_WORDS = 1;

    RaffleState raffleState;

    // Esvents
    event EnteredRaffle(address indexed user, uint256 indexed amount, uint256 indexed round);
    event RequestedRandomWords(uint256 indexed requestId);
    event WinnerSelected(address indexed winner, uint256 indexed amountWon, uint256 indexed round);

    // constructor
    constructor(uint256 fees, uint256 interval, address vrfCoordinatorAddr, bytes32 gasLane, uint64 subId, uint32 callbackGasLimit) VRFConsumerBaseV2(vrfCoordinatorAddr) {
        i_fees = fees;
        i_interval = interval;
        s_recentWinner = address(0);
        s_lastTimestamp = block.timestamp;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorAddr);
        i_gasLane = gasLane;
        i_subId = subId;
        i_callbackGasLimit = callbackGasLimit;
        raffleState = RaffleState.OPEN;
        s_round = 1;
    }


    /**@notice Allows a user to enter the raffle
     * @dev A user must send at least the amount of fees to enter the raffle
     * @dev A user can only enter the raffle once per round
     * @dev A user can only enter the raffle if it is open
    */
    function enterRaffle() external payable {
        if (raffleState == RaffleState.CALCULATING) {
            revert Raffle__NotOpen();
        }

        if (userRound[msg.sender] == s_round) {
            revert Raffle__AlreadyEntered();
        }

        if (msg.value < i_fees) {
            revert Raffle__LessEthSent();
        }


        s_participants.push(msg.sender);
        userRound[msg.sender] = s_round;

        emit EnteredRaffle(msg.sender, msg.value, s_round);
    }

    function checkUpkeep(bytes memory /* checkData */) public view returns (bool upkeepNeeded, bytes memory performData) {
        bool hasBalance = (address(this).balance > 0);
        bool intervalPassed = (block.timestamp - s_lastTimestamp >= i_interval);
        bool isOpen = (raffleState == RaffleState.OPEN);

        upkeepNeeded = (hasBalance && intervalPassed && isOpen);
        performData = "";
    }

    function performUpkeep(bytes calldata /* performData */) external {
        (bool upkeepNeeded, ) = checkUpkeep("");

        if (!upkeepNeeded) {
            revert Raffle__UpkeepNotNeeded(block.timestamp - s_lastTimestamp, address(this).balance, raffleState);
        }

        raffleState = RaffleState.CALCULATING;

        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );

        emit RequestedRandomWords(requestId);
    }

    function fulfillRandomWords(uint256 /* requestId */, uint256[] memory randomWords) internal override {
        uint256 randomNumber = randomWords[0] % s_participants.length;
        address winner = s_participants[randomNumber];

        emit WinnerSelected(winner, address(this).balance, s_round);

        (bool success, ) = payable(winner).call{value: address(this).balance}("");

        if (!success) {
            revert Raffle__EthTransferFailed();
        }

        s_recentWinner = winner;
        s_round += 1;
        s_participants = new address[](0);
        s_lastTimestamp = block.timestamp;
        raffleState = RaffleState.OPEN;
    }

    function getRecentWinner() external view returns (address) {
        return s_recentWinner;
    }

    function getCurrentRound() external view returns (uint256) {
        return s_round;
    }

    function getParticipant(uint256 idx) external view returns (address) {
        return s_participants[idx];
    }

    function getAllParticipants() external view returns (address[] memory) {
        return s_participants;
    }

    function getParticipantsLength() external view returns (uint256) {
        return s_participants.length;
    }

    function getUserLastRoundPlayed(address user) external view returns (uint256) {
        return userRound[user];
    }    

    function getLastTimestamp() external view returns (uint256) {
        return s_lastTimestamp;
    }

    function getRaffleFees() external view returns (uint256) {
        return i_fees;
    }   

    function getInterval() external view returns (uint256) {
        return i_interval;
    }

    function getVrfCoordinator() external view returns (address) {
        return address(i_vrfCoordinator);
    }

    function getGasLane() external view returns (bytes32) {
        return i_gasLane;
    }

    function getSubId() external view returns (uint64) {
        return i_subId;
    }   

    function getCallbackGasLimit() external view returns (uint32) {
        return i_callbackGasLimit;
    }

    function getRaffleState() external view returns (RaffleState) {
        return raffleState;
    }

    function getRequestConfirmations() external pure returns (uint16) {
        return REQUEST_CONFIRMATIONS;
    }

    function getNumWords() external pure returns (uint32) {
        return NUM_WORDS;
    }
}