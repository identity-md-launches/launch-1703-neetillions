// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {Neetillions} from "src/Neetillions.sol";

/// @dev Complements the basic ERC-20 tests with authorization boundaries and transaction sequences.
/// forge-config: default.fuzz.runs = 1000
contract NeetillionsAdversarialTest is Test {
    uint256 private constant SUPPLY = 1_000_000_000e18;
    Neetillions private token;
    address private holder;
    address private recipient;
    address private spender;
    address private otherSpender;

    event Transfer(address indexed from, address indexed to, uint256 value);

    function setUp() public {
        token = new Neetillions();
        holder = makeAddr("holder");
        recipient = makeAddr("recipient");
        spender = makeAddr("spender");
        otherSpender = makeAddr("other spender");
    }

    function test_oneWeiRemainsTransferableAfterFullBalanceDrain() public {
        token.transfer(holder, SUPPLY);
        vm.prank(holder);
        assertTrue(token.transfer(recipient, SUPPLY - 1));
        _assertDistribution(1, SUPPLY - 1);
        vm.expectEmit(true, true, false, true, address(token));
        emit Transfer(holder, recipient, 1);
        vm.prank(holder);
        assertTrue(token.transfer(recipient, 1));
        _assertDistribution(0, SUPPLY);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, holder, 0, 1));
        vm.prank(holder);
        token.transfer(recipient, 1);
        _assertDistribution(0, SUPPLY);
    }

    function test_largestFiniteAllowanceIsConsumed() public {
        token.transfer(holder, 1);
        vm.prank(holder);
        token.approve(spender, type(uint256).max - 1);
        vm.prank(spender);
        assertTrue(token.transferFrom(holder, recipient, 1));
        assertEq(token.allowance(holder, spender), type(uint256).max - 2);
        _assertDistribution(0, 1);
    }

    function test_maximumTransferCannotWrapBalanceEvenWithInfiniteAllowance() public {
        token.transfer(holder, SUPPLY);
        vm.prank(holder);
        token.approve(spender, type(uint256).max);
        bytes memory error =
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, holder, SUPPLY, type(uint256).max);
        vm.expectRevert(error);
        vm.prank(holder);
        token.transfer(recipient, type(uint256).max);
        vm.expectRevert(error);
        vm.prank(spender);
        token.transferFrom(holder, recipient, type(uint256).max);
        assertEq(token.allowance(holder, spender), type(uint256).max);
        _assertDistribution(SUPPLY, 0);
    }

    function test_maximumTransferExceedsLargestFiniteAllowance() public {
        token.transfer(holder, SUPPLY);
        vm.prank(holder);
        token.approve(spender, type(uint256).max - 1);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientAllowance.selector, spender, type(uint256).max - 1, type(uint256).max
            )
        );
        vm.prank(spender);
        token.transferFrom(holder, recipient, type(uint256).max);
        assertEq(token.allowance(holder, spender), type(uint256).max - 1);
        _assertDistribution(SUPPLY, 0);
    }

    function test_infiniteApprovalCanBeReplacedAndRevokedAfterUse() public {
        token.transfer(holder, 10);
        vm.prank(holder);
        token.approve(spender, type(uint256).max);
        vm.prank(spender);
        assertTrue(token.transferFrom(holder, recipient, 1));
        vm.prank(holder);
        token.approve(spender, 2);
        assertEq(token.allowance(holder, spender), 2);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, spender, 2, 3));
        vm.prank(spender);
        token.transferFrom(holder, recipient, 3);
        vm.prank(holder);
        token.approve(spender, 0);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, spender, 0, 1));
        vm.prank(spender);
        token.transferFrom(holder, recipient, 1);
        assertEq(token.allowance(holder, spender), 0);
        _assertDistribution(9, 1);
    }

    function test_approvalBeforeFundingDoesNotCreateTokens() public {
        vm.prank(holder);
        assertTrue(token.approve(spender, SUPPLY));
        _assertDistribution(0, 0);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, holder, 0, SUPPLY));
        vm.prank(spender);
        token.transferFrom(holder, recipient, SUPPLY);
        assertEq(token.allowance(holder, spender), SUPPLY);
        token.transfer(holder, SUPPLY);
        vm.prank(spender);
        assertTrue(token.transferFrom(holder, recipient, SUPPLY));
        assertEq(token.allowance(holder, spender), 0);
        _assertDistribution(0, SUPPLY);
    }

    function test_twoSpendersCannotSpendTheSameBalanceTwice() public {
        token.transfer(holder, 10);
        vm.startPrank(holder);
        token.approve(spender, 10);
        token.approve(otherSpender, 10);
        vm.stopPrank();
        vm.prank(spender);
        assertTrue(token.transferFrom(holder, recipient, 10));
        assertEq(token.allowance(holder, spender), 0);
        assertEq(token.allowance(holder, otherSpender), 10);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, holder, 0, 10));
        vm.prank(otherSpender);
        token.transferFrom(holder, recipient, 10);
        assertEq(token.allowance(holder, otherSpender), 10);
        _assertDistribution(0, 10);

        // Approvals authorize future balances too; the failed transaction must preserve that right.
        token.transfer(holder, 10);
        vm.prank(otherSpender);
        assertTrue(token.transferFrom(holder, recipient, 10));
        assertEq(token.allowance(holder, otherSpender), 0);
        _assertDistribution(0, 20);
    }

    function test_allowanceCannotBeBorrowedFromAnotherOwner() public {
        token.transfer(holder, 10);
        token.approve(spender, 10);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, spender, 0, 1));
        vm.prank(spender);
        token.transferFrom(holder, recipient, 1);
        assertEq(token.allowance(address(this), spender), 10);
        assertEq(token.allowance(holder, spender), 0);
        _assertDistribution(10, 0);
    }

    function test_holderUsingTransferFromStillNeedsItsOwnApproval() public {
        token.transfer(holder, 10);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, holder, 0, 1));
        vm.prank(holder);
        token.transferFrom(holder, recipient, 1);
        vm.prank(holder);
        token.approve(holder, 10);
        vm.prank(holder);
        assertTrue(token.transferFrom(holder, recipient, 10));
        assertEq(token.allowance(holder, holder), 0);
        _assertDistribution(0, 10);
    }

    function test_selfTransferStillChecksBalance() public {
        token.transfer(holder, 1);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, holder, 1, 2));
        vm.prank(holder);
        token.transfer(holder, 2);
        vm.prank(holder);
        token.approve(spender, 2);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, holder, 1, 2));
        vm.prank(spender);
        token.transferFrom(holder, holder, 2);
        assertEq(token.allowance(holder, spender), 2);
        _assertDistribution(1, 0);
    }

    function test_spenderMayBeRecipientWithoutDoubleCredit() public {
        token.transfer(holder, 10);
        vm.prank(holder);
        token.approve(spender, 10);
        vm.prank(spender);
        assertTrue(token.transferFrom(holder, spender, 10));
        assertEq(token.balanceOf(spender), 10);
        assertEq(token.balanceOf(holder), 0);
        assertEq(token.balanceOf(address(this)), SUPPLY - 10);
        assertEq(token.allowance(holder, spender), 0);
        assertEq(token.totalSupply(), SUPPLY);
    }

    function test_zeroDelegatedTransferPreservesNonzeroAllowanceAndEmits() public {
        vm.prank(holder);
        token.approve(spender, 7);
        vm.expectEmit(true, true, false, true, address(token));
        emit Transfer(holder, recipient, 0);
        vm.prank(spender);
        assertTrue(token.transferFrom(holder, recipient, 0));
        assertEq(token.allowance(holder, spender), 7);
        _assertDistribution(0, 0);
    }

    function test_zeroApprovalToZeroSpenderStillReverts() public {
        vm.prank(holder);
        token.approve(spender, 7);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InvalidSpender.selector, address(0)));
        vm.prank(holder);
        token.approve(address(0), 0);
        assertEq(token.allowance(holder, spender), 7);
        assertEq(token.allowance(holder, address(0)), 0);
        _assertDistribution(0, 0);
    }

    function test_repeatedInvalidRecipientDoesNotConsumeAllowance() public {
        token.transfer(holder, 10);
        vm.prank(holder);
        token.approve(spender, 10);
        for (uint256 i; i < 2; ++i) {
            vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InvalidReceiver.selector, address(0)));
            vm.prank(spender);
            token.transferFrom(holder, address(0), 10);
            assertEq(token.allowance(holder, spender), 10);
            _assertDistribution(10, 0);
        }
        vm.prank(spender);
        assertTrue(token.transferFrom(holder, recipient, 10));
        assertEq(token.allowance(holder, spender), 0);
        _assertDistribution(0, 10);
    }

    function testFuzz_failedBalanceCheckRollsBackDelegatedSpend(uint256 funded, uint256 attempted) public {
        funded = bound(funded, 0, SUPPLY);
        attempted = bound(attempted, funded + 1, type(uint256).max);
        token.transfer(holder, funded);
        vm.prank(holder);
        token.approve(spender, attempted);
        bytes memory error =
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, holder, funded, attempted);
        vm.expectRevert(error);
        vm.prank(holder);
        token.transfer(recipient, attempted);
        vm.expectRevert(error);
        vm.prank(spender);
        token.transferFrom(holder, recipient, attempted);
        assertEq(token.allowance(holder, spender), attempted);
        _assertDistribution(funded, 0);
    }

    function testFuzz_failedAllowanceCheckWithEnoughBalance(uint256 funded, uint256 approved, uint256 attempted)
        public
    {
        funded = bound(funded, 1, SUPPLY);
        approved = bound(approved, 0, funded - 1);
        attempted = bound(attempted, approved + 1, funded);
        token.transfer(holder, funded);
        vm.prank(holder);
        token.approve(spender, approved);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, spender, approved, attempted)
        );
        vm.prank(spender);
        token.transferFrom(holder, recipient, attempted);
        assertEq(token.allowance(holder, spender), approved);
        _assertDistribution(funded, 0);
    }

    function testFuzz_approvalReplacementIsIdempotentAndIsolated(uint256 oldAmount, uint256 newAmount) public {
        token.transfer(holder, 1);
        vm.startPrank(holder);
        token.approve(otherSpender, oldAmount);
        token.approve(spender, oldAmount);
        token.approve(spender, newAmount);
        token.approve(spender, newAmount);
        vm.stopPrank();
        assertEq(token.allowance(holder, spender), newAmount);
        assertEq(token.allowance(holder, otherSpender), oldAmount);
        assertEq(token.allowance(spender, holder), 0);
        assertEq(token.allowance(address(this), spender), 0);
        _assertDistribution(1, 0);
    }

    function testFuzz_delegatedRoundTripConsumesFiniteBudgets(uint256 amount) public {
        amount = bound(amount, 1, SUPPLY);
        token.transfer(holder, amount);
        vm.prank(holder);
        token.approve(spender, amount);
        vm.prank(spender);
        assertTrue(token.transferFrom(holder, recipient, amount));
        vm.prank(recipient);
        token.approve(spender, amount);
        vm.prank(spender);
        assertTrue(token.transferFrom(recipient, holder, amount));
        assertEq(token.allowance(holder, spender), 0);
        assertEq(token.allowance(recipient, spender), 0);
        _assertDistribution(amount, 0);
    }

    function testFuzz_splittingDelegatedTransferHasSameEffect(uint256 first, uint256 second, uint256 approved) public {
        first = bound(first, 0, SUPPLY);
        second = bound(second, 0, SUPPLY - first);
        uint256 total = first + second;
        approved = bound(approved, total, type(uint256).max);
        Neetillions lump = new Neetillions();
        token.transfer(holder, total);
        lump.transfer(holder, total);
        vm.startPrank(holder);
        token.approve(spender, approved);
        lump.approve(spender, approved);
        vm.stopPrank();
        vm.startPrank(spender);
        assertTrue(token.transferFrom(holder, recipient, first));
        assertTrue(token.transferFrom(holder, recipient, second));
        assertTrue(lump.transferFrom(holder, recipient, total));
        vm.stopPrank();
        assertEq(token.balanceOf(holder), lump.balanceOf(holder));
        assertEq(token.balanceOf(recipient), lump.balanceOf(recipient));
        assertEq(token.allowance(holder, spender), lump.allowance(holder, spender));
        assertEq(token.allowance(holder, spender), approved == type(uint256).max ? approved : approved - total);
        _assertDistribution(0, total);
        assertEq(lump.totalSupply(), SUPPLY);
    }

    function testFuzz_zeroRecipientRestoresFiniteOrInfiniteAllowance(uint256 amount, bool infinite) public {
        amount = bound(amount, 0, SUPPLY);
        token.transfer(holder, amount);
        uint256 approved = infinite ? type(uint256).max : amount;
        vm.prank(holder);
        token.approve(spender, approved);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InvalidReceiver.selector, address(0)));
        vm.prank(spender);
        token.transferFrom(holder, address(0), amount);
        assertEq(token.allowance(holder, spender), approved);
        _assertDistribution(amount, 0);
    }

    function _assertDistribution(uint256 held, uint256 received) private view {
        assertEq(token.balanceOf(holder), held);
        assertEq(token.balanceOf(recipient), received);
        assertEq(token.balanceOf(address(this)), SUPPLY - held - received);
        assertEq(token.balanceOf(spender), 0);
        assertEq(token.balanceOf(otherSpender), 0);
        assertEq(token.balanceOf(address(0)), 0);
        assertEq(token.totalSupply(), SUPPLY);
    }
}
