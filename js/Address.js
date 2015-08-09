module.exports = Address;

function Address(x) {
    if (this instanceof Address) {
        var result = new Buffer(20);
        if (typeof x === "string") {
            hexStringToBuffer.call(result, x);
        }
        else if (typeof x === "number") {
            hexStringToBuffer.call(result, x.toString(16));
        }
        else if (Buffer.isBuffer(x)) {
            x.copy(result, 20 - x.length);
        }
        Object.defineProperties(result, {
            encoding: {
                value : encodingAddress,
                enumerable : true
            },
            toString: {
                value : toStringAddress,
                enumerable: true
            },
            toJSON  : {
                value : toStringAddress,
                enumerable : true
            },
            isFixed : {
                value : true,
                enumerable : true
            },
            constructor : {
                value : Buffer,
                enumerable : true
            }
        });
        return result;
    }
    else {
        if (x.decode !== undefined) {
            return decodingAddress(x);
        }
        else {
            return new Address(x);
        }
    }
}

function toStringAddress() {
    return Buffer.prototype.toString.call(this,"hex");
}

function encodingAddress() {
    var result = this.toString();
    for (var i = 0; i < 12; ++i) {
        result = "00" + result;
    }
    return result;
}

function decodingAddress(x) {
    var result = new Address(x.slice(0,64));
    Object.defineProperties(result, {
        decodeTail : {
            value : x.slice(64),
            enumerable : false
        }
    });
    return result;
}

function hexStringToBuffer(hexString) {
    this.fill(0);

    if (hexString.slice(0,2) === "0x") {
        hexString = hexString.slice(2);
    }
    if (hexString.length > 40) {
        hexString = hexString.slice(-40);
    }
    if (hexString.length % 2 != 0) {
        hexString = "0" + hexString;
    }

    var byteLength = hexString.length/2;
    this.write(hexString, 20 - byteLength, byteLength, "hex");
}
