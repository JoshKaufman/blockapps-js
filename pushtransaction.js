var Ethereum = require('../index.js');
var Web3Coder = require('web3/lib/solidity/coder');
var CryptoJS = require('crypto-js')
var Transaction = Ethereum.Transaction;

var rlp = Ethereum.rlp;
var utils = Ethereum.utils;

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
 console.log(JSON.stringify(js));

 var xhr = new XMLHttpRequest();
 xhr.open("POST", url, true);
 xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');   


 xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {

	if (typeof f !== 'undefined') {
	        f(xhr.responseText);
	    }

	console.log(xhr.responseText);
    }
 }

 xhr.send(JSON.stringify(js));
}

