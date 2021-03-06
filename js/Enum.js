var nodeEnum = require('enum');
var Int = require("./Int");

module.exports = Enum;

function Enum (nameMap) {    
    var enumType = new nodeEnum(nameMap);
    Object.defineProperties(enumType, {
        size        : { enumerable : false },
        indirection : { enumerable : false },
        _options    : { enumerable : false },
        isFlaggable : { enumerable : false }
    });
    Object.seal(enumType);

    function EnumItem (x, decode) {
        if (decode !== undefined) {
            return decodingEnum(x);
        }
        if (typeof x === "string" ) {
            x = parseInt(x,16);
        }
        var item = enumType.get(x);
        var nodeEnumItem = Object.getPrototypeOf(item).constructor;
        nodeEnumItem.call(this, item.key, item.value);
        Object.defineProperties(this, {_options : {enumerable : false}});
    }
    EnumItem.prototype = Object.create(
        Object.getPrototypeOf(enumType.enums[0]),
        {
            encoding : {
                enumerable : true,
                value : function () { return Int(this.value).encoding(); }
            },
            toJSON : {
                enumerable : true,
                value : function () { return this.toString() ; }
            },
            isFixed : {
                enumerable : true,
                value : true
            }
        }
    );
    EnumItem.prototype.construtor = EnumItem;
    Object.defineProperties(EnumItem.prototype, {constructor : {enumerable:false}});

    return EnumItem;
}

function decodingEnum(x) {
    return Enum(Int(x).valueOf());
}
