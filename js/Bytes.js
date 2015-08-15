var Int = require("./Int.js")

module.exports = Bytes;

function Bytes(x, type, decode) {
    if (x.isFixed === undefined) {
        x.isFixed = true;
    }
    if (decode !== undefined) {
        return decodingBytes(x, type);
    }
    
    var result;
    console.log("Bytes x:"); console.log(x);
    if (Buffer.isBuffer(x)) {
        result = new Buffer(x);
    }
    else {
        result = hexStringToBuffer(x);
    }
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
        var tmp = Int(x);
        length = tmp.valueOf();
        x = tmp.decodeTail;
    }
    var roundLength = 2*Math.floor(length + 32); // Rounded up, in nibbles

    console.log("x: "); console.log(x);
    var result = Bytes(x.slice(0,roundLength));
    console.log("result: "); console.log(result);
    result = result.slice(0,length);
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

function hexStringToBuffer(hexString) {
    if (hexString.slice(0,2) === "0x") {
        hexString = hexString.slice(2);
    }
    if (hexString.length % 2 != 0) {
        hexString = "0" + hexString;
    }

    var byteLength = hexString.length/2;
    var result = Buffer(byteLength);
    result.write(hexString, 0, byteLength, "hex");
    return result;
}
