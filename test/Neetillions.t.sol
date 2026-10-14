// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {Neetillions} from "../src/Neetillions.sol";

contract NeetillionsTest is Test {
    uint256 private constant SUPPLY = 1_000_000_000 * 10 ** 18;

    Neetillions private token;
    address private deployer;
    address private alice;
    address private bob;
    address private spender;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function setUp() public {
        deployer = makeAddr("deployer");
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        spender = makeAddr("spender");
        vm.prank(deployer);
        token = new Neetillions();
    }

    function test_metadataAndInitialSupply() public view {
        assertEq(token.name(), "neetillions");
        assertEq(token.symbol(), "NEETHOME");
        assertEq(token.decimals(), 18);
        assertEq(token.INITIAL_SUPPLY(), SUPPLY);
        assertEq(token.totalSupply(), SUPPLY);
        assertEq(token.balanceOf(deployer), SUPPLY);
        assertEq(token.balanceOf(address(token)), 0);
        assertEq(token.balanceOf(address(0)), 0);
        assertEq(token.balanceOf(alice), 0);
        assertEq(token.allowance(deployer, spender), 0);
    }

    function test_constructorEmitsSingleMint() public {
        vm.recordLogs();
        vm.prank(alice);
        Neetillions other = new Neetillions();
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 1);
        assertEq(logs[0].emitter, address(other));
        assertEq(logs[0].topics.length, 3);
        assertEq(logs[0].topics[0], keccak256("Transfer(address,address,uint256)"));
        assertEq(logs[0].topics[1], bytes32(0));
        assertEq(logs[0].topics[2], bytes32(uint256(uint160(alice))));
        assertEq(abi.decode(logs[0].data, (uint256)), SUPPLY);
        assertEq(other.balanceOf(alice), SUPPLY);
    }

    function test_transferDeliversExactAmountAndEmitsEvent() public {
        vm.expectEmit(true, true, false, true, address(token));
        emit Transfer(deployer, alice, 123e18);
        vm.prank(deployer);
        assertTrue(token.transfer(alice, 123e18));
        assertEq(token.balanceOf(deployer), SUPPLY - 123e18);
        assertEq(token.balanceOf(alice), 123e18);
        assertEq(token.totalSupply(), SUPPLY);
    }

    function test_transferEntireSupplyAndBack() public {
        vm.prank(deployer);
        assertTrue(token.transfer(alice, SUPPLY));
        assertEq(token.balanceOf(deployer), 0);
        vm.prank(alice);
        assertTrue(token.transfer(deployer, SUPPLY));
        assertEq(token.balanceOf(alice), 0);
        assertEq(token.balanceOf(deployer), SUPPLY);
    }

    function test_zeroTransferFromEmptyAccountEmitsEvent() public {
        vm.expectEmit(true, true, false, true, address(token));
        emit Transfer(alice, bob, 0);
        vm.prank(alice);
        assertTrue(token.transfer(bob, 0));
        assertEq(token.balanceOf(alice), 0);
        assertEq(token.balanceOf(bob), 0);
        assertEq(token.totalSupply(), SUPPLY);
    }

    function test_selfTransferPreservesBalance() public {
        vm.prank(deployer);
        assertTrue(token.transfer(deployer, SUPPLY));
        assertEq(token.balanceOf(deployer), SUPPLY);
        assertEq(token.totalSupply(), SUPPLY);
    }

    function test_transferToContractHasNoCallback() public {
        RejectCallbacks receiver = new RejectCallbacks();
        vm.prank(deployer);
        assertTrue(token.transfer(address(receiver), 1e18));
        assertEq(token.balanceOf(address(receiver)), 1e18);
    }

    function test_transferToZeroReverts() public {
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InvalidReceiver.selector, address(0)));
        vm.prank(deployer);
        token.transfer(address(0), 1);
        assertEq(token.balanceOf(deployer), SUPPLY);
        assertEq(token.totalSupply(), SUPPLY);
    }

    function test_zeroTransferToZeroReverts() public {
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InvalidReceiver.selector, address(0)));
        vm.prank(alice);
        token.transfer(address(0), 0);
    }

    function test_transferAboveBalanceReverts() public {
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, alice, 0, 1));
        vm.prank(alice);
        token.transfer(bob, 1);
        assertEq(token.balanceOf(alice), 0);
        assertEq(token.balanceOf(bob), 0);
    }

    function test_approveEmitsEventWithoutMovingTokens() public {
        vm.expectEmit(true, true, false, true, address(token));
        emit Approval(deployer, spender, 7e18);
        vm.prank(deployer);
        assertTrue(token.approve(spender, 7e18));
        assertEq(token.allowance(deployer, spender), 7e18);
        assertEq(token.balanceOf(deployer), SUPPLY);
        assertEq(token.balanceOf(spender), 0);
    }

    function test_approveReplacesAndRevokesAllowance() public {
        vm.startPrank(deployer);
        assertTrue(token.approve(spender, 9e18));
        assertTrue(token.approve(spender, 3e18));
        assertEq(token.allowance(deployer, spender), 3e18);
        assertTrue(token.approve(spender, 0));
        vm.stopPrank();
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, spender, 0, 1));
        vm.prank(spender);
        token.transferFrom(deployer, alice, 1);
        assertEq(token.allowance(deployer, spender), 0);
    }

    function test_approveZeroSpenderReverts() public {
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InvalidSpender.selector, address(0)));
        vm.prank(deployer);
        token.approve(address(0), 1);
    }

    function test_transferFromSpendsFiniteAllowanceAndEmitsTransfer() public {
        vm.prank(deployer);
        token.approve(spender, 10e18);
        vm.expectEmit(true, true, false, true, address(token));
        emit Transfer(deployer, alice, 4e18);
        vm.prank(spender);
        assertTrue(token.transferFrom(deployer, alice, 4e18));
        assertEq(token.balanceOf(alice), 4e18);
        assertEq(token.balanceOf(deployer), SUPPLY - 4e18);
        assertEq(token.balanceOf(spender), 0);
        assertEq(token.allowance(deployer, spender), 6e18);
        assertEq(token.totalSupply(), SUPPLY);
    }

    function test_transferFromExactAllowanceThenOverspendReverts() public {
        vm.prank(deployer);
        token.approve(spender, 10);
        vm.prank(spender);
        assertTrue(token.transferFrom(deployer, alice, 10));
        assertEq(token.allowance(deployer, spender), 0);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, spender, 0, 1));
        vm.prank(spender);
        token.transferFrom(deployer, alice, 1);
        assertEq(token.balanceOf(alice), 10);
    }

    function test_transferFromPreservesInfiniteAllowance() public {
        vm.prank(deployer);
        token.approve(spender, type(uint256).max);
        vm.startPrank(spender);
        assertTrue(token.transferFrom(deployer, alice, 1e18));
        assertTrue(token.transferFrom(deployer, bob, 2e18));
        vm.stopPrank();
        assertEq(token.allowance(deployer, spender), type(uint256).max);
        assertEq(token.balanceOf(deployer), SUPPLY - 3e18);
    }

    function test_transferFromWithoutApprovalReverts() public {
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, spender, 0, 1));
        vm.prank(spender);
        token.transferFrom(deployer, alice, 1);
        assertEq(token.balanceOf(deployer), SUPPLY);
        assertEq(token.balanceOf(alice), 0);
    }

    function test_deployerCannotSpendHolderTokensWithoutApproval() public {
        vm.prank(deployer);
        token.transfer(alice, 10);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, deployer, 0, 10));
        vm.prank(deployer);
        token.transferFrom(alice, deployer, 10);
        assertEq(token.balanceOf(alice), 10);
    }

    function test_approvalIsSpecificToSpender() public {
        vm.prank(deployer);
        token.approve(spender, 10);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, bob, 0, 1));
        vm.prank(bob);
        token.transferFrom(deployer, bob, 1);
        assertEq(token.allowance(deployer, spender), 10);
    }

    function test_transferFromAboveAllowanceRevertsAtomically() public {
        vm.prank(deployer);
        token.approve(spender, 10);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, spender, 10, 11));
        vm.prank(spender);
        token.transferFrom(deployer, alice, 11);
        assertEq(token.allowance(deployer, spender), 10);
        assertEq(token.balanceOf(deployer), SUPPLY);
        assertEq(token.balanceOf(alice), 0);
    }

    function test_transferFromAboveBalanceRestoresAllowance() public {
        vm.prank(alice);
        token.approve(spender, 10);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, alice, 0, 7));
        vm.prank(spender);
        token.transferFrom(alice, bob, 7);
        assertEq(token.allowance(alice, spender), 10);
        assertEq(token.balanceOf(alice), 0);
        assertEq(token.balanceOf(bob), 0);
    }

    function test_transferFromToZeroRestoresAllowance() public {
        vm.prank(deployer);
        token.approve(spender, 10);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InvalidReceiver.selector, address(0)));
        vm.prank(spender);
        token.transferFrom(deployer, address(0), 7);
        assertEq(token.allowance(deployer, spender), 10);
        assertEq(token.balanceOf(deployer), SUPPLY);
    }

    function test_transferFromZeroSenderRevertsEvenForZeroAmount() public {
        // Allowance validation rejects a zero owner before the transfer checks run.
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InvalidApprover.selector, address(0)));
        vm.prank(spender);
        token.transferFrom(address(0), alice, 0);
    }

    function test_zeroTransferFromNeedsNoAllowance() public {
        vm.prank(spender);
        assertTrue(token.transferFrom(alice, bob, 0));
        assertEq(token.allowance(alice, spender), 0);
        assertEq(token.balanceOf(alice), 0);
        assertEq(token.balanceOf(bob), 0);
    }

    function test_transferFromToSameHolderStillSpendsAllowance() public {
        vm.prank(deployer);
        token.approve(spender, 20);
        vm.prank(spender);
        assertTrue(token.transferFrom(deployer, deployer, 7));
        assertEq(token.balanceOf(deployer), SUPPLY);
        assertEq(token.allowance(deployer, spender), 13);
    }

    function test_noMintBurnOrAdminEntrypoints() public {
        bytes[] memory calls = new bytes[](14);
        calls[0] = abi.encodeWithSignature("mint(address,uint256)", alice, 1);
        calls[1] = abi.encodeWithSignature("mint(uint256)", 1);
        calls[2] = abi.encodeWithSignature("mint()");
        calls[3] = abi.encodeWithSignature("burn(uint256)", 1);
        calls[4] = abi.encodeWithSignature("burnFrom(address,uint256)", alice, 1);
        calls[5] = abi.encodeWithSignature("pause()");
        calls[6] = abi.encodeWithSignature("blacklist(address)", alice);
        calls[7] = abi.encodeWithSignature("freeze(address)", alice);
        calls[8] = abi.encodeWithSignature("seize(address)", alice);
        calls[9] = abi.encodeWithSignature("setMinter(address)", alice);
        calls[10] = abi.encodeWithSignature("transferOwnership(address)", alice);
        calls[11] = abi.encodeWithSignature("upgradeTo(address)", alice);
        calls[12] = abi.encodeWithSignature("initialize(address)", alice);
        calls[13] = abi.encodeWithSignature("setTransfersEnabled(bool)", false);
        vm.prank(deployer);
        token.transfer(alice, 10);
        for (uint256 i; i < calls.length; ++i) {
            vm.prank(deployer);
            (bool deployerSuccess,) = address(token).call(calls[i]);
            assertFalse(deployerSuccess, "deployer reached an unexpected entrypoint");
            vm.prank(bob);
            (bool strangerSuccess,) = address(token).call(calls[i]);
            assertFalse(strangerSuccess, "stranger reached an unexpected entrypoint");
        }
        assertEq(token.totalSupply(), SUPPLY);
        assertEq(token.balanceOf(alice), 10);
        vm.prank(alice);
        assertTrue(token.transfer(bob, 10));
        assertEq(token.balanceOf(bob), 10);
    }

    function test_rejectsNativeCurrency() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (bool success,) = address(token).call{value: 1 ether}("");
        assertFalse(success);
        assertEq(address(token).balance, 0);
        assertEq(alice.balance, 1 ether);
    }

    function test_runtimeHasNoForbiddenOpcodesAndFitsSizeLimit() public view {
        bytes memory runtime = address(token).code;
        assertGt(runtime.length, 0);
        assertLe(runtime.length, 24_576);
        for (uint256 i; i < runtime.length; ++i) {
            uint8 op = uint8(runtime[i]);
            if (op >= 0x60 && op <= 0x7f) {
                i += op - 0x5f;
                continue;
            }
            assertTrue(op != 0xf4 && op != 0xf2 && op != 0xff, "forbidden runtime opcode");
        }
    }

    function testFuzz_transferConservesSupply(address recipient, uint256 amount) public {
        vm.assume(recipient != address(0) && recipient != deployer);
        amount = bound(amount, 0, SUPPLY);
        vm.prank(deployer);
        assertTrue(token.transfer(recipient, amount));
        assertEq(token.balanceOf(recipient), amount);
        assertEq(token.balanceOf(deployer), SUPPLY - amount);
        assertEq(token.totalSupply(), SUPPLY);
    }

    function testFuzz_transferFromConservesSupply(address recipient, uint256 approved, uint256 amount) public {
        vm.assume(recipient != address(0) && recipient != deployer);
        approved = bound(approved, 0, SUPPLY);
        amount = bound(amount, 0, approved);
        vm.prank(deployer);
        token.approve(spender, approved);
        vm.prank(spender);
        assertTrue(token.transferFrom(deployer, recipient, amount));
        assertEq(token.balanceOf(recipient), amount);
        assertEq(token.balanceOf(deployer), SUPPLY - amount);
        assertEq(token.allowance(deployer, spender), approved - amount);
        assertEq(token.totalSupply(), SUPPLY);
    }

    function testFuzz_transferBeyondSupplyReverts(uint256 amount) public {
        amount = bound(amount, SUPPLY + 1, type(uint256).max);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, deployer, SUPPLY, amount)
        );
        vm.prank(deployer);
        token.transfer(alice, amount);
        assertEq(token.balanceOf(deployer), SUPPLY);
        assertEq(token.balanceOf(alice), 0);
        assertEq(token.totalSupply(), SUPPLY);
    }
}

/// @dev A token recipient that rejects any callback; normal ERC-20 transfers must still succeed.
contract RejectCallbacks {
    fallback() external {
        revert("unexpected callback");
    }
}
