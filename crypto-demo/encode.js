// Function to encode a string to base64 format
function encode(str) {
	encodedString = btoa(str);
    $scope.output.setValue(encodedString, 1);
}

// Function to decode a string from base64 format
function decode(str) {
    decodedString = atob(str);
    $scope.input.setValue(decodedString);
}

encoded = (encode("test"))
decoded = decode(encoded)
console.log(decoded)
