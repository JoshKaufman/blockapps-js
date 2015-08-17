var Bytes = require("./Bytes.js")
var nodeString = require('string')

module.exports = SolString

function SolString(x, type, decode) {
    if (decode) {
        return Bytes(x, type, true);
    }
    
    var result = nodeString(x);
    Object.defineProperties(result, {
        encoding : {
            enumerable : true,
            value : encodingString
        },
        isFixed : {
            enumerable : true,
            value : false
        },
        toJSON : {
            enumerable : true,
            value : this.toString
        }
    });

    return result;
}

function encodingString() {
    var asBuffer = new Buffer(this.toString(), "utf8");
    asBuffer.isFixed = false;
    return Bytes(asBuffer).encoding();
}

