"use strict";

function Tokenizer(mml) {
  this.mml = String(mml).replace(/\r\n?/g, "\n");
  this.length = this.mml.length;

  this.index = 0;
  this.lineNumber = this.length ? 1 : 0;
  this.lineStart = 0;

  this.lookahead  = this.advance();

  this.index = 0;
  this.lineNumber = this.length ? 1 : 0;
  this.lineStart = 0;
}

Tokenizer.prototype.advance = function() {
  this.skipComment();

  if (this.length <= this.index) {
    return null;
  }

  var ch = this.mml.charCodeAt(this.index);

  if (0x61 <= ch && ch <= 0x7a) { // a-z
    return this.scanChar();
  }

  if (0x30 <= ch && ch <= 0x39) { // 0-9
    return this.scanNumber();
  }

  return this.scanPunctuator();
};

Tokenizer.prototype.skipComment = function() {
  var mml = this.mml;
  var len = this.length;

  while (this.index < len) {
    var ch1 = mml.charCodeAt(this.index);
    var ch2 = mml.charCodeAt(this.index + 1);

    if (ch1 === 0x20 || ch1 === 0x09) { // <SPACE> or <TAB>
      this.index += 1;
    } else if (ch1 === 0x0a) { // <CR>
      this.index += 1;
      this.lineNumber += 1;
      this.lineStart = this.index;
    } else if (ch1 === 0x2f) { // /
      if (ch2 === 0x2f) { // /
        this.scanSingleLineComment();
      } else if (ch2 === 0x2a) { // *
        this.scanMultiLineComment();
      }
    } else {
      break;
    }
  }
};

Tokenizer.prototype.scanSingleLineComment = function() {
  var mml = this.mml;
  var len = this.len;

  this.index += 2; // skip //

  while (this.index < len) {
    if (mml.charCodeAt(this.index++) === 0x0a) { // <CR>
      this.lineNumber += 1;
      this.lineStart = this.index;
      break;
    }
  }

};

Tokenizer.prototype.scanMultiLineComment = function() {
  var mml = this.mml;
  var len = this.length;
  var depth = 1;

  this.index += 2; // skip /*

  while (this.index <= len) {
    var ch1 = mml.charCodeAt(this.index);
    var ch2 = mml.charCodeAt(this.index + 1);

    if (ch1 === 0x0a) { // <CR>
      this.line += 1;
      this.lineStart = this.index;
    } else if (ch1 === 0x2f && ch2 === 0x2a) { // /*
      depth += 1;
      this.index += 1;
    } else if (ch1 === 0x2a && ch2 === 0x2f) { // */
      depth -= 1;
      this.index += 1;
      if (depth === 0) {
        return;
      }
    }

    this.index += 1;
  }

  throw new Error("Unexpected token ILLEGAL");
};

Tokenizer.prototype.scanChar = function() {
  var start = this.getLocation();
  var value = this.mml.charAt(this.index++);

  return {
    type: "char",
    value: value,
    loc: {
      start: start,
      end: this.getLocation()
    }
  };
};

Tokenizer.prototype.scanNumber = function() {
  var start = this.getLocation();
  var re = /\d\d*(\.\d\d*)?/g;
  re.lastIndex = this.index;

  var value = re.exec(this.mml)[0];

  this.index += value.length;

  return {
    type: "number",
    value: value,
    loc: {
      start: start,
      end: this.getLocation()
    }
  };
};

Tokenizer.prototype.scanPunctuator = function() {
  var start = this.getLocation();
  var re = /[$[|\]+\-<>^@()]|\.+|{{|}}/g;
  re.lastIndex = this.index;

  var value = re.exec(this.mml);

  if (value === null) {
    throw new Error("Unexpected token: " | this.mml.charAt(this.index));
  }

  value = value[0];
  this.index = value.length;

  return {
    type: "number",
    value: value,
    loc: {
      start: start,
      end: this.getLocation()
    }
  };
};

Tokenizer.prototype.getLocation = function() {
  return { line: this.lineNumber, column: this.index - this.lineStart };
};


module.exports = Tokenizer;
