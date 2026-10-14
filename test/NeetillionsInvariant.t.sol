// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
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

    /// @dev Explicitly visit revocation, one wei, the largest finite allowance, and infinity.
    function approveBoundary(uint8 ownerSeed, uint8 spenderSeed, uint8 boundary) external {
        address owner = actors[ownerSeed % 4];
        address spender = actors[spenderSeed % 4];
        uint256[4] memory amounts = [uint256(0), 1, type(uint256).max - 1, type(uint256).max];
        uint256 amount = amounts[boundary % 4];
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
        bytes memory error =
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, owner, modelBalance[owner], amount);
        vm.expectRevert(error);
        vm.prank(owner);
        token.transfer(to, amount);

        // Sufficient allowance is necessary to reach the delegated balance check. Its attempted
        // consumption must be rolled back, which the model invariant checks after this call.
        vm.prank(owner);
        assertTrue(token.approve(spender, amount));
        modelAllowance[owner][spender] = amount;
        vm.expectRevert(error);
        vm.prank(spender);
        token.transferFrom(owner, to, amount);
    }

    /// @dev Avoid a campaign consisting mostly of zero-value transferFrom calls before approval.
    function approveAndSpend(uint8 ownerSeed, uint8 spenderSeed, uint8 toSeed, uint256 amount, bool infinite) external {
        address owner = _fundedActor(ownerSeed);
        address spender = actors[spenderSeed % 4];
        address to = actors[toSeed % 4];
        amount = bound(amount, 1, modelBalance[owner]);
        uint256 approved = infinite ? type(uint256).max : amount;
        vm.prank(owner);
        assertTrue(token.approve(spender, approved));
        modelAllowance[owner][spender] = approved;
        vm.prank(spender);
        assertTrue(token.transferFrom(owner, to, amount));
        modelAllowance[owner][spender] = infinite ? type(uint256).max : 0;
        modelBalance[owner] -= amount;
        modelBalance[to] += amount;
    }

    function rejectInsufficientAllowance(uint8 ownerSeed, uint8 spenderSeed, uint8 toSeed, uint256 amount) external {
        address owner = _fundedActor(ownerSeed);
        address spender = actors[spenderSeed % 4];
        address to = actors[toSeed % 4];
        amount = bound(amount, 1, modelBalance[owner]);
        uint256 approved = amount - 1;
        vm.prank(owner);
        assertTrue(token.approve(spender, approved));
        modelAllowance[owner][spender] = approved;
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, spender, approved, amount)
        );
        vm.prank(spender);
        token.transferFrom(owner, to, amount);
    }

    function rejectZeroRecipient(uint8 ownerSeed, uint8 spenderSeed, uint256 amount) external {
        address owner = actors[ownerSeed % 4];
        address spender = actors[spenderSeed % 4];
        amount = bound(amount, 0, modelBalance[owner]);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InvalidReceiver.selector, address(0)));
        vm.prank(owner);
        token.transfer(address(0), amount);

        vm.prank(owner);
        assertTrue(token.approve(spender, amount));
        modelAllowance[owner][spender] = amount;
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InvalidReceiver.selector, address(0)));
        vm.prank(spender);
        token.transferFrom(owner, address(0), amount);
    }

    function rejectZeroSpender(uint8 ownerSeed, uint256 amount) external {
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InvalidSpender.selector, address(0)));
        vm.prank(actors[ownerSeed % 4]);
        token.approve(address(0), amount);
    }

    function _fundedActor(uint8 seed) private view returns (address) {
        for (uint256 i; i < actors.length; ++i) {
            address actor = actors[(uint256(seed) + i) % actors.length];
            if (modelBalance[actor] > 0) return actor;
        }
        revert("accounting model lost the entire supply");
    }
}

/// forge-config: default.invariant.runs = 256
/// forge-config: default.invariant.depth = 128
/// forge-config: default.invariant.fail-on-revert = true
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

        bytes4[] memory selectors = new bytes4[](9);
        selectors[0] = handler.transfer.selector;
        selectors[1] = handler.approve.selector;
        selectors[2] = handler.transferFrom.selector;
        selectors[3] = handler.rejectOverspend.selector;
        selectors[4] = handler.approveBoundary.selector;
        selectors[5] = handler.approveAndSpend.selector;
        selectors[6] = handler.rejectInsufficientAllowance.selector;
        selectors[7] = handler.rejectZeroRecipient.selector;
        selectors[8] = handler.rejectZeroSpender.selector;
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
            assertEq(token.allowance(actor, address(0)), 0, "zero spender obtained an allowance");
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
        assertEq(token.name(), "neetillions");
        assertEq(token.symbol(), "NEETHOME");
        assertEq(token.decimals(), 18);
    }

    /// @dev After every random sequence, every holder can still move its complete balance.
    function afterInvariant() public {
        for (uint256 i = 1; i < actors.length; ++i) {
            uint256 balance = token.balanceOf(actors[i]);
            vm.prank(actors[i]);
            assertTrue(token.transfer(actors[0], balance));
            assertEq(token.balanceOf(actors[i]), 0, "holder could not empty its account");
        }
        assertEq(token.balanceOf(actors[0]), SUPPLY, "full supply could not be recovered by holders");
        assertEq(token.totalSupply(), SUPPLY);
    }
}
