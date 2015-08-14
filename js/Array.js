var Int = require("./Int.js");
var typeify = require("./typeify.js");

module.exports = SolArray;

function SolArray(x, type, decode) {
    if (x.isFixed === undefined) {
        x.isFixed = true;
    }
    if (decode !== undefined) {
        return decodingArray(x, type);
    }

    x.toString = function() {
        return "[" + Array.prototype.toString.call(this) + "]";
    };
    x.toJSON = function () { return this.toString(); };
    x.encoding = encodingArray;
    x.constructor = SolArray;
    return x;
}
                        
function encodingArray() {
    var totalHeadLength = 0;
    var head = [];
    var tail = [];

    for (var i = 0; i < this.length; ++i) {
        var obj = this[i];
        if (!obj.isFixed)
        {
            totalHeadLength += 32;
            head.push(undefined);
            tail.push(obj.encoding());
        }
        else {
            var enc = obj.encoding();
            totalHeadLength += enc.length/2; // Bytes not nibbles
            head.push(enc);
            tail.push("");
        }
    }

    var currentTailLength = 0;
    for (var i = 0; i < tail.length; ++i) {
        if (head[i] === undefined) {
            head[i] = Int(totalHeadLength + currentTailLength).encoding();
        }
        currentTailLength += tail[i].length;
    }

    var enc = head.join("") + tail.join("");
    if (!this.isFixed) {
        len = Int(this.length).encoding()
        enc = len + enc
    }

    return enc;
}

// Only does homogeneous arrays
function decodingArray(x) {
    var eltRow = type["arrayElement"];
    var length;
    if (x.isFixed) {
        length = type["arrayLength"];
    }
    else {
        var tmp = Int(x);
        length = tmp.valueOf();
        x = tmp.decodeTail.slice(length * 64); // Drop the "heads"
    }

    var result = [];
    while (result.length < length) {
        var tmp = typeify(x, eltRow, true);
        x = tmp.decodeTail;
        result.push(tmp);
    }

    Object.defineProperties(result, {
        decodeTail : {
            value : x,
            enumerable : false
        }
    });
    return Array(result);
}
