var Bytes = require("./Bytes.js")
var nodeString = require('string')

module.exports = SolString

function SolString(jsString, decode) {
    if (this instanceof SolString) {
        // What is this?  I don't know what I was thinking here.
        this.setValue(jsString);
    }
    else {
        return new SolString(jsString);
    }
}

SolString.prototype = Object.create(
    Object.getPrototypeOf(nodeString("")),
    {
        encoding : {
            enumerable : true,
            value : encodingString
        },
        isFixed : {
            enumerable : true,
            value : false
        }
    }
);
SolString.prototype.constructor = SolString;
Object.defineProperties(SolString.prototype, {constructor : {enumerable:false}});

function encodingString() {
    return Bytes(new Buffer(this.toString(), "utf8")).encoding();
}

function decodingString() {
    // This class is broken anyway
}
