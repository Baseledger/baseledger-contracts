# Baseledger Contracts

This repo contains **BaseledgerUBTSplitter** contract and **UBTMock** contract for development and testing purposes.

_BaseledgerUBTSplitter_ contract allows to split UBT payments among a group of accounts. The sender does not need to be aware
that the UBT will be split in this way, since it is handled transparently by the contract.
Contract is based on PaymentSplitter, but difference is that in PaymentSplitter payees are added only once in constructor,
but here can be added and updated later. Because of this, contract needs to track release amount since the last payee update.
Offchain solution should take care of notifying payees to pull their funds before payees are added or updated.

The split can be in equal parts or in any other arbitrary proportion. The way this is specified is by assigning each
account to a number of shares. Of all the UBT that this contract receives, each account will then be able to claim
an amount proportional to the percentage of total shares they were assigned.

_BaseledgerUBTSplitter_ follows a _pull payment_ model. This means that payments are not automatically forwarded to the
accounts but kept in this contract, and the actual transfer is triggered as a separate step by calling the {release}
function.

# Deploy UBTMock and BaseledgerUBTSplitter contracts for local development

Deploy script will also allow 100 tokens to be deposited to baseledger bridge

```shell
npx hardhat node

npm run contracts:migrate:local
```

# Test deposit event

```shell
npx hardhat console --network localhost

const Baseledger = await ethers.getContractFactory("UBTSplitter")
const baseledger = await Baseledger.attach("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512")

await baseledger.deposit(1, COSMOS_WALLET_ADDRESS)
```
