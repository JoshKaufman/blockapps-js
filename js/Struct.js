module.exports = Struct;

function Struct(x) {
    if (this instanceof Struct) {
        for (var key in x) {
            this[key] = x[key];
        }
    }
    else {
        if (x.decode !== undefined) {
            return decodingStruct(x);
        }
        else {
            return new Struct(x);
        }
    }
}

Struct.prototype = {
    toString :  function() {return JSON.stringify(this);},
    isFixed : true
};
Struct.prototype.constructor = Struct;
Object.defineProperties(Struct.prototype, {constructor : {enumerable:false}});
