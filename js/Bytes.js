var Int = require("./Int.js")

module.exports = Bytes;

function Bytes(x, type, decode) {
    if (x.isFixed === undefined) {
        x.isFixed = true;
    }
    if (decode !== undefined) {
        return decodingBytes(x, type);
    }
    
    var result = new Buffer(x);
    Object.defineProperties(result, {
        encoding : {
            value: encodingBytes,
            enumerable: true
        },
        toString : {
            value: toStringBytes,
            enumerable: true
        },
        toJSON : {
            value: toJSONBytes,
            enumerable: true
        },
        isFixed : {
            value : x.isFixed,
            enumerable: true
        },
        constructor : {
            value : Bytes,
            enumerable: true
        }
    });
    return result;
}

function encodingBytes() {
    var result = this.toJSON();
    while (result.length % 32 != 0) {
        result = result + "00";
    }

    if (!this.isFixed) {
        var len = Int(this.length);
        result = len.encoding() + result;
    }
    
    return result;
}

function decodingBytes(x, type) {
    var length;
    if (type["arrayDataStart"] === undefined) {
        length = type["bytesUsed"];
    }
    else {
        var tmp = Int(x, true);
        length = tmp.valueOf();
        x = tmp.decodeTail;
    }
    var roundLength = Math.floor(length + 32); // Rounded up

    var result = Bytes(x.slice(0,length));
    Object.defineProperties(result, {
        decodeTail : {
            value : x.slice(roundLength),
            enumerable : false
        }
    });
    return result;
}

function toJSONBytes () {
    return Buffer.prototype.toString.call(this,"hex");
}

function toStringBytes() {
    return Buffer.prototype.toString.call(this,"ascii");
}
