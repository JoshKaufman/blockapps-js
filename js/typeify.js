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

function typeify(jsVal) {
    var typeSymRow = jsVal.type;
    
    switch (typeSymRow["jsType"]) {
    // Simple types
    case "Address" : return Address(jsVal);
    case "Bool"    : return Bool(jsVal);
    case "String"  : return String(jsVal);
    case "Enum"    : return Enum(typeSymRow["enumNames"])(jsVal);
    case "Int"     : return Int(jsVal);
    // Compound types
    case "Bytes" :
        jsVal.isFixed = (typeSymRow["arrayLength"] !== undefined);
        return Bytes(jsVal);
    case "Array" :
        for (var i in jsVal) {
            var tmp = jsVal[i];
            tmp.type = typeSymRow["arrayElement"];
            jsVal[i] = typeify(tmp);
        }
        jsVal.isFixed = (typeSymRow["arrayLength"] !== undefined);
        return Array(jsVal);
    case "Struct":
        for (var field in jsVal) {
            var tmp = jsVal[field];
            tmp.type = typeSymRow["structFields"][field];
            jsVal[field] = typeify(tmp);
        }
        return Struct(jsVal);
    // We don't typeify functions or mappings
    }
}
