module.exports = Struct;

function Struct(x) {
    var result = {};
    for (var key in x) {
        result[key] = x[key];
    }
    Object.defineProperties(result, {
        toString : {
            value : function() {return JSON.stringify(this);},
            enumerable : false
        },
        isFixed : {
            value : true,
            enumerable : false
        }
    });

    return result;
}
