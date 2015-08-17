var Int = require("./Int.js");
var EthWord = require("./EthWord.js");
var HTTPQuery = require("./HTTPQuery.js");

module.exports = Storage;

function Storage(address) {
    return {
        "_keyvals" : {},
        "_address" : address,
        "sync"     : setStorageKeyVals,
        "atKey"    : getStorageKey,
        "chunk"    : getStorageChunk
    };
}

function getStorageChunk(start, itemsNum) {
    var output = [];

    Object.keys(this._keyvals).sort(String.compare).map(
        (function(key) {
            var keyNum = Int(key);
            var startNum = Int(start);
            if (keyNum.geq(startNum) && keyNum.lt(startNum.plus(itemsNum))) {
                var skipped = keyNum.minus(startNum).minus(output.length);
                pushZeros(output, skipped);
                output.push(this._keyvals[key]);
            }
        }).bind(this)
    );
    var remaining = itemsNum - output.length;
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
        "queryPath":"/storage",
        "get":{"address":this._address},
        "callback":setKeyvals.bind(this)
    });
}

function pushZeros(output, count) {
    for (var i = 0; i < count; ++i) {
        output.push(EthWord.zero());
    }
}

