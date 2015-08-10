module.exports = Bool;

function Bool(x) {
    if (x.decode !== undefined) {
        return decodingBool(x);
    }
    var result = Boolean(x);
    result.toString = function () { return Boolean(x).toString(); };
    result.encoding = encodingBool;
    result.toJSON = function () { return this.toString(); };
    result.isFixed = true;
    return result;
}

function encodingBool() {
    var result = this ? "01" : "00";
    for (var i = 0; i < 31; ++i) {
        result = "00" + result;
    }
    return result;
}

function decodingBool(x) {
    var result = new Bool(x.slice(0,64)[-1] === '1');
    Object.defineProperties(result, {
        decodeTail : {
            value : x.slice(64),
            enumerable : false
        }
    });
    return result;    
}
