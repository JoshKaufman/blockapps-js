var SolTypes = require("./SolTypes.js");
var Storage = require("./Storage.js");
var Transaction = require("./Transaction.js");
var HTTPQuery = require("./HTTPQuery.js");
var EthWord = require("./EthWord.js");

var privateToAddress = require('ethereumjs-util').privateToAddress;
var sha3 = require("./Crypto.js").sha3;

module.exports = Contract;

// argObj = { privkey: } | { address:, symtab: }
function Contract(argObj) {
    if (this instanceof Contract) {
        this.balance = SolTypes.Int(0);
        this.nonce = SolTypes.Int(0); 

        if (argObj === undefined) {
            this.address = null;
        }
        else if (argObj.privkey !== undefined) {
            this.privateKey = new Buffer(argObj.privkey, "hex");
            var addrBuf = privateToAddress(this.privateKey);
            this.address = SolTypes.Address(addrBuf);
            this.sync = syncAccount;
        }
        else if (argObj.address !== undefined) {
            this.address = SolTypes.Address(argObj.address);
            this.get = getSingleVar;
            this.call = call;
            this._storage = Storage(this.address);

            this.sync = syncContract.bind(this, argObj.symtab);
            setVars.bind(this)(argObj.symtab);
            setFuncs.bind(this)(argObj.symtab);
        }
    }
    else {
        return new Contract(argObj);
    }
}

function getSingleVar(apiURL, callback, varName) {
    this.sync(apiURL, callbackOn);

    function callbackOn() {
        if (typeof callback === "function") {
            callback(this.get[varName]);
        }
    }
}

// argObj = {
//   funcName:, fromAccount:, value:, gasPrice, gasLimit
// }
function call(apiURL, callback, argObj) {
    var funcName = argObj.funcName;
    if (this.call[funcName] !== undefined) {
        delete argObj.funcName;
        this.call[funcName].apply(this,arguments);
    }
    else {
        return null;
    }
}

function syncContract(symtab, apiURL, f) {
    var done = false;
    function doCallbackWhenDone () {
        if (done) {
            if (typeof f === "function") {
                f();
            }
        }
        else {
            done = true;
        }
    }

    function setVarsAndCallback() {
        setVars.bind(this)(symtab);
        doCallbackWhenDone.bind(this)();
    }
    this._storage.sync(apiURL, setVarsAndCallback.bind(this));
    syncAccount.bind(this)(apiURL, doCallbackWhenDone.bind(this));
}

function syncAccount(apiURL, f) {
    function setBalanceAndNonce(accountQueryResponse) {
        var firstAccount = accountQueryResponse[0];
        this.balance = SolTypes.Int(firstAccount.balance);
        this.nonce   = SolTypes.Int(firstAccount.nonce);
        if (typeof f === "function") {
            f();
        }
    }

    HTTPQuery({
        "serverURI":apiURL,
        "queryPath":"/query/account",
        "get":{"address":this.address},
        "callback":setBalanceAndNonce.bind(this)
    });
}

function setFuncs(symtab) {
    for (var sym in symtab) {
        var symRow = symtab[sym];
        if (symRow["functionHash"] !== undefined) { // Only functions
            this.call[sym] = SolTypes.Function(this, symRow);
        }
    }
}

function setVars(symtab) {
    for (var sym in symtab) {
        // Skip type declarations and functions
        if (symtab[sym]["atStorageKey"] !== undefined) {
            this.get[sym] = handleVar.bind(this)(symtab[sym], symtab);
        }
    }
}

function handleVar(symRow, symtab) {
    if (typeof symRow["arrayLength"] !== "undefined") {
        return handleFixedArray.bind(this)(symRow, symtab);
    }
    if (typeof symRow["arrayDataStart"] !== "undefined") {
        return handleDynamicArray.bind(this)(symRow, symtab);
    }
    if (typeof symRow["mappingValue"] !== "undefined") {
        return handleMapping.bind(this)(symRow, symtab);
    }

    var typeName = symRow["solidityType"];
    if (typeof symtab[typeName] === "undefined") {
        return handleSimpleType.bind(this)(symRow);
    }
    
    var typeSymTab = symtab[typeName];
    if (typeof typeSymTab["enumNames"] != "undefined") {
        var enumNames = typeSymTab["enumNames"];
        return handleSimpleType.bind(this)(symRow,typeSymTab["enumNames"]);
    }
    if (typeof typeSymTab["structFields"] !== "undefined") {
        var structFields = typeSymTab["structFields"];
        return handleStruct.bind(this)(EthWord(symRow["atStorageKey"]), structFields, symtab);
    }
}

function handleFixedArray(symRow, symtab) {
    var eltRow = {};
    Object.getOwnPropertyNames(symRow["arrayElement"]).forEach(
        function(name) {
            eltRow[name] = symRow["arrayElement"][name];
        }
    );
    eltRow["atStorageKey"] = symRow["atStorageKey"];
    eltRow["atStorageOffset"] = "0x0";

    var eltSize = parseInt(eltRow["bytesUsed"],16);
    var numElts = parseInt(symRow["arrayLength"],16);

    var arrayCR = parseInt(symRow["arrayNewKeyEach"],16);
    var arrayCRSkip = (eltSize < 32 ? 1 : eltSize / 32);

    var result = [];
    while (result.length < numElts) {
        result.push(handleVar.bind(this)(eltRow, symtab));
        if (result.length % arrayCR == 0) {
            var oldKey = SolTypes.Int(eltRow["atStorageKey"]);
            eltRow["atStorageKey"] = oldKey.plus(arrayCRSkip).toString(16);
            eltRow["atStorageOffset"] = "0x0";
        }
        else {
            var oldOff = parseInt(eltRow["atStorageOffset"]);
            eltRow["atStorageOffset"] = (eltSize + oldOff).toString(16);
        }
    }
    result.isFixed = true;
    return SolTypes.Array(result);
}
function handleDynamicArray(symRow, symtab) {
    var key = EthWord(symRow["atStorageKey"]);
    var length = this._storage.atKey(key);
    var realKey = symRow["arrayDataStart"];

    if (typeof symRow["arrayElement"] !== "undefined") {
        var fixedArrayRow = {};
        Object.getOwnPropertyNames(symRow).forEach(
            function(name) {
                fixedArrayRow[name] = symRow[name];
            }
        );
        fixedArrayRow["atStorageKey"] = realKey;
        fixedArrayRow["arrayLength"] = length.toString("hex");
        delete fixedArrayRow["arrayDataStart"];
        result = handleFixedArray.bind(this)(fixedArrayRow, symtab);
        result.isFixed = false;
        return result;
    }
    else {
        var numSlots = SolTypes.Int(length).over(32);
        var rawData = this._storage.chunk(realKey,numSlots);
        if (symRow["solidityType"] == "bytes") {
            return SolTypes.Bytes(rawData, false);
        }
        if (symRow["solidityType"] == "string") {
            return SolTypes.String(rawData.toString('utf8'));
        }
        return null; // I think that's it
    }
}

function handleMapping(symRow, symtab) {
    var result = SolTypes.Mapping(
        (function (x) {
            var canonKeyAt = EthWord(symRow["atStorageKey"]);
            var key = sha3(x.encoding() + canonKeyAt.toString());
            var eltRow = {};
            Object.getOwnPropertyNames(symRow["mappingValue"]).forEach(
                function(name) {
                    eltRow[name] = symRow["mappingValue"][name];
                }
            );
            eltRow["atStorageKey"] = key;
            return handleVar.bind(this)(eltRow, symtab);
        }).bind(this),
        symRow["solidityType"]
    );
    return result;
}

function handleSimpleType(symRow) {
    var symKey = EthWord(symRow["atStorageKey"]);
    var symOffset = (typeof symRow["atStorageOffset"] === "undefined") ?
        "0x0" : symRow["atStorageOffset"];
    var intOffset = parseInt(symOffset,16);
    var intBytes = parseInt(symRow["bytesUsed"],16);

    var nibbles = this._storage.atKey(symKey);
    var usedNibbles = nibbles.slice(-(intBytes + intOffset)).slice(0,intBytes);
    usedNibbles.type = symRow;
    usedNibbles.isFixed = true;
    
    var prefix =
        arguments[1] === undefined ?
        symRow["solidityType"].split(/\d+/)[0] :
        "enum";

    switch (prefix) {
    case 'bool' :
        var zeros = new Buffer(intBytes);
        zeros.fill(0);
        return SolTypes.Bool(!usedNibbles.equals(zeros));
    case 'address' :
        return SolTypes.Address(usedNibbles);
    case 'uint': case 'int':
        return SolTypes.Int(usedNibbles);
    case 'bytes':
        return SolTypes.Bytes(usedNibbles);
    case 'enum':
        return SolTypes.Enum(arguments[1])(usedNibbles.toString("hex"));
    // case 'real': case 'ureal':
    default:
        return null; // This includes contract types, which we don't support
    }
}

function handleStruct(baseKey, structFields, symtab) {
    var result = {};
    for (var field in structFields) {
        var fieldRow = {};
        Object.getOwnPropertyNames(structFields[field]).forEach(
            function(name) {
                fieldRow[name] = structFields[field][name];
            }
        );
        var fieldKey = EthWord(fieldRow["atStorageKey"]);
        var realKey = baseKey.plus(fieldKey);
        fieldRow["atStorageKey"] = realKey.toString();
        if (fieldRow["arrayNewKeyEach"] !== undefined &&
            fieldRow["arrayLength"] === undefined) { // Dyn. array, bytes, or string
                fieldRow["arrayDataStart"] =
                sha3(realKey.toString());
        }
        result[field] = handleVar.bind(this)(fieldRow, symtab);
    }

    return SolTypes.Struct(result);
}

// function handleReal(symRow, usedNibbles, prefix) {
//     var precision = parseInt(symRow["solidityType"].split(/\D+/,16)[-1]);
//     var denom = BigNum(2).pow(precision);
//     var numer = BigNum(usedNibbles.join(""));

//     switch(prefix) {
//     case "ureal":
//         return numer.over(denom);
//     case "real":
//         var bitSize = 8*parseInt(symRow["bytesUsed"],16);
//         var topBitInt = bigNum(2).pow(bitSize - 1);
//         var asInt = numer;
//         if (asInt.gte(topBitInt)) {
//             asInt = asInt.minus(topBitInt).minus(topBitInt);
//         }
//         return asInt.over(denom);            
//     default:
//         return null; // I don't think there is anything else, though
//     }
// }

