var ethTransaction = require('ethereumjs-tx');
var utils = require('ethereumjs-util');
var HTTPQuery = require("./HTTPQuery.js");
var Address = require("./Address.js");

module.exports = Transaction;

// argObj = {
//   fromAccount:, toAccount:, data:, value:, gasPrice:, gasLimit:
// }
function Transaction(argObj) {
    if (this instanceof Transaction) {
        this.from = argObj.fromAccount.address;
        this.gasPrice = argObj.gasPrice;
        this.gasLimit = argObj.gasLimit;
        if (argObj.toAccount.address !== null) {
            this.to = argObj.toAccount.address;
        }
        this.value = argObj.value;
        this.codeOrData = argObj.data;

        // These are set when sending because the nonce must be current
        this.nonce = undefined;
        this.r = undefined;
        this.s = undefined;
        this.v = undefined;
        this.hash = undefined;

        // Don't show up in the JSON
        this.send = sendTransaction;
        this.contractCreated = getContractCreated;
        this._fromAccount = argObj.fromAccount;
    }
    else {
        return new Transaction(argObj);
    }
}

function getContractCreated(apiURL, callback) {
    function firstContractCreated(transactionResultResponse) {
        if (typeof callback === "function") {
            var addr = transactionResultResponse[0].contractsCreated.split(",")[0];
            callback(Address(addr));
        }
    }

    HTTPQuery.queryAPI(apiURL + HTTPQuery.apiPrefix +
                       "/transactionResult/" + this.hash,
                       firstContractCreated);
}

function setCryptData(apiURL, callback) {
    var tx = new ethTransaction();

    tx.gasPrice = this.gasPrice;
    tx.gasLimit = this.gasLimit;
    tx.value = this.value;
    tx.data = this.codeOrData;
    if (typeof this.to !== "undefined") {
        tx.to = this.to.valueOf();
    }

    function copyCryptData () {
        this.nonce = this._fromAccount.nonce;
        tx.nonce = this.nonce.valueOf();
        tx.sign(this._fromAccount.privateKey);
        this.r = (tx.r).toString('hex');
        this.s = (tx.s).toString('hex');
        this.v = (tx.v).toString('hex');
        this.hash = tx.hash().toString('hex');

        callback();
    }

    this._fromAccount.sync(apiURL, copyCryptData.bind(this));
}

function sendTransaction(apiURL, callback) {
    function pollAndCallback() {
        var poller = setInterval(pollTX.bind(this), 500);
        function pollTX () {
            HTTPQuery.queryAPI(
                apiURL + HTTPQuery.apiPrefix +
                    "/transaction?hash=" + this.hash,
                checkTXPosted.bind(this)
            );
        }
        function checkTXPosted(txList) {
            if (txList.length != 0) {
                clearInterval(poller);
                if (typeof callback === "function") {
                    callback(this);
                }
            }
        }
    }

    function makeJSONQuery() {
        var jsonFields = ["from","to","nonce","value","gasPrice","gasLimit",
                          "codeOrData","r","s","v","hash"];
        this.value = this.value.toString(); // Stupid
        var txString = JSON.stringify(this, jsonFields);
        HTTPQuery.postAPI(apiURL + HTTPQuery.apiPrefix +
                          "/transaction", txString,
                          'application/json; charset=UTF-8',
                          pollAndCallback.bind(this)
                         );
    }

    setCryptData.bind(this)(apiURL, makeJSONQuery.bind(this));
}
