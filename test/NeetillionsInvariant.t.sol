// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Neetillions} from "../src/Neetillions.sol";

/// @dev A separate accounting model tracks arbitrary sequences, including rejected operations.
contract NeetillionsHandler is Test {
    Neetillions private immutable token;
    address[4] private actors;
    mapping(address => uint256) public modelBalance;
    mapping(address => mapping(address => uint256)) public modelAllowance;

    constructor(Neetillions token_, address[4] memory actors_, uint256 supply) {
        token = token_;
        actors = actors_;
        modelBalance[actors_[0]] = supply;
    }

    function transfer(uint8 fromSeed, uint8 toSeed, uint256 amount) external {
        address from = actors[fromSeed % 4];
        address to = actors[toSeed % 4];
        amount = bound(amount, 0, modelBalance[from]);
        vm.prank(from);
        assertTrue(token.transfer(to, amount));
        modelBalance[from] -= amount;
        modelBalance[to] += amount;
    }

    function approve(uint8 ownerSeed, uint8 spenderSeed, uint256 amount) external {
        address owner = actors[ownerSeed % 4];
        address spender = actors[spenderSeed % 4];
        vm.prank(owner);
        assertTrue(token.approve(spender, amount));
        modelAllowance[owner][spender] = amount;
    }

    function transferFrom(uint8 ownerSeed, uint8 spenderSeed, uint8 toSeed, uint256 amount) external {
        address owner = actors[ownerSeed % 4];
        address spender = actors[spenderSeed % 4];
        address to = actors[toSeed % 4];
        uint256 approved = modelAllowance[owner][spender];
        uint256 balance = modelBalance[owner];
        amount = bound(amount, 0, approved < balance ? approved : balance);
        vm.prank(spender);
        assertTrue(token.transferFrom(owner, to, amount));
        if (approved != type(uint256).max) modelAllowance[owner][spender] -= amount;
        modelBalance[owner] -= amount;
        modelBalance[to] += amount;
    }

    function rejectOverspend(uint8 ownerSeed, uint8 spenderSeed, uint8 toSeed) external {
        address owner = actors[ownerSeed % 4];
        address spender = actors[spenderSeed % 4];
        address to = actors[toSeed % 4];
        uint256 amount = modelBalance[owner] + 1;
        vm.prank(owner);
        (bool sent,) = address(token).call(abi.encodeCall(token.transfer, (to, amount)));
        assertFalse(sent, "transfer overspent a balance");
        vm.prank(spender);
        (bool spent,) = address(token).call(abi.encodeCall(token.transferFrom, (owner, to, amount)));
        assertFalse(spent, "transferFrom overspent a balance");
    }
}

contract NeetillionsInvariantTest is Test {
    uint256 private constant SUPPLY = 1_000_000_000 * 10 ** 18;
    Neetillions private token;
    NeetillionsHandler private handler;
    address[4] private actors;

    function setUp() public {
        actors = [makeAddr("actor 0"), makeAddr("actor 1"), makeAddr("actor 2"), makeAddr("actor 3")];
        vm.prank(actors[0]);
        token = new Neetillions();
        handler = new NeetillionsHandler(token, actors, SUPPLY);

        bytes4[] memory selectors = new bytes4[](4);
        selectors[0] = handler.transfer.selector;
        selectors[1] = handler.approve.selector;
        selectors[2] = handler.transferFrom.selector;
        selectors[3] = handler.rejectOverspend.selector;
        targetContract(address(handler));
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    function invariant_supplyBalancesAndAllowancesMatchModel() public view {
        uint256 sum;
        for (uint256 i; i < actors.length; ++i) {
            address actor = actors[i];
            uint256 balance = token.balanceOf(actor);
            sum += balance;
            assertEq(balance, handler.modelBalance(actor), "balance differs from accounting model");
            for (uint256 j; j < actors.length; ++j) {
                assertEq(
                    token.allowance(actor, actors[j]),
                    handler.modelAllowance(actor, actors[j]),
                    "allowance differs from accounting model"
                );
            }
        }
        assertEq(sum, SUPPLY, "tokens were created or lost");
        assertEq(token.totalSupply(), SUPPLY, "supply changed");
        assertEq(token.balanceOf(address(0)), 0);
        assertEq(token.balanceOf(address(token)), 0);
    }
}
