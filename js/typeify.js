var Address = require("./Address");
var Array = require("./Array");
var Bool = require("./Bool");
var Bytes = require("./Bytes");
var Enum = require("./Enum");
//var Function = require("./Function");
var Int = require("./Int");
//var Mapping = require("./Mapping");
var String = require("./String");
var Struct = require("./Struct");

module.exports = typeify;

function typeify(jsVal, typeSymRow, decode) {
    switch (typeSymRow["jsType"]) {
    // Simple types
    case "Address" : return Address(jsVal, decode);
    case "Bool"    : return Bool(jsVal, decode);
    case "String"  : return String(jsVal, decode);
    case "Enum"    : return Enum(typeSymRow["enumNames"])(jsVal, decode);
    case "Int"     : return Int(jsVal, decode);
    // Compound types
    case "Bytes" :
        jsVal.isFixed = (typeSymRow["arrayLength"] !== undefined);
        return Bytes(jsVal, typeSymRow, decode);
    case "Array" :
        if (decode) {
            return Array(jsVal, typeSymRow, true);
        }
        else { // Assume we've got an array
            for (var i in jsVal) {
                jsVal[i] = typeify(jsVal[i], typeSymRow["arrayElement"], decode);
            }
            jsVal.isFixed = (typeSymRow["arrayLength"] !== undefined);
            return Array(jsVal);
        }
    case "Struct":
        // no decode for structs
        for (var field in jsVal) {
            var tmp = jsVal[field];
            var type = typeSymRow["structFields"][field];
            jsVal[field] = typeify(tmp, type, decode);
        }
        return Struct(jsVal);
    // We don't typeify functions or mappings
    }
}
