"use strict";

var Tokenizer = require("../../src/tokenizer");

describe("Tokenizer", function() {

  function collectToken(mml) {
    var t = new Tokenizer(mml);
    var result = [];

    var token = null;
    while ((token = t.advance()) !== null) {
      result.push(token);
    }

    return result;
  }

  it("test", function() {
    // console.log(collectToken("t120"));
  });
});
