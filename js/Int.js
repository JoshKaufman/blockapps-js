module.exports = Int;

function Int(x) {
    if (x.decode !== undefined) {
        return decodingInt(x);
    }

    var bigInt = require('big-integer');
    var y;
    if (typeof x === "string" && x.slice(0,2) === "0x") {
        y = bigInt(x.slice(2),16);
    }
    else if (Buffer.isBuffer(x)) {
        y = bigInt(x.toString("hex"),16);
    }
    else {
        y = bigInt(x);
    }

    // Two's complement negation
    if (x.type !== undefined) {
        var symRow = x.type;
        var symType = symRow["solidityType"];
        if (y.geq(0) && symType[0] != 'u') {
            var bitSize = parseInt(symRow["bytesUsed"],16) * 8;
            var topBitInt = y.and(bigInt(1).shiftLeft(bitSize - 1));
            y = y.minus(topBitInt).minus(topBitInt);
        }
    }

    var constr = pickConstructor(y);
    return new constr(y);
}

function pickConstructor(y) {
    var bigInt = require('big-integer');
    var smallInt = bigInt(0);
    var smallIntProto = Object.getPrototypeOf(smallInt);
    var SmallInteger = smallIntProto.constructor;

    function SmallInt(smallbigInt) {
        SmallInteger.call(this, smallbigInt.value);
    }

    SmallInt.prototype = prototypeInt(smallIntProto, SmallInt);

    var bigInt = bigInt(1).shiftLeft(256);
    var bigIntProto = Object.getPrototypeOf(bigInt);
    var bigInteger = bigIntProto.constructor;

    function BigInt(bigbigInt) {
        bigInteger.call(this, bigbigInt.value, bigbigInt.sign);
    }

    BigInt.prototype = prototypeInt(bigIntProto, BigInt);

    if (y.isSmall) {
        return SmallInt;
    }
    else {
        return BigInt;
    }
}

function prototypeInt (baseProto, constr) {
    return Object.create(baseProto, { 
        encoding : {
            enumerable : true,
            value : encodingInt
        },
        toString : {
            enumerable : true,
            value : function () { return baseProto.toString.call(this,10); }
        },
        toJSON : {
            enumerable : true,
            value : function () {
                if (this.isSmall) {
                    return this.valueOf();
                }
                else {
                    return this.toString();
                }
            }
        },
        isFixed : {
            enumerable : true,
            value : true
        },
        constructor : {
            value : Int,
            enumerable : false
        }
    });
};

function encodingInt() {
    var bigInt = require('big-integer');
    var result;
    if (this.geq(0)) {
        bigIntProto = Object.getPrototypeOf(Object.getPrototypeOf(this));
        result = bigIntProto.toString.call(this,16);
        if (result.length % 2 != 0) {
            result = "0" + result;
        }
        while (result.length < 64) {
            result = "00" + result;
        }
    }
    else {
        result = Int(this.plus(Int.exp2(256))).encoding();
    }
    return result;
}

function decodingInt(x) {
    var result = new Int(x.slice(0,64));
    Object.defineProperties(result, {
        decodeTail : {
            value : x.slice(64),
            enumerable : false
        }
    });
    return result;
}
