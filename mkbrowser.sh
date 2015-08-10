#!/bin/bash
mv js/HTTPQuery.js js/HTTPQuery-node.js
sed 's/require("request")/require("browser-request")/' js/HTTPQuery-node.js >js/HTTPQuery.js
browserify -r ./js/Contract:Contract -r ./js/Transaction:Transaction -r ./js/Solidity:Solidity > api-tmp.js
minify api-tmp.js > api.js
rm api-tmp.js
mv js/HTTPQuery-node.js js/HTTPQuery.js
