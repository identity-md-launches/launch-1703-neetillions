import { readFileSync } from 'node:fs'
import { keccak256, stringToHex } from 'viem'
const abi = JSON.parse(readFileSync(new URL('../src/Neetillions.abi.json', import.meta.url)))
const facts = JSON.parse(readFileSync(new URL('../src/deployment.json', import.meta.url)))
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value
const actual = keccak256(stringToHex(JSON.stringify(canonical(abi))))
const expected = `0x${facts.deployment.contracts[0].abiHash}`
if (actual !== expected) throw new Error(`ABI hash mismatch: ${actual}`)
if (facts.deployment.chainId !== facts.network.network.chainId) throw new Error('Chain mismatch')
console.log(`Verified Neetillions ABI: ${actual}`)
