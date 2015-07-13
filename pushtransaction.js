var Ethereum = require('../index.js');
var Web3Coder = require('web3/lib/solidity/coder');
var CryptoJS = require('crypto-js')
var Transaction = Ethereum.Transaction;
var BigInt = require('big-integer');
//var BigNum = require('bignumber');

var rlp = Ethereum.rlp;
var utils = Ethereum.utils;

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
    console.log(symtab);
    
    function handleDynamicArray(symRow, nibbles) {}
    function handleFixedArray(symRow, nibbles) {}
    function handleMapping(symRow, nibbles) {
        
    }
    function handleShortInteger(symRow, nibbles) {}
    function handleShortType(symRow, nibbles) {
        var symKeyAndOffset = symRow["atStorageKey"].split("+")
        var symOffset = (symKeyAndOffset.length == 2) ? symKeyAndOffset[1] : "0x0";
        var intOffset = parseInt(symOffset,16);
        var intBytes = parseInt(symRow["bytesUsed"],16);
        var usedNibbles = nibbles.slice(2*intOffset, 2*(intOffset + intBytes));
        
        switch (symRow["solidityType"]) {
        case "bool" :
            return !nibbles.reduce(function (p, c, i, a) {
                return p && (c === "0");
            }, true);
        case "address" :
            return "0x" + nibbles.slice(-40).join("");
        default:
            handleShortInteger(symRow, usedNibbles);
            break;
        }
    }
    function handleLongType(symRow, nibbles) {
        switch(symRow["solidityType"]) {
        case 'uint256':
            var asNum = BigInt(nibbles.join(""),16);
            return asNum;
        case 'int256':
            var asNum = BigInt(nibbles.join(""),16);
            var topBitInt = asNum.and(BigInt(1).shiftLeft(255));
            return asNum.minus(topBitInt).minus(topBitInt); // 2's complement
        case 'bytes32': // bytes
            bytes = [];
            for (i = 0; i < 32; ++i) {
                b = [nibbles.shift(), nibbles.shift()].join("");
                bytes.push(String.fromCharCode(parseInt(b,16)));
            }
            return bytes.join("");
        case 'ureal128x128':
            // return BigNum(nibbles.join(""),16).div(BigNum(2).pow(128));
        case 'real128x128':
            // Don't need this.
        }
    }

    function handleVar(symRow, nibbles) {
        if (typeof symRow["arrayDataStart"] !== "undefined") {
            return handleDynamicArray(symRow,nibbles);
        }
        if (typeof symRow["arrayLength"] !== "undefined") {
            return handleFixedArray(symRow,nibbles);
        }
        if (typeof symRow["mappingKey"] !== "undefined") {
            return handleMapping(symRow,nibbles);
        }
        if (symRow["bytesUsed"] < 32) {
            return handleShortType(symRow,nibbles);
        }
        return handleLongType(symRow, nibbles);
    }

    this.showStorage = function(apiURL, f) {
        function handleStorage(keyvals) {
            var handledStorage = {};
            for (var sym in symtab) {
                console.log("Handling " + sym);
                if (typeof symtab[sym]["atStorageKey"] === "undefined") {
                    continue;
                }
                var symRow = symtab[sym];
                var symKeyAndOffset = symRow["atStorageKey"].split("+");
                var symKey = exports.hexStringAs64Nibbles(symKeyAndOffset[0]);
                var symVal = exports.hexStringAs64Nibbles("0x");
                if (typeof keyvals[symKey] !== "undefined") {
                    symVal = keyvals[symKey];
                }
                else {
                    console.log("Undefined storage key: " + symKey);
                }
                handledStorage[sym] = handleVar(symRow,symVal);
            }
            f(handledStorage);
        }
        
        exports.getStorage(apiURL, address, handleStorage);
    }
    // this.retrieve = function(varName,callback) {
    //     if (typeof symtab[varName] === "undefined") {
    //         return {};
    //     }
    //     var varJson = symtab[varname];
    //     var varType = varJson["solidityType"];

    //     if (typeof varJson["atStorageKey"] === "undefined") {
    //         return {};
    //     }
    //     var atKey = varJson["atStorageKey"];

    //     var filters = [
    //         "address=".concat(address),
    //         "keyhex=".concat(atKey)
    //     ].join("&");
    //     var query = "/query/storage?".concat(filters);

    //     var xhr = new XMLHttpRequest();
    //     xhr.open("GET", query, true);
    //     xhr.onreadystatechange = function() {
    //         if (xhr.readyState == 4) {
    //             if (typeof callback !== 'undefined') {
    //                 var handledVar = handleVar(varType,xhr.responseText);
    //                 console.log(handledVar);
    //                 callback(handledVar);
    //             }

    //             console.log(xhr.responseText);
    //         }

    //     }
    //     xhr.send();
    // }
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
    this.getBalance = function(apiURL, f) {
        function extractBalance(accountQueryResponse) {
            return accountQueryResponse[0].balance;
        }
        queryAPI(apiURL + "/query/account?address=" + address, extractBalance, f);
    }
}

exports.compile = function(apiURL, code, f) {
    var oReq = new XMLHttpRequest();
    oReq.open("POST", apiURL + "/solc", true);

    var params = "src=" + encodeURIComponent(code);
    oReq.setRequestHeader("Content-type", "application/x-www-form-urlencoded");

    oReq.onload = function () { 
        if(oReq.readyState == 4 && oReq.status == 200) {
            //console.log(this.responseText);
            var solcResult = JSON.parse(this.responseText);
            //console.log(solcResult);
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
        //console.log(txHash);
        exports.getContractsCreated(apiURL, txHash, f);
    }

    var fromAddress = utils.privateToAddress(new Buffer(privkey.value, 'hex')).toString('hex');
    //console.log(fromAddress);
  
    function push(nonce) {
        exports.pushTX(nonce, gasPrice, gasLimit, undefined, 0, bin, privKey, apiURL + "/includetransaction", getNewContracts);
    }

    exports.getNonce(apiURL, fromAddress, push);
}

function queryAPI (queryURL, handleResponse, callback) {
    var oReq = new XMLHttpRequest();
    oReq.open("GET", queryURL, true);
    oReq.onload = function () { 
        if(oReq.readyState == 4 && oReq.status == 200) {
	    var response = JSON.parse(this.responseText)
            console.log(response);
            callback(handleResponse(response));
	}
        else {
            console.log(this.responseText);
        }
    }

    oReq.send();
}

function getSomeStorage(queryURL, handleStorageKeyVals, f) {
    function makeStorageKeyVals(storageQueryResponse) {
        var keyvals = {};
        storageQueryResponse.forEach(function(x) {
            var canonKey = exports.hexStringAs64Nibbles(x.key);
            var canonValue = exports.hexStringAs64Nibbles(x.value);
            keyvals[canonKey] = canonValue;
        });
        return keyvals;
    }    
    function handleStorage (storageQueryResponse) {
        return handleStorageKeyVals(makeStorageKeyVals(storageQueryResponse));
    }
    queryAPI(queryURL, handleStorage, f);
}

exports.getStorage = function(apiURL, address, f) {
    getSomeStorage(apiURL + "/query/storage?address=" + address,
                   function g(x) {return x}, f);
}

exports.getStorageKey = function(apiURL, address, keyhex, f) {
    getSomeStorage(apiURL + "/query/storage?address=" + address
                   + "&keyhex=" + keyhex, function g(x) {}, f);
}

exports.getContractsCreated = function(apiURL, txHash, f) {
    function firstContractCreated(transactionResultResponse) {
        return transactionResultResponse[0].contractsCreated.split(",")[0];
    }

    alert("Push OK to get contracts");
    queryAPI(apiURL + "/transactionResult/" + txHash,
                     firstContractCreated, f);
}

exports.getNonce = function(apiURL, address, f) {
    function firstNonce(accountQueryResponse) {
        return accountQueryResponse[0].nonce;
    }

    queryAPI(apiURL + "/query/account?address=" + address,
                     firstNonce, f);
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
    //console.log(txString);
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

