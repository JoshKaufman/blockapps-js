var Int = require("./Int.js");
var EthWord = require("./EthWord.js");
var HTTPQuery = require("./HTTPQuery.js");

module.exports = Storage;

function Storage(address) {
    if (this instanceof Storage) {
        this._keyvals = {};
        this._address = address;
        this.sync = setStorageKeyVals;
        this.atKey = getStorageKey;
        this.chunk = getStorageChunk;
    }
    else {
        return new Storage(address);
    }
}

function getStorageChunk(start, itemsNum) {
    var output = [];

    Object.keys(this._keyvals).sort(EthWord.compare).map(
        function(key) {
            if (key.ge(start) && key.lt(startNum.plus(itemsNum))) {
                var skipped = keyNum.minus(startNum).minus(output.length);
                pushZeros(output, skipped);
                output.push(this._keyvals(key));
            }
        });
    var remaining = itemsNum.minus(output.length);
    pushZeros(output, remaining);
    return Buffer.concat(output, 32 * itemsNum);
}

function getStorageKey(key) {
    if (typeof this._keyvals[key] === "undefined") {
        return EthWord.zero();
    }
    else {
        return this._keyvals[key];
    }
}

function setStorageKeyVals(apiURL, f) {
    function setKeyvals (storageQueryResponse) {
        var keyvals = {};
        storageQueryResponse.forEach(function(x) {
            var canonKey = EthWord(x.key);
            var canonValue = EthWord(x.value);
            keyvals[canonKey] = canonValue;
        });

        this._keyvals = keyvals;
        f();
    }
    
    HTTPQuery({
        "serverURI":apiURL,
        "queryPath":"/query/storage",
        "get":{"address":this._address},
        "callback":setKeyvals.bind(this)
    });
}

function pushZeros(output, count) {
    for (i = 0; count.gt(i); ++i) {
        output.push(EthWord.zero());
    }
}

