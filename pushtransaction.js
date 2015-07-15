var Ethereum = require('../index.js');
var Web3Coder = require('web3/lib/solidity/coder');
var CryptoJS = require('crypto-js')
var Transaction = Ethereum.Transaction;
var BigInt = require('big-integer');
var utf8 = require('utf8');
//var BigNum = require('bignumber');

var rlp = Ethereum.rlp;
var utils = Ethereum.utils;

function asInt(hexString) {
    if (hexString.length >= 2 && hexString.slice(0,2) == "0x") {
        hexString = hexString.slice(2);
    }
    return BigInt(hexString,16)
}

function asString(nibbleList) {
    var bytes = [];
    while (nibbleList.length > 0) { // Can't be that long
        b = "0x" + [nibbleList.shift(), nibbleList.shift()].join("");
        bytes.push(String.fromCharCode(parseInt(b,16)));
    }
    return bytes.join("");
}

exports.getContract = function(apiURL, code, privKey, gasPrice, gasLimit, f) {
    function compileCallback(compiled) { 
        if (compiled["contracts"].length != 1) {
            console.log("Code must define one and only one contract");
            return;
            // We can collate multiple contracts by matching names
        }
        var name = compiled["contracts"][0]["name"];
        var bin  = compiled["contracts"][0]["bin"];
        var abi  = compiled["abis"][0]["abi"];
        var symtab = compiled["xabis"][name];

        function submitCallback(address) {
            var contract = new exports.Contract(address, abi, symtab);
            f(contract);
        }

        exports.submit(apiURL, bin, privKey, gasPrice, gasLimit, submitCallback);
    }

    exports.compile(apiURL, code, compileCallback);
}

exports.Contract = function(address, abi, symtab) {
    function handleFixedArray(symRow) {
        var eltRow = Object.assign({},symRow["arrayElement"]);
        eltRow["atStorageKey"] = symRow["atStorageKey"];
        eltRow["atStorageOffset"] = "0x0";

        var eltSize = asInt(eltRow["bytesUsed"]);
        var numElts = asInt(symRow["arrayLength"]);

        var arrayCR = asInt(symRow["arrayNewKeyEach"]);
        var arrayCRSkip = (eltSize.lt(32) ? 1 : eltSize.over(32));

        var result = [];
        while (result.length < numElts) {
            result.push(handleVar.bind(this)(eltRow));
            if (BigInt(result.length).isDivisibleBy(arrayCR)) {
                var oldKey = asInt(eltRow["atStorageKey"]);
                eltRow["atStorageKey"] = oldKey.plus(arrayCRSkip).toString(16);
                eltRow["atStorageOffset"] = "0x0";
            }
            else {
                var oldOff = asInt(eltRow["atStorageOffset"]);
                eltRow["atStorageOffset"] = eltSize.plus(oldOff).toString(16);
            }
        }

        
        return result;
    }
    function handleDynamicArray(symRow) {
        var key = symRow["atStorageKey"];
        var length = this._storage.atKey(key).join("");
        var realKey = symRow["arrayDataStart"];

        if (typeof symRow["arrayElement"] !== "undefined") {
            var fixedArrayRow = Object.assign({},symRow);
            fixedArrayRow["atStorageKey"] = realKey;
            fixedArrayRow["arrayLength"] = length;
            delete fixedArrayRow["arrayDataStart"];
            return handleFixedArray.bind(this)(fixedArrayRow);
        }
        else {
            var numSlots = asInt(length).over(32);
            var rawData = this._storage.chunk(realKey,numSlots);
            var stringData = asString([].concat.apply([],rawData));
            if (symRow["solidityType"] == "bytes") {
                return stringData;
            }
            if (symRow["solidityType"] == "string") {
                return utf8.decode(stringData);
            }
            return null; // I think that's it
        }
    }
    function handleMapping(symRow) {
        return function (x) {
            var canonKeyAt = exports.hexStringAs64Nibbles(symRow["atStorageKey"]).join("");
            var key = CryptoJS.SHA3(x.toString(16) + canonKeyAt).toString(CryptoJS.enc.Hex);
            var eltRow = Object.assign({},symRow["mappingValue"]);
            eltRow["storageKeyAt"] = key;
            return handleVar.bind(this)(eltRow);
        }
    }

    // function finishWithReal(symRow, usedNibbles, prefix) {
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

    function structType(baseKey, structFields) {
        var result = {};
        for (var field in structFields) {
            var fieldRow = Object.assign({},structFields[field]);
            var fieldKey = asInt(fieldRow["atStorageKey"]);
            var realKey = baseKey.plus(fieldKey);
            fieldRow["atStorageKey"] = realKey.toString(16);
            result[field] = handleVar.bind(this)(fieldRow);
        }

        return result;
    }

    function enumType(enumNames, usedNibbles) {
        var result = {};
        result._nameMap = enumNames;
        result._nameList = [];
        for (var name in result._nameMap) {
            result._nameList[result._nameMap[name]] = name;
        }
        result._value = asInt(usedNibbles.join(""));
        result.setName = function (name) {
            result._value = result._nameMap[name];
        }
        result.getNum = function () {
            return result._value;
        }
        result.getName = function () {
            return result._nameList[result._value];
        }
        return result;
    }
    
    function userDefinedType(symRow, usedNibbles) {
        var typeName = symRow["solidityType"];
        if (typeof symtab[typeName] === "undefined") {
            return null;
        }
        
        var typeSymTab = symtab[typeName];
        if (typeof typeSymTab["structFields"] !== "undefined") {
            var baseKey = asInt(symRow["atStorageKey"]);
            return structType.bind(this)(baseKey, typeSymTab["structFields"]);
        }
        if (typeof typeSymTab["enumNames"] !== "undefined") {
            return enumType.bind(this)(typeSymTab["enumNames"], usedNibbles)
        }
    }
    
    function continueWithIntegral(symRow, usedNibbles) {
        var prefix = symRow["solidityType"].split(/\d+/)[0];
        switch(prefix) {
        case 'uint':
            return asInt(usedNibbles.join(""));
        case 'int':
            var bitSize = asInt(symRow["bytesUsed"]).times(8);
            var asUInt = asInt(usedNibbles.join(""));
            var topBitInt = asUInt.and(BigInt(1).shiftLeft(bitSize - 1));
            return asUInt.minus(topBitInt).minus(topBitInt); // 2's complement
        case 'bytes': // bytes
            return asString(usedNibbles);
        default:
            //return finishWithReal(symRow, usedNibbles, prefix);
            return userDefinedType.bind(this)(symRow, usedNibbles);
        }
    }

    function startWithNonNumeric(symRow, usedNibbles) {
        switch (symRow["solidityType"]) {
        case "bool" :
            return (parseInt(usedNibbles.join(""),16) != 0);
        case "address" :
            return "0x" + usedNibbles.join("");
        default:
            return continueWithIntegral.bind(this)(symRow, usedNibbles);
            break;
        }
    }

    function handleSimpleType(symRow) {
        var symKey = symRow["atStorageKey"]
        var symOffset = (typeof symRow["atStorageOffset"] === "undefined") ?
            "0x0" : symRow["atStorageOffset"];
        var intOffset = parseInt(symOffset,16);
        var intBytes = parseInt(symRow["bytesUsed"],16);

        // The reversing is an expedient way of dealing with big-endianness
        var nibbles = this._storage.atKey(symKey).slice(0).reverse();
        var usedNibbles = nibbles.slice(2*intOffset, 2*(intOffset + intBytes)).reverse();
        return startWithNonNumeric.bind(this)(symRow, usedNibbles);
    }

    function handleVar(symRow) {
        if (typeof symRow["arrayDataStart"] !== "undefined") {
            return handleDynamicArray.bind(this)(symRow);
        }
        if (typeof symRow["arrayLength"] !== "undefined") {
            return handleFixedArray.bind(this)(symRow);
        }
        if (typeof symRow["mappingValue"] !== "undefined") {
            return handleMapping.bind(this)(symRow);
        }
        return handleSimpleType.bind(this)(symRow);
    }

    this.address = address;
    this.makeCall = function(functionName, args) { // previously functionNameToData
        function matchesFunctionName(json) {
            return (json.name === functionName && json.type === "function");
        }

        function getTypes(json) {
            return json.type;
        }

        var funcJson = abi.filter(matchesFunctionName)[0];
        var types = (funcJson.inputs).map(getTypes);
        
        var fullName = functionName + '(' + types.join() + ')';
        var signature = CryptoJS.SHA3(fullName, { outputLength: 256 }).toString(CryptoJS.enc.Hex).slice(0, 8);
        var dataHex = signature + Web3Coder.encodeParams(types, args);
        
        return dataHex;
    }

    function Storage() {
        function makeStorageKeyVals(storageQueryResponse) {
            var keyvals = {};
            storageQueryResponse.forEach(function(x) {
                var canonKey = asInt(x.key);
                var canonValue = exports.hexStringAs64Nibbles(x.value);
                keyvals[canonKey] = canonValue;
            });
            return keyvals;
        }
        this.sync = function(apiURL, f) {
            set_keyvals = (function(keyvals) {
                this._keyvals = keyvals;
                f();
            }).bind(this)
            queryAPI(apiURL + "/query/storage?address=" + address,
                     makeStorageKeyVals, set_keyvals);
        }
        this.atKey = function(keyhex) {
            var keyNum = asInt(keyhex);
            if (typeof this._keyvals[keyNum] === "undefined") {
                return exports.hexStringAs64Nibbles("0x");
            }
            else {
                return this._keyvals[keyNum];
            }
        }
        this.chunk = function(startHex, itemsNum) {
            var startNum = asInt(startHex);
            var output = [];
            
            this._keyvals.keys().sort(function c(x,y) {return x.compare(y);}).map(
                function(key) {
                    if (keyNum.ge(startNum) && keyNum.lt(startNum.plus(itemsNum))) {
                        // Intentional conversion to native numbers
                        var skipped = keyNum.minus(startNum) - output.length;
                        for (i = 0; i < skipped; ++i) {
                            output.push(hexStringAs64Nibbles("0x"));
                        }
                        output.push(this._keyvals(key));
                    }
                });
            return output;
        }
    }
    this._storage = new Storage();

    this.sync = function (apiURL, f) {
        var done = false;
        function doCallbackWhenDone () {
            if (done) {
                f();
            }
            else {
                done = true;
            }
        }
        
        var setVars = (function () {
            for (var sym in symtab) {
                if (typeof symtab[sym]["atStorageKey"] === "undefined") {
                    continue;
                }
                this.vars[sym] = handleVar.bind(this)(symtab[sym]);
            }
            doCallbackWhenDone();
        }).bind(this);
        this._storage.sync(apiURL, setVars);
        
        var setBalanceAndNonce = (function (accountQueryResponse) {
            var firstAccount = accountQueryResponse[0];
            this.balance = firstAccount.balance;
            this.nonce   = firstAccount.nonce;
        }).bind(this);
        queryAPI(apiURL + "/query/account?address=" + address,
                 setBalanceAndNonce, doCallbackWhenDone);
    }

    this.vars = {};
}

exports.compile = function(apiURL, code, f) {
    var oReq = new XMLHttpRequest();
    oReq.open("POST", apiURL + "/solc", true);

    var params = "src=" + encodeURIComponent(code);
    oReq.setRequestHeader("Content-type", "application/x-www-form-urlencoded");

    oReq.onload = function () { 
        if(oReq.readyState == 4 && oReq.status == 200) {
            var solcResult = JSON.parse(this.responseText);
            f(solcResult);
        }
        else {
            console.log(this.responseText);            
        }
    }

    oReq.send(params);
}

exports.submit = function(apiURL, bin, privKey, gasPrice, gasLimit, f) {
    function getNewContracts (txHashQuery) {
        var txHash = txHashQuery.split('=')[1];
        exports.getContractsCreated(apiURL, txHash, f);
    }

    var fromAddress = utils.privateToAddress(new Buffer(privkey.value, 'hex')).toString('hex');
    
    var fromContract = new exports.Contract(fromAddress, {}, {});
    function push() {
        var nonce = fromContract.nonce;
        exports.pushTX(nonce, gasPrice, gasLimit, undefined, 0, bin, privKey,
                       apiURL + "/includetransaction", getNewContracts);
    }
    fromContract.sync(apiURL, push);
}

function queryAPI (queryURL, handleResponse, callback) {
    var oReq = new XMLHttpRequest();
    oReq.open("GET", queryURL, true);
    oReq.onload = function () { 
        if(oReq.readyState == 4 && oReq.status == 200) {
	    var response = JSON.parse(this.responseText)
            callback(handleResponse(response));
	}
        else {
            console.log(this.responseText);
        }
    }

    oReq.send();
}

exports.getContractsCreated = function(apiURL, txHash, f) {
    function firstContractCreated(transactionResultResponse) {
        return transactionResultResponse[0].contractsCreated.split(",")[0];
    }

    alert("Push OK to get contracts");
    queryAPI(apiURL + "/transactionResult/" + txHash,
                     firstContractCreated, f);
}

exports.pushTX  = function(nonce,gasPrice,gasLimit,toAddress,value,data,privKey,url,f)  {
    // need to add url default arg
    
    var tx = new Transaction();

    tx.nonce = nonce;
    tx.gasPrice = gasPrice;
    tx.gasLimit = gasLimit;
    tx.value = value;
    tx.data = data;

    // privKey is assumed to be a hex string   
    var privateKey = new Buffer(privKey, 'hex');
    
    var js;
    if ((typeof toAddress) !== 'undefined')
    {
        tx.to = toAddress;
        tx.sign(privateKey);
        
        js = {
            from : tx.getSenderAddress().toString('hex'),
            nonce : utils.bufferToInt(tx.nonce),
            gasPrice : utils.bufferToInt(tx.gasPrice),
            gasLimit : utils.bufferToInt(tx.gasLimit),
            to : toAddress.toString('hex'),
            value : utils.bufferToInt(tx.value).toString(),    
            codeOrData : (tx.data).toString('hex'),    
            r : (tx.r).toString('hex'),
            s : (tx.s).toString('hex'),
            v : (tx.v).toString('hex'),
            hash : tx.hash().toString('hex')
        };
    }
    else {
        tx.sign(privateKey);
        js = {
            from : tx.getSenderAddress().toString('hex'),
            nonce : utils.bufferToInt(tx.nonce),
            gasPrice : utils.bufferToInt(tx.gasPrice),
            gasLimit : utils.bufferToInt(tx.gasLimit),
            value : utils.bufferToInt(tx.value).toString(),    
            codeOrData : (tx.data).toString('hex'),    
            r : (tx.r).toString('hex'),
            s : (tx.s).toString('hex'),
            v : (tx.v).toString('hex'),
            hash : tx.hash().toString('hex')
        };
    }
    var xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');   

    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
	    f(xhr.responseText);
        }
    }

    var txString = JSON.stringify(js);
    xhr.send(txString);
}

exports.hexStringAs64Nibbles = function(hexString) {
    var rawArray = hexString.split("");
    if (rawArray[0] == "0" && rawArray[1] == "x") {
        rawArray = rawArray.slice(2);
    }
    while (rawArray.length < 64) {
        rawArray.unshift("0");
    }
    return rawArray;
}


// The original, now obsoleted functions

exports.functionNameToData = function(abi, functionName, args) {
  function matchesFunctionName(json) {
    return (json.name === functionName && json.type === "function");
  }

  function getTypes(json) {
    return json.type;
  }

  var funcJson = abi.filter(matchesFunctionName)[0];
  var types = (funcJson.inputs).map(getTypes);
 
  var fullName = functionName + '(' + types.join() + ')';
  var signature = CryptoJS.SHA3(fullName, { outputLength: 256 }).toString(CryptoJS.enc.Hex).slice(0, 8);
  var dataHex = signature + Web3Coder.encodeParams(types, args);
  
  return dataHex;
}

exports.loadVariableFromStorage = function(address, urlroot, callback) {
  var xhr = new XMLHttpRequest();
  var filters = "?address=".concat(address);

  var url = urlroot.concat(filters);

  xhr.open("GET", url, true);

  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {
      if (typeof callback !== 'undefined') {
	   callback(xhr.responseText);
      }

	console.log(xhr.responseText);
    }
 }

 xhr.send();
}

exports.loadVariableFromStorageKey = function(address, key, urlroot, callback) {
 var xhr = new XMLHttpRequest();
 var filters = "?address=".concat(address).concat("&keyhex=").concat(key);

 var url = urlroot.concat(filters);

 xhr.open("GET", url, true);

 xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {

	if (typeof callback !== 'undefined') {
	        callback(xhr.responseText);
	    }

	console.log(xhr.responseText);
    }
 }

 xhr.send();
}
// assume that key and index are 32 byte hex strings
exports.keyIndexToLookup = function(key,index) {
  var words = CryptoJS.enc.Hex.parse(key.concat(index));
  return CryptoJS.SHA3(words, { outputLength: 256}).toString(CryptoJS.enc.Hex);
}

exports.arrayIndexToLookup = function(index) {
  var words = CryptoJS.enc.Hex.parse(index);
  return CryptoJS.SHA3(words, { outputLength: 256}).toString(CryptoJS.enc.Hex);
}
