# blockapps-js

blockapps-js is a library that exposes a number of functions for
interacting with the Blockchain via the BlockApps API.  Currently it
has strong support for compiling Solidity code, creating the resulting
contract, and querying its variables or calling its functions through
Javascript code.

## Installation

`npm install blockapps`

## Documentation

Documentation is available at http://blockapps.net/apidocs.  Below is
the API for this particular module.

## API Overview

All functionality is included in the `blockapps-js` module:

```js
var blockapps = require('blockapps-js');
```

Many functions, in fact any that require interacting directly with the
blockchain, take an `apiURL` parameter and a `callback` parameter.

The `apiURL` names a Blockapps node where the query is made, and can
be "" for the local machine, if it is running such a node.  The choice
of this URL is of minor effect, except for the usual network latency
issues and the possibility that different nodes may be at different
degrees of synchronicity with the Ethereum network.

The `callback` is run on various appropriate response values when the
query is complete.  In the future we will also provide promises from
these methods, for finer control over success and failure of the
query.

### Quick start

It is virtually certain that you want to start using this library in
the following way:

```
// Say your document has text fields with these IDs
var privkey = document.getElementById('privkey');
var code = document.getElementById('code');

// This should be whatever Blockapps node you like
var apiURL = "http://localhost:3000";

// This should be an action for some user event, say a button press
function submitCode() {
    // Constructs a Solidity code object
    api.Solidity(code.value).toContract({ // Makes a contract from it
        apiURL:apiURL,
        fromAccount:api.Contract({privkey: privkey.value}),
        value:0,
        gasPrice:1,
        gasLimit:3141592,
    }, displayContract ) // Does this with the contract
}

function displayContract(contract) {
    // The actual display is a callback to sync()
    function addToAbidata() {
        // This is a pretty boring way to use a contract,
        // but illustrates how to use it to query the state variables.
        abidata.value = "Balance: " + contract.balance;
        abidata.value += "\n\nContract state variables:"
        for (var sym in contract.get) {
            val = contract.get[sym]
            abidata.value += "\n" + sym + " = " + val;
            if (val.isMapping) {
                abidata.value += " : 1729 => " + val(api.Types.Int(1729));
            }
        }
    }

    // You have to sync before you can read the state.
    contract.sync("", addToAbidata);
}
```

### Contracts

The `Contract` object is the hub of the API.  Its fields and methods
mirror the structure of an Ethereum contract.  There are three
subtypes of `Contract`, but a user would only create two of them directly:

* User account: `var account = Contract({ privkey: <hexString> });` a
human possessing a certain amount of ether.  It can send any
transaction, or receive value tranfers.
  * `account.address`: the account's Ethereum address, derived from
    the private key.
  * `account.balance`: the account's quantity of ether.
  * `account.nonce`: the account's nonce (number of valid transactions sent).
  * `account.sync(apiURL, callback)`: fetches the current balance and
    nonce from the Blockapps node at`apiURL`, then runs `callback()`.
* Null contract: `var nullContract = Contract();` used in
contract-creation transactions: sending a transaction to
`nullContract` turns it into a contract creation rather than a
message.

The third, most featureful type of contract is constructed from
Solidity code, as described below.  It has the following structure.

* Solidity contract: `var contract = Contract({address: 0x<20 bytes>,
  symtab: <symtab>})`.  This object mirrors the syntactic declarations
  of the Solidity code that it was constructed from.
  * `contract.address`: the Ethereum address, passed in the
    constructor (determined from the creating account's address and
    nonce).
  * `contract.balance`: the ether quantity held by this contract.
  * `contract.nonce`: the nonce of this contract.
  * `contract.sync(apiURL, callback)`: queries the Blockapps node at
    `apiURL` for the current storage contents of the contract, thus
    updating the values of all variables, then calls `callback()`.
  * `contract.get(apiURL, callback, varName)`: first synchronizes as
    above, then calls `callback` on the value of variable called
    `varName` in the Solidity source code.
    * `contract.get[varName]`: directly returns the value of
      `varName`, current as of the last call to `contract.sync` or
      `contract.get`, but does *not* update the storage.
  * `contract.call(apiURL, callback, { funcName:<string>, fromAccount:<Contract>,
    value:<ether amount>, gasPrice:<ether amount>, gasLimit:<ether
    amount> }, args..)`: if `funcName` is the name of a function
    defined in the Solidity source, this sends a message transaction
    "calling" that function on the list of arguments `args..`, with
    the parameters given.  It then calls `callback(<retVal>)` on the
    function's return value, if any.
    * `contract.call[funcName]`: the Javascript function `f`
      accomplishing the above, which is equivalent to `f(apiURL,
      callback, argObj, args..)`, where `argObj` is the object passed
      to `contract.call`.

### Solidity

The `Solidity` object manipulates code in the Ethereum domain-specific language Solidity.

* `var solCode = Solidity(<code>);` initializes the object.
  * `solCode.code`: the `<code>` originally passed.
  * `solCode.vmCode`: the compiled EVM bytecode, initially `undefined`.
  * `solCode.symtab`: the "symbol table" of the Solidity code.  This
    records all top-level declarations of types, functions, and
    variables, including all contracts it defines.  It assigns a
    memory layout to the variables in compliance with the Solidity
    conventions (see the [Solidity
    tutorial](https://github.com/ethereum/wiki/wiki/Solidity-Tutorial#layout-of-state-variables-in-storage))
    and records their types.  Normally, a user should not need to know
    the details of this data structure.
  * `solCode.compile(apiURL, callback)`: compiles the code and stores
    its EVM bytecode and symbol table, then calls `callback(solCode)`.
  * `solCode.submit({apiURL:<URL>, fromAccount:<Contract>, value:<ether amount>,
    gasPrice:<ether amount>, gasLimit:<ether amount>}, callback)`:
    submits the code to the Blockapps node at `apiURL` (thus, creating
    the contracts defined in it), constructs a Contract object
    `contract`, then calls `callback(contract)`.  The remaining
    parameters in the argument object determine the details of this
    transaction.
  * `solCode.toContract(argObj, callback)`: does both of the above in
    one operation, with `argObj` being the same as in
    `solCode.submit`.

### Transaction

The `Transaction` object represents an Ethereum transaction between
two accounts or contracts.  Its constructor takes the parameters
required by Ethereum, except for the nonce and the cryptographic
fields.

* `var tx = Transaction({ fromAccount: <Contract>, toAccount: <Contract>, data: <hex string>, value: <ether amount>, gasPrice: <ether amount>, gasLimit: <ether amount> });` creates an object but does not send the transaction.
  * `tx.from`: equal to `fromAccount.address`
  * `tx.to`: if `toAccount` is not the null contract, is equal to
    `toAccount.address`.
  * `tx.codeOrData`: equal to `data`.  In the case of a message
    transaction, this typically encodes a call to a Solidity function
    (and is constructed by `toAccount.call`, described above).  In the
    case of contract creation, when `toAccount` is the null contract,
    it represents the code that creates the new contract (and is
    constructed by `solCode.compile`).
  * `tx.value`, `tx.gasPrice`, `tx.gasLimit`: are as given in the constructor.
  * `tx.nonce`: initially `undefined`.  The nonce of `fromAccount` at
    the time the transaction is sent.
  * `tx.r`, `tx.s`, `tx.v`, `tx.hash`: the cryptographic data constituting
    the transaction's signature.  Constructing this data requires the
    `fromAccount` be an account rather than a Solidity contract, as it
    needs to have a private key.
  * `tx.send(apiURL, callback)`: posts the contract to the Blockapps
    node at `apiURL`, waits for it to be mined on the Ethereum
    network, and calls `callback(tx)` when this is done.  Further queries to
    Blockapps can be done using `tx.hash` via the
    `/transactionResult/<hash>` route.  This API provides the two most
    useful, however, so this call need not be made unless transferring
    value directly.
  * `tx.contractCreated(apiURL, callback)`: queries the Blockapps node
    at `apiURL` for the `address` (as type `Address`) created by a
    contract-creation transaction, and calls `callback(address)`.
    Currently, we do not support Solidity code that creates multiple
    contracts simultaneously.

### Types

The `Types` object aggregates the types available in Solidity, exposed
as Javascript types.  Each of these has the following standard properties:

* `encoding()`: renders the object as a byte string as required by the [Ethereum Contract ABI](https://github.com/ethereum/wiki/wiki/Ethereum-Contract-ABI).
* `toString()`: renders the object as a human-friendly string.
* `toJSON()`: renders the object as JSON.
* `isFixed`: whether the object represents a Solidity type of fixed
  size (i.e. `uint32`, `bytes8[10]`) or not (i.e. `string`, `int[]`).

In addition, each of these objects inherits from Javascript objects of
similar types, providing just a small amount of extra metadata to
support Solidity.  The methods of these supertypes are available to
the Solidity types; however, if they return a value of the supertype,
it has to be cast to the Solidity type by re-applying the constructor.

The constructors are:

* `Address(x)`, where `x` may be a hex string, a number (that is
  internally encoded as a hex string), or a Node.js `Buffer`
  (containing the bytes represented by a hex string).  An Ethereum
  address is always 160 bits (20 bytes) and values will be padded (to
  the high bits) or truncated (from the high bits) as necessary.  Its
  string representation is as a hex string with the full 20 bytes.  An
  `Address` inherits from the `Buffer` type, and so supports [its
  API](https://nodejs.org/api/buffer.html).
* `Array(jsArr[, isFixed])`, where `jsArr` is a Javascript array
  containing various Solidity types.  Note that in Solidity itself,
  arrays must be homogeneous, but these need not be.  The optional
  `isFixed` argument defaults to `true`.  Note that `Array` is also
  the name of a standard Javascript object, so this particular type
  should not be imported under this name unqualified!  An `Array`
  inherits from the Javascript `Array`, in fact, and supports its API.
* `Bool(bool)`, where `bool` is a Javascript boolean.  It inherits
  from `Boolean`.
* `Bytes(x[, isFixed])`, where `x` can be either a hex string or a
  Node.js `Buffer`.  It inherits from `Buffer`, and its `toString()`
  member function renders it as an ASCII string, while `toJSON()`
  renders it as a hex string.
* `Enum(nameMap)`, where `nameMap` is a plain Javascript Object whose
  fields are the names and whose field values are the corresponding
  integral values of the enumeration.  It constructs an `enum` type,
  from the [Node.js module
  `enum`](https://www.npmjs.com/package/enum), but returns a function
  `f(x)`, where `x` is a number or hex string representing a number
  and `f(x)` is the *item* of the enumeration with this value.  The
  actual enumeration type is not available.  Its `toString()` method
  renders the enumeration name, and `valueOf()` renders the
  corresponding value.
* `Function(toContract, api)`, where `toContract` is the `Contract`
  owning this Solidity function, and `api` is an Object, such as those
  contained in the `symtab` argument to `Contract`, recording this
  function's arguments and return type.  This constructor returns a
  function `f(apiURL, callback, argObj, args..)` as in
  `contract.call`.  `f.toString()` returns a string similar to a
  Solidity function delcaration summarizing the function's signature.
  This function also has additional properties:
  * `f.domain`: a list of the names of the Solidity types of this
    function's arguments.
  * `f.returns`: the Solidity type of this function's return value.
  * `f.argNames`: a list of the *parameter names* given in the
    function declaration, in the same order as the domain.
* `Int(x)`, where `x` is a string, a Node.js Buffer, or any other value that can
  be converted to a
  [`big-integer`](https://www.npmjs.com/package/big-integer).  This
  type inherits from `big-integer` and its API is availble.
* `Mapping(f, solidityType)`, where `solidityType` is the Solidity
  type of this mapping (i.e. "`mapping(int => address)`") and `f` is a
  Javascript function with the same signature that implements the
  mapping.  This constructor just returns `f` augmented with the
  standard API properties and the following additional property:
  * `f.isMapping` is `true` for this type and `undefined` for all
    others, so `if(obj.isMapping)` correctly distinguishes this
    (rather special) type from others.
* `String(jsString)`, where `jsString` is a Javascript string.  This
  type inherits from [the Node.js type `string`](http://stringjs.com/)
  rather than the Javascript String, but one should (as with Array)
  not import this type directly as `String` to avoid overwriting it.
* `Struct(jsStruct)`, where `jsStruct` is a Javascript Object whose
  enumerable properties are copied by this constructor.

### Internal

The Internal object has three members:

* `Storage`, which abstracts the Ethereum VM storage.
* `EthWord`, which abstracts Ethereum's 256-bit words.
* `Crypto`, which contains the `sha3` hash function used by Ethereum (and, eventually, others).

It is not intended to be used.

## More information / wikis

## Development

```bash
$ npm install -g mocha
$ npm test
```
