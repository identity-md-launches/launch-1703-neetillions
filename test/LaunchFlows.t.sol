// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Neetillions} from "../src/Neetillions.sol";

/// @dev Local token-flow fixture only; this does not implement the production factory or AMM.
contract NeetillionsFactoryFixture {
    function deploy(bytes32 salt) external returns (Neetillions) {
        return new Neetillions{salt: salt}();
    }

    function distribute(Neetillions token, address distributor, address pool, address remainder) external {
        uint256 supply = token.totalSupply();
        require(token.transfer(distributor, supply * 1_000 / 10_000));
        require(token.transfer(pool, supply * 8_800 / 10_000));
        require(token.transfer(remainder, supply * 200 / 10_000));
    }
}

contract LaunchFlowsTest is Test {
    uint256 private constant SUPPLY = 1_000_000_000 * 10 ** 18;

    function test_create2MintsEntireSupplyToFactoryRatherThanCaller() public {
        NeetillionsFactoryFixture factory = new NeetillionsFactoryFixture();
        address caller = makeAddr("launch caller");
        bytes32 salt = keccak256("neetillions launch");
        address predicted = address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(
                            bytes1(0xff), address(factory), salt, keccak256(type(Neetillions).creationCode)
                        )
                    )
                )
            )
        );

        vm.prank(caller, caller);
        Neetillions token = factory.deploy(salt);

        assertEq(address(token), predicted);
        assertEq(token.totalSupply(), SUPPLY);
        assertEq(token.balanceOf(address(factory)), SUPPLY);
        assertEq(token.balanceOf(caller), 0);
        assertEq(token.balanceOf(address(this)), 0);
    }

    function test_launchDistributionClaimsAndPoolTransfersArriveWhole() public {
        NeetillionsFactoryFixture factory = new NeetillionsFactoryFixture();
        Neetillions token = factory.deploy(keccak256("distribution"));
        address distributor = makeAddr("distributor");
        address pool = makeAddr("pool balance fixture");
        address remainder = makeAddr("remainder recipient");
        address claimant = makeAddr("claimant");
        address trader = makeAddr("trader");

        factory.distribute(token, distributor, pool, remainder);
        assertEq(token.balanceOf(address(factory)), 0);
        assertEq(token.balanceOf(distributor), 100_000_000e18);
        assertEq(token.balanceOf(pool), 880_000_000e18);
        assertEq(token.balanceOf(remainder), 20_000_000e18);

        vm.prank(distributor);
        assertTrue(token.transfer(claimant, 100_000_000e18));
        assertEq(token.balanceOf(distributor), 0);
        assertEq(token.balanceOf(claimant), 100_000_000e18);

        // Exercise exact token delivery in both directions. Price, liquidity and swap execution
        // belong to the separate launch integration harness, not this token-only fixture.
        vm.prank(pool);
        assertTrue(token.transfer(trader, 1_234e18));
        assertEq(token.balanceOf(trader), 1_234e18);
        assertEq(token.balanceOf(pool), 880_000_000e18 - 1_234e18);
        vm.prank(trader);
        assertTrue(token.transfer(pool, 1_234e18));
        assertEq(token.balanceOf(trader), 0);
        assertEq(token.balanceOf(pool), 880_000_000e18);
        assertEq(token.totalSupply(), SUPPLY);
        assertEq(token.balanceOf(pool) + token.balanceOf(claimant) + token.balanceOf(remainder), token.totalSupply());
    }

    function testFuzz_constructorAlwaysFundsItsImmediateDeployer(address deployer) public {
        vm.assume(deployer != address(0));
        vm.prank(deployer);
        Neetillions token = new Neetillions();
        assertEq(token.totalSupply(), SUPPLY);
        assertEq(token.balanceOf(deployer), SUPPLY);
    }
}
