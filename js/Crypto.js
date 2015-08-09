var SHA3 = require('crypto-js/sha3');
var parseHex = require('crypto-js').enc.Hex.parse

module.exports = {
    sha3 : sha3,
}

function sha3(hexString) {
    return SHA3(parseHex(hexString), {outputLength:256}).toString();
}
