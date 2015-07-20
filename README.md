# js-lib

blockapps-js is a library that exposes a number of functions for interacting with the Blockchain via the BlockApps API.

API documentation
========================

Many of the functions below take an "apiURL", which indicates from what server the API queries are to be obtained. If running a server locally, "" is allowed; the canonical one is "http://stablenet.blockapps.net".

Contract object: api.Contract(address, functionABI, symbolTable). Methods:
+ showStorage(apiURL, callback). Looks up all global ("state") variables named in the Solidity source, parsing their stored values into Javascript objects and returning an association list { var1Name: var1Val, ... } to the callback function. These objects are:
  + bool: boolean
  + address: hex string
  + int, uint: BigInt (from the big-integer library)
  + bytes32: ASCII string
  + others: not yet handled...
  + address: the address of the contract object, assigned at creation.
makeCall(functionName, args). Forms the data string to be sent in an Ethereum transaction to call the function with the given arguments.
getBalance(apiURL, callback). Gets the current ether balance of the contract.
api.compile(apiURL, code, callback). Submits the code to the online Solidity compiler, returning the output to the callback function. This output is an object of the form {contracts: [{name: contractName, bin: compiledCode}], abis: [{abi: contractFunctions}], xabis: {contractName: storageLayout}}. The contractFunctions object is defined by Solidity; the storageLayout format varies depending on the variable type but always contains fields "bytesUsed" and "solidityType". Some of its entries are type declarations; the actual variables have the field "atStorageKey" as well.
api.submit(apiURL, compiledCode, privateKey, gasPrice, gasLimit, callback). Submits compiled Solidity code via the given URL, using the parameters provided. The response is in the form of a comma-separated string of new addresses for the contracts it creates, which is returned to the callback.
api.getStorage(apiURL, address, callback). Retrieves the full storage contents of the contract at the address, provided to the callback as an association list {key: value}. Both the key and value are normalized to 64-nibble hex strings.
api.getContractsCreated(apiURL, txHash, callback). Retrieves the list of contracts created (as in api.submit) by the transaction whose hash is txHash, and returns it to the callback.
api.getNonce(apiURL, address, callback). Retrieves the current nonce (number of valid transactions sent from) of the contract at the given address, and passes it to the callback.
api.pushTX(nonce, gasPrice, gasLimit, toAddress, ethValue, data, privateKey, URL, callback). Sends a transaction to the URL (canonically "/includetransaction") with the given parameters, handing the response to callback. This response is simply the query URL to look up the raw transaction ("http://stablenet.blockapps.net/query/transaction?hash=txHash"), which is probably not what you want. Thus, callback should probably extract txHash and GET from "/transactionResult/txHash" to obtain more detailed information.