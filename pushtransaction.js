var Ethereum = require('../index.js');
var Web3Coder = require('web3/lib/solidity/coder');
var CryptoJS = require('crypto-js')
var Transaction = Ethereum.Transaction;
var BigInt = require('big-integer');
//var BigNum = require('bignumber');

var rlp = Ethereum.rlp;
var utils = Ethereum.utils;

exports.getContract = function(code, privKey, gasPrice, gasLimit, f) {
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

        exports.submit(bin, privKey, gasPrice, gasLimit, submitCallback);
    }

    exports.compile(code, compileCallback);
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

    this.showStorage = function(f) {
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
        
        exports.getStorage(address, handleStorage, "http://stablenet.blockapps.net");
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
}

exports.getStorage = function(address, f, urlroot) {
    var urlcat = "";
    if (!(typeof urlroot === 'undefined')) {
      urlcat = urlroot;
    };
   
    var oReq = new XMLHttpRequest();
    oReq.open("GET", urlcat + "/query/storage?address=" + address, true);
    oReq.onload = function () { 
        if(oReq.readyState == 4 && oReq.status == 200) {
	    var storage = JSON.parse(this.responseText);
            var keyvals = {};
            storage.forEach(function(x) {
                canonKey = exports.hexStringAs64Nibbles(x.key);
                canonValue = exports.hexStringAs64Nibbles(x.value);
                keyvals[canonKey] = canonValue;
            });
            console.log(keyvals);
            f(keyvals);
	}
        else {
            console.log(this.responseText);
        }
    }

    oReq.send();
}

exports.compile = function(code, f) {
    var oReq = new XMLHttpRequest();
    oReq.open("POST", "/solc", true);

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

exports.submit = function(bin, privKey, gasPrice, gasLimit, f) {
    function getNewContracts (txHashQuery) {
        var txHash = txHashQuery.split('=')[1];
        //console.log(txHash);
        exports.getContractsCreated(txHash, f);
    }

    var fromAddress = utils.privateToAddress(new Buffer(privkey.value, 'hex')).toString('hex');
    //console.log(fromAddress);
  
    function push(nonce) {
        exports.pushTX(nonce, gasPrice, gasLimit, undefined, 0, bin, privKey, "/includetransaction", getNewContracts);
    }

    exports.getNonce(fromAddress, push);
}

exports.getContractsCreated = function(txHash, f) {
    var oReq = new XMLHttpRequest();
    oReq.open("GET", "/transactionResult/" + txHash, true);
    oReq.onload = function () { 
        if(oReq.readyState == 4 && oReq.status == 200) {
	    var contracts = JSON.parse(this.responseText)[0]["contractsCreated"].split(",")[0];
            console.log(contracts);
            f(contracts);
	}
        else {
            console.log(this.responseText);
        }
    }
    alert("Push OK to get contracts");
    oReq.send();
}

exports.getNonce = function(address, f) {
    var oReq = new XMLHttpRequest();
    oReq.open("GET", "/query/account?address=" + address, true);
    oReq.onload = function () { 
        if(oReq.readyState == 4 && oReq.status == 200) {
	    var nonce = JSON.parse(this.responseText)[0].nonce;
            //console.log(nonce);
            f(nonce);
	}
        else {
            console.log(this.responseText);
        }
    }

    oReq.send();
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

