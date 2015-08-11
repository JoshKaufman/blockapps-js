var Int = require("./Int.js");
var typeify = require("./typeify.js");

module.exports = SolArray;

function SolArray(x) {
    if (x.isFixed === undefined) {
        x.isFixed = true;
    }
    if (x.decode !== undefined) {
        return decodingArray(x);
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
    var eltRow = x.decode["arrayElement"];
    var length;
    if (x.isFixed) {
        length = x.decode["arrayLength"];
    }
    else {
        var tmp = Int(x);
        length = tmp.valueOf();
        x = tmp.decodeTail.slice(length * 64); // Drop the "heads"
    }

    var result = [];
    while (result.length < length) {
        x.decode = true;
        x.type = eltRow;
        var tmp = typeify(x);
        x = tmp.decodeTail;
        result.push(tmp);
    }

    Object.defineProperties(result, {
        decodeTail : {
            value : x,
            enumerable : false
        }
    });
    return new Array(result);
}
