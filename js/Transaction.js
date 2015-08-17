var ethTransaction = require('ethereumjs-tx');
var utils = require('ethereumjs-util');
var HTTPQuery = require("./HTTPQuery.js");
var Address = require("./Address.js");

module.exports = Transaction;

// argObj = {
//   fromAccount:, toAccount:, data:, value:, gasPrice:, gasLimit:
// }
function Transaction(argObj) {
    var tx = new ethTransaction();
    tx.gasPrice = argObj.gasPrice;
    tx.gasLimit = argObj.gasLimit;
    tx.value = argObj.value;
    tx.data = argObj.data;

    Object.defineProperty(tx, "partialHash", {
        get : function() {
            return bufToString(ethTransaction.prototype.hash.call(this));
        }
    });
    
    if (argObj.toAccount.address !== null) {
        tx.to = argObj.toAccount.address;
    }

    var from = argObj.fromAccount;
    function sign(apiURL, callback) {
        function doSign () {
            this.nonce = from.nonce.valueOf();
            ethTransaction.prototype.sign.call(this, from.privateKey);
            callback();
        }

        from.sync(apiURL, doSign.bind(this));
    }
    tx.sign = sign;
    tx.send = sendTransaction;
    tx.toJSON = txToJSON;
    return tx;
}

function txToJSON() {
    var result = {
        "nonce"      : bufToNum(checkZero(this.nonce)),
        "gasPrice"   : bufToNum(checkZero(this.gasPrice)),
        "gasLimit"   : bufToNum(checkZero(this.gasLimit)),
        "value"      : bufToNum(checkZero(this.value)).toString(10),
        "codeOrData" : bufToString(this.data),
        "from"       : bufToString(this.from),
        "to"         : bufToString(this.to),
        "r"          : bufToString(this.r),
        "s"          : bufToString(this.s),
        "v"          : bufToString(this.v),
        "hash"       : this.partialHash
    }
    if (result["to"].length === 0) {
        delete result["to"];
    }
    return result;
}

function bufToNum(buf) {
    return parseInt(bufToString(buf),16);
}

function bufToString(buf) {
    return buf.toString("hex");
}

function checkZero(buf) {
    return (buf.length === 0) ? new Buffer([0]) : buf;
}

function sendTransaction(apiURL, callback) {
    function pollAndCallback() {
        var poller = setInterval(pollTX.bind(this), 500);
        var timeout = setTimeout(function() {
            clearInterval(poller);
            console.log("sendTransaction timed out");
        }, 10000);
        function pollTX () {
            HTTPQuery({
                "serverURI":apiURL,
                "queryPath":"/transactionResult/" + this.partialHash,
                "get":{},
                "callback":checkTXPosted.bind(this)
            });
        }
        function checkTXPosted(txList) {
            console.log(txList)
            if (txList.length != 0) {
                clearTimeout(timeout);
                clearInterval(poller);
                if (typeof callback === "function") {
                    txResult = txList[0];
                    var contractsCreated = txResult.contractsCreated.split(",");
                    txResult.contractsCreated = contractsCreated;
                    console.log(txResult);
                    callback(txResult);
                }
            }
        }
    }

    function sendTX() {
        console.log("TX json:" + JSON.stringify(this));
        HTTPQuery({
            "serverURI":apiURL,
            "queryPath":"/transaction",
            "data":this,
            "callback":pollAndCallback.bind(this)
        });
    }

    this.sign(apiURL, sendTX.bind(this));
}
