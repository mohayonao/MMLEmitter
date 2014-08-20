!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.MMLEmitter=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
module.exports = _dereq_("./src/");

},{"./src/":6}],2:[function(_dereq_,module,exports){
"use strict";

function Emitter() {
  this._callbacks = {};
}

Emitter.prototype.hasListeners = function(event) {
  return this._callbacks.hasOwnProperty(event);
};

Emitter.prototype.listeners = function(event) {
  return this.hasListeners(event) ? this._callbacks[event].slice() : [];
};

Emitter.prototype.on = function(event, listener) {

  if (!this.hasListeners(event)) {
    this._callbacks[event] = [];
  }

  this._callbacks[event].push(listener);

  return this;
};

Emitter.prototype.addListener = Emitter.prototype.on;

Emitter.prototype.once = function(event, listener) {

  function fn(arg) {
    this.off(event, fn);
    listener.call(this, arg);
  }

  fn.listener = listener;

  this.on(event, fn);

  return this;
};

Emitter.prototype.off = function(event, listener) {

  if (typeof listener === "undefined") {
    if (typeof event === "undefined") {
      this._callbacks = {};
    } else if (this.hasListeners(event)) {
      delete this._callbacks[event];
    }
  } else if (this.hasListeners(event)) {
    this._callbacks[event] = this._callbacks[event].filter(function(fn) {
      return !(fn === listener || fn.listener === listener);
    });
  }

  return this;
};

Emitter.prototype.removeListener = Emitter.prototype.off;

Emitter.prototype.removeAllListeners = Emitter.prototype.off;

Emitter.prototype.emit = function(event, arg) {
  this.listeners(event).forEach(function(fn) {
    fn.call(this, arg);
  }, this);
};

module.exports = Emitter;

},{}],3:[function(_dereq_,module,exports){
"use strict";

function startsWithDollar(id) {
  return id.charAt(0) === "$";
}

function notHasOwnProperty(id) {
  return !this.hasOwnProperty(id);
}

function defineSharedVariable(id) {
  var name = id.substr(1);

  Object.defineProperty(this, id, {
    get: function() {
      return (this._shared && this._shared[name]) || null;
    },
    set: function(value) {
      if (this._shared) {
        this._shared[name] = value;
      }
    }
  });
}

function compile(ctx, expr) {
  var fn;

  try {
    fn = new Function("return " + expr.expr + ";"); // jshint ignore: line
  } catch (e) {
    throw new Error("Error parsing expression: " + expr.expr);
  }

  expr.variables
    .filter(startsWithDollar)
    .filter(notHasOwnProperty, ctx)
    .forEach(defineSharedVariable, ctx);

  return {
    valueOf: function(ctx) {
      var num = fn.call(ctx);

      return typeof num === "number" ? num : null;
    }
  };
}

module.exports.compile = compile;

},{}],4:[function(_dereq_,module,exports){
"use strict";

var KEYWORDS =[
  // keywords
  "break","case","catch","continue","debugger","default","delete","do","else",
  "finally","for","function","if","in","instanceof","new","return","switch",
  "this","throw","try","typeof","var","void","while","with","undefined",
  // reserved
  "abstract","boolean","byte","char","class","const","double","enum","export",
  "extends","final","float","goto","implements","import","int","interface",
  "long","native","package","private","protected","public","short","static",
  "super","synchronized","throws","transient","volatile",
  // ECMA 5 - use strict
  "arguments","let","yield"
];

var WRAPPING_PAIRS = { "{": "}", "(": ")", "[": "]" };

function peek(list) {
  return list[list.length - 1];
}

function isKeyword(id) {
  return KEYWORDS.indexOf(id) !== -1;
}

function parse(scanner) {
  function identifier() {
  return scanner.scan(/[_$a-zA-Z][_$\w]*/);
  }

  function string() {
    return scanner.scan(/('|").*?\1/);
  }

  function number() {
    return scanner.scan(/\d+\.?\d*(e[-+]?\d+)?|0x[\da-f]+/i);
  }

  function member() {
    return scanner.next() + identifier();
  }

  function expr() {
    var variables = [];
    var stack = [];

    function variable() {
      var id = identifier();

      if (isKeyword(id)) {
        throw new SyntaxError(
          "Statements should not be used in directives: " + id
        );
      }

      if (peek(stack) === "}") {
        scanner.scan(/\s*/);
        scanner.expect(":");

        var next = expr();

        [].push.apply(variables, next.variables);

        return id + ":" + next.expr;
      }

      if (!/^([A-Z]\w*|\$|_|true|false|null)$/.test(id)) {
        variables.push(id);
        id = "this." + id;
      }

      return id;
    }

    function inExpr() {
      if (!scanner.hasNext()) {
        return false;
      }

      var ch = scanner.peek();

      switch (ch) {
      case "{": case "(": case "[":
        stack.push(WRAPPING_PAIRS[ch]);
        break;
      case "]": case ")": case "}":
        if (stack.length === 0) {
          return false;
        }
        if (stack.pop() !== ch) {
          scanner.throwUnexpectedToken();
        }
      }

      return true;
    }

    var code = "";

    while (inExpr()) {
      var ch = scanner.peek();

      if (ch === "'" || ch === "\"") {
        code += string();
      } else if ("0" <= ch && ch <= "9") {
        code += number();
      } else if (ch === ".") {
        code += member();
      } else if (/[_$a-zA-Z]/.test(ch)) {
        code += variable();
      } else {
        code += scanner.next();
      }
    }

    return { expr: code, variables: variables };
  }

  return expr();
}

module.exports.parse = parse;

},{}],5:[function(_dereq_,module,exports){
"use strict";

/**
 * extend
 *
 * @param {function} ctor
 * @param {function} superCtor
 */
module.exports = function(ctor, superCtor) {
  ctor.prototype = Object.create(superCtor.prototype, {
    constructor: { value: ctor, enumerable: false, writable: true, configurable: true }
  });
};

},{}],6:[function(_dereq_,module,exports){
"use strict";

var MMLEmitter = _dereq_("./mml-emitter");

MMLEmitter.version = "0.2.0";

module.exports = MMLEmitter;

},{"./mml-emitter":8}],7:[function(_dereq_,module,exports){
"use strict";

var ExprCompiler = _dereq_("./expr-compiler");
var Syntax = _dereq_("./syntax");

function peek(list) {
  return list[list.length - 1];
}

function clip(num, min, max) {
  return Math.max(min, Math.min(num, max));
}

function sum(a, b) {
  return a + b;
}

function valueOf(ctx, value, defaultVal) {
  if (value !== null) {
    value = value.valueOf(ctx);
  }
  return value === null ? defaultVal : value;
}

function calcTotalDuration(ctx, length) {
  var prev = null;
  var dotted = 0;

  if (length[0] === null) {
    length = ctx._lenList.concat(length.slice(1));
  }

  return length.map(function(elem) {
    if (elem === null) {
      elem = prev;
    } else if (elem === 0) {
      elem = dotted = dotted * 2;
    } else {
      prev = dotted = elem;
    }
    return (60 / ctx._tempo) * (4 / clip(valueOf(ctx, elem, 4), 1, 1920));
  }).reduce(sum, 0);
}

function precompile(ctx, node) {
  if (node && typeof node === "object") {
    if (node.type === Syntax.Expression) {
      return ExprCompiler.compile(ctx, node);
    }

    if (Array.isArray(node)) {
      return node.map(function(node) {
        return precompile(ctx, node);
      });
    }

    Object.keys(node).forEach(function(key) {
      node[key] = precompile(ctx, node[key]);
    });
  }

  return node;
}

function compile(track, nodes) {
  return [].concat({ type: Syntax.Begin }, nodes, { type: Syntax.End })
    .map(function(node, index) {
      node = precompile(track, node);
      return compile[node.type](node, index);
    });
}

compile[Syntax.Begin] = function() {
  return function(ctx, currentTime) {
    ctx._tempo    = 120;
    ctx._octave   = 5;
    ctx._quantize = 6;
    ctx._velocity = 12;
    ctx._length   = 4;
    ctx._lenList  = [ ctx._length ];
    ctx._loopStack = [];
    ctx._infLoopIndex = null;
    ctx._infLoopWhen  = currentTime;

    return currentTime;
  };
};

compile[Syntax.End] = function() {
  return function(ctx, currentTime) {
    if (ctx._infLoopIndex !== null) {
      if (ctx._infLoopWhen !== currentTime) {
        ctx._index = ctx._infLoopIndex;
      }
    } else {
      ctx._recv({
        type: "end",
        when: currentTime
      }, { bubble: true });
    }

    return currentTime;
  };
};

compile[Syntax.Note] = function(node) {
  return function(ctx, currentTime) {
    var totalDuration = calcTotalDuration(ctx, node.length);
    var duration = totalDuration * (ctx._quantize / 8);

    var velocity = ctx._velocity;

    node.number.forEach(function(number, index) {
      var midi = ctx._octave * 12 + number + 12;

      function noteOff(fn, offset) {
        ctx._recv({
          type: "sched",
          when: currentTime + duration + (offset || 0),
          callback: fn
        }, { private: true });
      }

      ctx._recv({
        type: "note",
        when: currentTime,
        midi: midi,
        duration: duration,
        noteOff: noteOff,
        chordIndex: index,
        velocity: velocity
      });
    });

    return currentTime + totalDuration;
  };
};

compile[Syntax.Octave] = function(node) {
  return function(ctx, currentTime) {
    ctx._octave = clip(valueOf(ctx, node.value, 5), 0, 8);

    return currentTime;
  };
};

compile[Syntax.OctaveShift] = function(node) {
  return function(ctx, currentTime) {
    var octave = ctx._octave + node.direction * valueOf(ctx, node.value, 1);
    ctx._octave = clip(octave, 0, 8);
    return currentTime;
  };
};

compile[Syntax.Length] = function(node) {
  return function(ctx, currentTime) {
    ctx._length  = node.length[0];
    ctx._lenList = node.length;

    return currentTime;
  };
};

compile[Syntax.Quantize] = function(node) {
  return function(ctx, currentTime) {
    ctx._quantize = clip(valueOf(ctx, node.value, 6), 0, 8);

    return currentTime;
  };
};

compile[Syntax.Tempo] = function(node) {
  return function(ctx, currentTime) {
    ctx._tempo = clip(valueOf(ctx, node.value, 120), 1, 511);

    return currentTime;
  };
};

compile[Syntax.Velocity] = function(node) {
  return function(ctx, currentTime) {
    ctx._velocity = clip(valueOf(ctx, node.value, 12), 0, 16);

    return currentTime;
  };
};

compile[Syntax.InfLoop] = function(node, index) {
  return function(ctx, currentTime) {
    ctx._infLoopIndex = index;
    ctx._infLoopWhen  = currentTime;

    return currentTime;
  };
};

compile[Syntax.LoopBegin] = function(node, index) {
  return function(ctx, currentTime) {
    ctx._loopStack.push([
      clip(valueOf(ctx, node.value, 2), 1, 999), index, null
    ]);

    return currentTime;
  };
};

compile[Syntax.LoopExit] = function() {
  return function(ctx, currentTime) {
    var looper = peek(ctx._loopStack);

    if (looper[0] <= 1 && looper[2] !== null) {
      ctx._index = looper[2];
    }

    return currentTime;
  };
};

compile[Syntax.LoopEnd] = function(node, index) {
  return function(ctx, currentTime) {
    var looper = peek(ctx._loopStack);

    if (looper[2] === null) {
      looper[2] = index;
    }

    looper[0] -= 1;

    if (looper[0] > 0) {
      ctx._index = looper[1];
    } else {
      ctx._loopStack.pop();
    }

    return currentTime;
  };
};

compile[Syntax.Command] = function(node) {
  return function(ctx, currentTime) {
    valueOf(ctx, node.value, 0);
    return currentTime;
  };
};

module.exports.compile = compile;

},{"./expr-compiler":3,"./syntax":12}],8:[function(_dereq_,module,exports){
"use strict";

var BUFFER_SIZE = 512;

var extend = _dereq_("./extend");
var MMLParser = _dereq_("./mml-parser");
var MMLTrack = _dereq_("./mml-track");
var Emitter = _dereq_("./emitter");

function MMLEmitter(audioContext, mml) {
  Emitter.call(this);

  this.audioContext = audioContext;
  this.tracks = MMLParser.parse(mml).map(function(nodes) {
    return new MMLTrack(this, nodes);
  }, this);
  this._ended = 0;
  this._node = null;
  this._currentTime = 0;
  this._currentTimeIncr = 0;
}
extend(MMLEmitter, Emitter);

MMLEmitter.prototype.start = function() {
  this.stop();

  var currentTime = this.audioContext.currentTime;
  var currentTimeIncr = BUFFER_SIZE / this.audioContext.sampleRate;

  this.tracks.forEach(function(track) {
    track._init(currentTime, currentTimeIncr);
  }, this);

  this._node = this.audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

  this._node.onaudioprocess = this._process.bind(this);

  this._node.connect(this.audioContext.destination);

  return this;
};

MMLEmitter.prototype.stop = function() {
  if (this._node) {
    this._node.disconnect();
  }
  this._node = null;

  return this;
};

MMLEmitter.prototype._recv = function(message) {
  /* istanbul ignore else */
  if (message && message.type === "end") {
    this._ended += 1;
    if (this.tracks.length <= this._ended) {
      this.emit("end", message);
    }
  }
};

MMLEmitter.prototype._process = function() {
  var currentTime = this.audioContext.currentTime;

  this.tracks.forEach(function(track) {
    track._process(currentTime);
  });
};

module.exports = MMLEmitter;

},{"./emitter":2,"./extend":5,"./mml-parser":9,"./mml-track":10}],9:[function(_dereq_,module,exports){
"use strict";

var Scanner = _dereq_("./scanner");
var ExprParser = _dereq_("./expr-parser");
var Syntax = _dereq_("./syntax");

function append(list, elem) {

  if (Array.isArray(elem)) {
    Array.prototype.push.apply(list, elem);
  } else if (elem) {
    list.push(elem);
  }

  return list;
}

function parse(scanner) {

  function until(matcher, fn) {
    while (true) {
      scanner.forward();
      if (!scanner.hasNext() || scanner.match(matcher)) {
        break;
      }
      fn();
    }
  }

  function noteNum(offset) {
    return {
      c:0, d:2, e:4, f:5, g:7, a:9, b:11
    }[scanner.next()] + acci() + offset;
  }

  function dot() {
    var len = (scanner.scan(/\.+/) || "").length;
    var result = new Array(len);

    for (var i = 0; i < len; i++) {
      result[i] = 0;
    }

    return result;
  }

  function acci() {
    if (scanner.match("+")) {
      scanner.next();
      return +1;
    }

    if (scanner.match("-")) {
      scanner.next();
      return -1;
    }

    return 0;
  }

  function length() {
    return append([ arg(/\d+/) ].concat(dot()), tie());
  }

  function arg(matcher) {
    if (scanner.match("(")) {
      return expr();
    }

    var num = scanner.scan(matcher);

    return num !== null ? +num : null;
  }

  function tie() {
    scanner.forward();

    if (scanner.match("^")) {
      scanner.next();
      return length(null);
    }

    return null;
  }

  function note() {
    return { type: Syntax.Note, number: [ noteNum(0) ], length: length() };
  }

  function chord() {
    scanner.expect("[");

    var number = [];
    var offset = 0;

    until("]", function() {
      switch (scanner.peek()) {
      case "c": case "d": case "e": case "f": case "g": case "a": case "b":
        number.push(noteNum(offset));
        break;
      case "<":
        scanner.next();
        offset += 12;
        break;
      case ">":
        scanner.next();
        offset -= 12;
        break;
      default:
        scanner.throwUnexpectedToken();
      }
    });

    scanner.expect("]");

    return { type: Syntax.Note, number: number, length: length() };
  }

  function r() {
    scanner.expect("r");

    return { type: Syntax.Note, number: [], length: length() };
  }

  function o() {
    scanner.expect("o");

    return { type: Syntax.Octave, value: arg(/\d+/) };
  }

  function oShift(direction) {
    scanner.expect(/<|>/);

    return { type: Syntax.OctaveShift, direction: direction|0, value: arg(/\d+/) };
  }

  function l() {
    scanner.expect("l");

    return { type: Syntax.Length, length: length() };
  }

  function q() {
    scanner.expect("q");

    return { type: Syntax.Quantize, value: arg(/\d+/) };
  }

  function t() {
    scanner.expect("t");

    return { type: Syntax.Tempo, value: arg(/\d+(\.\d+)?/) };
  }

  function v() {
    scanner.expect("v");

    return { type: Syntax.Velocity, value: arg(/\d+/) };
  }

  function infLoop() {
    scanner.expect("$");

    return { type: Syntax.InfLoop };
  }

  function loop() {
    scanner.expect("/");
    scanner.expect(":");

    var seq = [ { type: Syntax.LoopBegin } ];

    until(/[|:]/, function() {
      append(seq, advance());
    });
    append(seq, loopExit());

    scanner.expect(":");
    scanner.expect("/");

    seq.push({ type: Syntax.LoopEnd });

    seq[0].value = arg(/\d+/) || 2;

    return seq;
  }

  function loopExit() {
    var seq = [];

    if (scanner.match("|")) {
      scanner.next();

      seq.push({ type: Syntax.LoopExit });

      until(":", function() {
        append(seq, advance());
      });
    }

    return seq;
  }

  function command() {
    scanner.expect("@");

    return { type: Syntax.Command, value: arg(/\d+/) };
  }

  function expr() {
    var node;

    scanner.expect("(");

    node = ExprParser.parse(scanner);

    scanner.expect(")");

    node.variables.forEach(function(id) {
      if (id.charAt(0) === "_") {
        throw new SyntaxError(
          "A variable in directives should not be started with '_': " + id
        );
      }
    });

    return { type: Syntax.Expression, expr: node.expr, variables: node.variables };
  }

  function advance() {
    switch (scanner.peek()) {
    case "c": case "d": case "e": case "f": case "g": case "a": case "b":
      return note();
    case "[":
      return chord();
    case "r":
      return r();
    case "o":
      return o();
    case "<":
      return oShift(+1);
    case ">":
      return oShift(-1);
    case "l":
      return l();
    case "q":
      return q();
    case "t":
      return t();
    case "v":
      return v();
    case "$":
      return infLoop();
    case "/":
      return loop();
    case "@":
      return command();
    }
    scanner.throwUnexpectedToken();
  }

  function mml() {
    var seq = [];

    until("", function() {
      var track = [];

      until(";", function() {
        append(track, advance());
      });

      seq.push(track);

      if (scanner.match(";")) {
        scanner.next();
      }
    });

    return seq;
  }

  return mml();
}

module.exports.parse = function(mml) {
  return parse(new Scanner(mml));
};

},{"./expr-parser":4,"./scanner":11,"./syntax":12}],10:[function(_dereq_,module,exports){
"use strict";

var WHEN = 0;
var FUNC = 1;

var extend  = _dereq_("./extend");
var Emitter = _dereq_("./emitter");
var MMLCompiler = _dereq_("./mml-compiler");

function schedSorter(a, b) {
  return a[WHEN] - b[WHEN];
}

function MMLTrack(parent, nodes) {
  Emitter.call(this);

  this._index = 0;
  this._parent = parent;
  this._shared = parent;
  this._nodes = MMLCompiler.compile(this, nodes);
  this._sched = [];
  this._currentTimeIncr = 0;
}
extend(MMLTrack, Emitter);

MMLTrack.prototype._init = function(currentTime, currentTimeIncr) {
  this._currentTimeIncr = currentTimeIncr;

  var next = function(currentTime) {
    var nextCurrentTime = currentTime + this._currentTimeIncr;
    var nodes = this._nodes;

    while (this._index < nodes.length && currentTime < nextCurrentTime) {
      currentTime = nodes[this._index](this, currentTime);
      this._index += 1;
    }

    if (this._index < nodes.length) {
      this.sched(currentTime, next);
    }

  }.bind(this);

  next(currentTime);
};

MMLTrack.prototype._process = function(currentTime) {
  var nextCurrentTime = currentTime + this._currentTimeIncr;

  var sched = this._sched;

  while (sched.length && sched[0][WHEN] < nextCurrentTime) {
    var elem = sched.shift();

    elem[FUNC](elem[WHEN]);
  }
};

MMLTrack.prototype._recv = function(message, opts) {
  opts = opts || {};

  if (message.type === "sched") {
    this.sched(message.when, message.callback);
  }
  if (!opts.private) {
    this.emit(message.type, message);
  }
  if (opts.bubble && this._parent) {
    this._parent._recv(message);
  }
};

MMLTrack.prototype.sched = function(when, fn) {
  this._sched.push([ when, fn ]);
  this._sched.sort(schedSorter);

  return this;
};

module.exports = MMLTrack;

},{"./emitter":2,"./extend":5,"./mml-compiler":7}],11:[function(_dereq_,module,exports){
"use strict";

function Scanner(str) {
  str = String(str);

  var len = str.length;
  var pos = 0;
  var lineNumber = len ? 1 : 0;
  var lineStart  = 0;

  function hasNext() {
    return pos < len;
  }

  function peek() {
    return str.charAt(pos);
  }

  function next() {
    return str.charAt(pos++);
  }

  function match(matcher) {
    return matcher.test ?
      matcher.test(str.charAt(pos)) :
      str.charAt(pos) === matcher;
  }

  function expect(matcher) {
    if (!match(matcher)) {
      throwUnexpectedToken();
    }
    pos += 1;
  }

  function scan(matcher) {
    var matched = matcher.exec(str.substr(pos));

    if (matched && matched.index === 0) {
      matched = matched[0];
      pos += matched.length;
    } else {
      matched = null;
    }

    return matched;
  }

  function skipComment() {
    while (hasNext()) {
      var ch1 = str.charCodeAt(pos);
      var ch2 = str.charCodeAt(pos + 1);

      if (ch1 === 0x20 || ch1 === 0x09) { // <SPACE> or <TAB>
        pos += 1;
      } else if (ch1 === 0x0a) { // <CR>
        pos += 1;
        lineNumber += 1;
        lineStart = pos;
      } else if (ch1 === 0x2f && ch2 === 0x2f) {
        skipSingleLineComment();
      } else if (ch1 === 0x2f && ch2 === 0x2a) {
        skipMultiLineComment();
      } else {
        break;
      }
    }
  }

  function skipSingleLineComment() {
    pos += 2; // skip //

    while (hasNext()) {
      if (str.charCodeAt(pos++) === 0x0a) { // <CR>
        lineNumber += 1;
        lineStart = pos;
        break;
      }
    }
  }

  function skipMultiLineComment() {
    var depth = 1;

    pos += 2; // skip /*

    while (hasNext()) {
      var ch1 = str.charCodeAt(pos++);
      var ch2 = str.charCodeAt(pos);

      if (ch1 === 0x0a) { // <CR>
        lineNumber += 1;
        lineStart = pos;
      } else if (ch1 === 0x2f && ch2 === 0x2a) { // /*
        pos += 1;
        ++depth;
      } else if (ch1 === 0x2a && ch2 === 0x2f) { // */
        pos += 1;
        if (--depth === 0) {
          pos += 1;
          return;
        }
      }
    }

    throwUnexpectedToken();
  }

  function throwUnexpectedToken() {
    var ch = peek();
    var msg = "Unexpected token" + (ch ? (": '" + ch + "'") : " ILLEGAL");
    var err = new SyntaxError(msg);

    err.index = pos;
    err.lineNumber = lineNumber;
    err.column = pos - lineStart + (ch ? 1 : 0);

    throw err;
  }

  return {
    hasNext: hasNext,
    peek: peek,
    next: next,
    match: match,
    expect: expect,
    scan: scan,
    forward: skipComment,
    throwUnexpectedToken: throwUnexpectedToken
  };
}

module.exports = Scanner;

},{}],12:[function(_dereq_,module,exports){
"use strict";

module.exports = {
  Expression: -1,
  Begin: 0,
  Note: 1,
  Octave: 2,
  OctaveShift: 3,
  Length: 4,
  Quantize: 5,
  Tempo: 6,
  Velocity: 7,
  InfLoop: 8,
  LoopBegin: 9,
  LoopExit: 10,
  LoopEnd: 11,
  Command: 12,
  End: 99,
};

},{}]},{},[1])
(1)
});