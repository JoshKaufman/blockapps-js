var Int = require("./Int.js");

module.exports = EthWord;
module.exports.zero = EthWord.bind(undefined, "0");
module.exports.compare = Buffer.compare;
module.exports.isEthWord = Buffer.isBuffer;

function EthWord(x) {
    var hexString = x.slice(0);
    if (hexString.slice(0,2) === "0x") {
        hexString = hexString.slice(2);
    }
    if (hexString.length % 2 != 0) {
        hexString = "0" + hexString;
    }
    
    var numBytes = hexString.length / 2

    if (numBytes > 32) {
        numBytes = 32;
    }

    var result = new Buffer(32);
    result.fill(0);
    result.write(hexString, 32 - numBytes, numBytes, "hex");
    
    result.toString = result.toString.bind(result, "hex");
    result.lt = function(y) { return result.compare(y) == -1; };
    result.gt = function(y) { return result.compare(y) ==  1; };
    result.eq = result.equals;
    result.ge = function(y) { return result.gt(y) || result.eq(y) ; };
    result.le = function(y) { return result.lt(y) || result.eq(y) ; };

    result.plus = function(y) {
        var xNum = Int(result);
        var yNum = Int(y);
        return EthWord((xNum + yNum).toString());
    };
    result.minus = function(y) {
        if (result.gt(y)) {
            var xNum = Int(result);
            var yNum = Int(y);
            return EthWord((xNum - yNum).toString());
        }
    };
    
    return result;
}
