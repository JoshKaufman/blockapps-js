#!/bin/bash
browserify -r ./js/Contract:Contract -r ./js/Transaction:Transaction -r ./js/Solidity:Solidity > api-tmp.js
minify api-tmp.js > api.js
rm api-tmp.js
