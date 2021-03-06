module.exports = {
    Address : require("./Address"),
    Array : require("./Array"),
    Bool : require("./Bool"),
    Bytes : require("./Bytes"),
    Enum : require("./Enum"),
    Function : require("./Function"),
    Int : require("./Int"),
    Mapping : require("./Mapping"),
    String : require("./String"),
    Struct : require("./Struct"),
    solNameToSolType : solNameToSolType
}

function solNameToSolType(name, x) {
    var nameParts = name.split(/\d+/);
    switch (nameParts[0]) {
    case "int": case "uint" :
        return module.exports.Int(x);
    case "address":
        return module.exports.Address(x);
    case "bool":
        return module.exports.Bool(x);
    case "string":
        return module.exports.String(x);
    case "struct":
        return module.exports.Struct(x);
    case "bytes":
        var result = module.exports.Bytes(x);
        if (nameParts.length == 1) {
            result.isFixed = false;
        }
        return result;
    default: // arrays, enums, functions, mappings.  Only handle arrays.
        nameParts = name.split(/[a-zA-Z_]+/);
        if (nameParts.length > 0 && nameParts[0][0] === "[") {
            if (nameParts[0][1] === "]") {
                return Array(x,false);
            }
            else {
                return Array(x,true);
            }
        }
        break;
    }
}
