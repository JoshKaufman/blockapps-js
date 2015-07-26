module.exports = Mapping

function Mapping(f, solidityType) {
    f.solidityType = solidityType;
    f.toString = function(){ return this.solidityType; },
    f.toJSON = function(){ return this.toString(); },
    f.isMapping = true;
    return f;
}
