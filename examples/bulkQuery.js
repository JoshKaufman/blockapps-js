var Contract = require("Contract");
var Solidity = require("Solidity");
var claimEther = require("claimEther");

var apiURL = "http://hacknet.blockapps.net";
var contract;
var keystore;
var names = {};

window.onload = start;

function start() {
    var randomSeed = ethlightjs.keystore.generateRandomSeed();
    keystore = new ethlightjs.keystore(randomSeed, "");
    Solidity(code).toContract({
        "apiURL"      : apiURL,
        "fromAccount" : Contract({"privkey":"1dd885a423f4e212740f116afa66d40aafdbb3a381079150371801871d9ea281"}), // e1fd0d
        "value"       : 0,
        "gasPrice"    : 1,
        "gasLimit"    : 3141592
    }, function(c) {
        console.log("contract:"); console.log(c);
        contract = c;
        document.getElementById("donate").disabled = false;
    });
}

function buttonPush() {
    var name = document.getElementById('patronName').value;
    patronize(
        apiURL,
        name,
        parseInt(document.getElementById('patronValue').value,10),
        contract,
        function () {
            document.getElementById('donate').disabled = true;
        },
        function (reply) {
            alert(reply);
            artistPlacard()
            document.getElementById('donate').disabled = false;
        });
}

function artistPlacard() {
    function printPlacard() {
        console.log(contract)
        var result = "";
        result += "My name is: " + contract.get["artist"] + "\n";
        result += "I have been generously supported by " + contract.get["numGrants"] + " grant(s) from the following patrons:" + "\n";
        contract.get["patrons"].forEach(function(addr) {
            console.log("Addr:");console.log(addr.toString());
            var patron = contract.get["patronInfo"](addr);
            result += "  The honorable " + patron.name;
            if (patron.returning) {
                result += " (repeatedly)";
            }
            result += ": " + patron.totalPayments + "\n";
        });
        document.getElementById("placardArea").textContent = result;
    }
    contract.sync(apiURL, printPlacard);
}


function patronKey(name) {
    if (name in names) {
        return names[name];
    }
    else {
        var address = keystore.generateNewAddress("");
        names[name] = keystore.exportPrivateKey(address,"");
        return names[name];
    }
}

function patronize(blockappsNode, name, value, contract,
                   unavailable, usereply) {
    unavailable();
    var fromAccount = Contract({"privkey": patronKey(name)});

    claimEther({
        "apiURL" : blockappsNode,
        "callback" : afterFaucet,
        "contract" : fromAccount
    });
    
    function afterFaucet () {
        contract.call(blockappsNode, afterCall, {
            "funcName"    : "patronize",
            "fromAccount" : fromAccount,
            "value"       : value,
            "gasPrice"    : 1,
            "gasLimit"    : 3141592
        }, {
            "name" : name
        });
    }

    function afterCall(name) {
        contract.sync(blockappsNode, usereply.bind(null, name));
    }
}

var code = "\
contract StarvingArtist {\n\
  address teacher;\n\
  uint numGrants;\n\
  string artist;\n\
\n\
  struct PatronInfo {\n\
    string name;\n\
    bool returning;\n\
    uint totalPayments;\n\
  }\n\
  mapping (address => PatronInfo) patronInfo;\n\
\n\
  address[] patrons;\n\
\n\
  function StarvingArtist() {\n\
    teacher = msg.sender;\n\
    artist = \"Paul Gaugin\";\n\
    patrons.length = 0;\n\
  }\n\
\n\
  function patronize(string name) returns (string) {\n\
    ++numGrants;\n\
\n\
    if (msg.value == 0) {\n\
      return \"Thanks for nothing!\";\n\
    }\n\
\n\
    var patron = patronInfo[msg.sender];\n\
    string message;\n\
    if (patron.totalPayments == 0) {\n\
      ++patrons.length;\n\
      patrons[patrons.length - 1] = msg.sender;\n\
\n\
      patron.name = name;\n\
      patron.returning = false;\n\
      message = \"Thanks for your patronage!\";\n\
    }\n\
    else if (patron.returning == false) {\n\
      patron.returning = true;\n\
      message = \"Thanks for returning!\";\n\
    }\n\
    else {\n\
       message = \"Hello again!\";\n\
    }\n\
    patron.totalPayments += msg.value;\n\
    patronInfo[msg.sender] = patron;\n\
    return message;\n\
  }\n\
\n\
}";
