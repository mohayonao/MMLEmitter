!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.wamml=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
module.exports = _dereq_("./src/wamml");

},{"./src/wamml":9}],2:[function(_dereq_,module,exports){
"use strict";

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

function calcTotalDuration(list, state) {
  var prev = 0, dotted = 0;

  if (list[0] === null) {
    list = state.length.concat(list.slice(1));
  }

  return list.map(function(elem) {
    if (elem === null) {
      elem = prev;
    } else if (elem === 0) {
      elem = dotted = dotted * 2;
    } else {
      prev = dotted = elem;
    }
    return (60 / state.tempo) * (4 / clip(elem, 1, 1920));
  }).reduce(sum, 0);
}

function compile(nodes) {
  return [].concat({ type: Syntax.Begin }, nodes, { type: Syntax.End })
    .map(function(node, index) {
      return compile[node.type](node, index);
    });
}

compile[Syntax.Begin] = function() {
  return function(currentTime, state) {
    state.tempo    = 120;
    state.octave   = 5;
    state.quantize = 6;
    state.length   = [ 4 ];
    state.pendings = [];
    state.loopStack = [];
    state.infLoopIndex = null;
    state.infLoopWhen  = currentTime;

    return currentTime;
  };
};

compile[Syntax.End] = function() {
  return function(currentTime, state) {
    if (state.infLoopIndex !== null) {
      if (state.infLoopWhen !== currentTime) {
        state.index = state.infLoopIndex;
      }
    } else {
      state.postMessage({
        type: "end",
        when: currentTime
      }, { bubble: true });
    }
  };
};

compile[Syntax.Note] = function(node) {
  return function(currentTime, state) {
    state.pendings.splice(0).forEach(function(fn) {
      fn(state);
    });

    var totalDuration = calcTotalDuration(node.length, state);
    var duration = totalDuration * (state.quantize / 8);

    node.number.forEach(function(number, index) {
      var midi = state.octave * 12 + number + 12;

      function noteOff(fn, offset) {
        state.postMessage({
          type: "sched",
          when: currentTime + duration + (offset || 0),
          callback: fn
        }, { private: true });
      }

      state.postMessage({
        type: "note",
        when: currentTime,
        midi: midi,
        duration: duration,
        noteOff: noteOff,
        chordIndex: index
      });
    });

    return currentTime + totalDuration;
  };
};

compile[Syntax.Octave] = function(node) {
  return function(currentTime, state) {
    state.pendings.push(function(state) {
      state.octave = clip(node.value, 0, 8);
    });
  };
};

compile[Syntax.OctaveShift] = function(node) {
  return function(currentTime, state) {
    state.pendings.push(function(state) {
      var octave = state.octave + node.direction * node.value;
      state.octave = clip(octave, 0, 8);
    });
  };
};

compile[Syntax.Length] = function(node) {
  return function(currentTime, state) {
    state.pendings.push(function(state) {
      state.length = node.length;
    });
  };
};

compile[Syntax.Quantize] = function(node) {
  return function(currentTime, state) {
    state.pendings.push(function(state) {
      state.quantize = clip(node.value, 0, 8);
    });
  };
};

compile[Syntax.Tempo] = function(node) {
  return function(currentTime, state) {
    state.pendings.push(function(state) {
      state.tempo = clip(node.value, 1, 511);
    });
  };
};

compile[Syntax.InfLoop] = function(node, index) {
  return function(currentTime, state) {
    state.infLoopIndex = index;
    state.infLoopWhen  = currentTime;
  };
};

compile[Syntax.LoopBegin] = function(node, index) {
  return function(currentTime, state) {
    state.loopStack.push([
      clip(node.value, 1, 999), index, null
    ]);
  };
};

compile[Syntax.LoopExit] = function() {
  return function(currentTime, state) {
    var looper = peek(state.loopStack);

    if (looper[0] <= 1 && looper[2] !== null) {
      state.index = looper[2];
    }
  };
};

compile[Syntax.LoopEnd] = function(node, index) {
  return function(currentTime, state) {
    var looper = peek(state.loopStack);

    if (looper[2] === null) {
      looper[2] = index;
    }

    looper[0] -= 1;

    if (looper[0] > 0) {
      state.index = looper[1];
    } else {
      state.loopStack.pop();
    }
  };
};

module.exports = function(nodes) {
  return compile(nodes);
};

},{"./syntax":7}],3:[function(_dereq_,module,exports){
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

},{}],4:[function(_dereq_,module,exports){
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

},{}],5:[function(_dereq_,module,exports){
"use strict";

var Syntax = _dereq_("./syntax");

function append(list, elem) {

  if (Array.isArray(elem)) {
    Array.prototype.push.apply(list, elem);
  } else if (elem) {
    list.push(elem);
  }

  return list;
}

function defaults(val, defaultValue) {
  return val === null ? defaultValue : val;
}

function scanner(str) {
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

  function length(defaultVal) {
    return append([ defaults(arg(/\d+/), defaultVal) ].concat(dot()), tie());
  }

  function arg(matcher) {
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
    return { type: Syntax.Note, number: [ noteNum(0) ], length: length(null) };
  }

  function chord() {
    scanner.expect("(");

    var number = [];
    var offset = 0;

    until(")", function() {
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

    scanner.expect(")");

    return { type: Syntax.Note, number: number, length: length(null) };
  }

  function r() {
    scanner.expect("r");

    return { type: Syntax.Note, number: [], length: length(null) };
  }

  function o() {
    scanner.expect("o");

    return { type: Syntax.Octave, value: defaults(arg(/\d+/), 5) };
  }

  function oShift(direction) {
    scanner.expect(/<|>/);

    return { type: Syntax.OctaveShift, direction: direction|0, value: defaults(arg(/\d+/), 1) };
  }

  function l() {
    scanner.expect("l");

    return { type: Syntax.Length, length: length(4) };
  }

  function q() {
    scanner.expect("q");

    return { type: Syntax.Quantize, value: defaults(arg(/\d+/), 6) };
  }

  function t() {
    scanner.expect("t");

    return { type: Syntax.Tempo, value: defaults(arg(/\d+(\.\d+)?/), 120) };
  }

  function infLoop() {
    scanner.expect("$");

    return { type: Syntax.InfLoop };
  }

  function loop() {
    scanner.expect("[");

    var seq = [ { type: Syntax.LoopBegin } ];

    until(/\||\]/, function() {
      append(seq, advance());
    });
    append(seq, loopExit());

    scanner.expect("]");

    seq.push({ type: Syntax.LoopEnd });

    seq[0].value = arg(/\d+/) || 2;

    return seq;
  }

  function loopExit() {
    var seq = [];

    if (scanner.match("|")) {
      scanner.next();

      seq.push({ type: Syntax.LoopExit });

      until("]", function() {
        append(seq, advance());
      });
    }

    return seq;
  }

  function advance() {
    switch (scanner.peek()) {
    case "c": case "d": case "e": case "f": case "g": case "a": case "b":
      return note();
    case "(":
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
    case "$":
      return infLoop();
    case "[":
      return loop();
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

module.exports = function(mml) {
  return parse(scanner(mml));
};

},{"./syntax":7}],6:[function(_dereq_,module,exports){
"use strict";

var BUFFER_SIZE = 512;

var extend  = _dereq_("./extend");
var parse   = _dereq_("./parse");
var compile = _dereq_("./compile");
var Emitter = _dereq_("./emitter");
var Track   = _dereq_("./track");

function Sequencer(audioContext, mml) {
  Emitter.call(this);

  this.audioContext = audioContext;
  this.tracks = parse(mml).map(compile).map(function(nodes) {
    return new Track(this, nodes);
  }, this);
  this._ended = 0;
  this._node = null;
  this._currentTime = 0;
  this._currentTimeIncr = 0;
}
extend(Sequencer, Emitter);

Sequencer.prototype.start = function() {
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

Sequencer.prototype.stop = function() {
  if (this._node) {
    this._node.disconnect();
  }
  this._node = null;

  return this;
};

Sequencer.prototype.onmessage = function(message) {
  /* istanbul ignore else */
  if (message && message.type === "end") {
    this._ended += 1;
    if (this.tracks.length <= this._ended) {
      this.emit("end", message);
    }
  }
};

Sequencer.prototype._process = function() {
  var currentTime = this.audioContext.currentTime;

  this.tracks.forEach(function(track) {
    track._process(currentTime);
  });
};

module.exports = Sequencer;

},{"./compile":2,"./emitter":3,"./extend":4,"./parse":5,"./track":8}],7:[function(_dereq_,module,exports){
"use strict";

module.exports = {
  Begin: 0,
  Note: 1,
  Octave: 2,
  OctaveShift: 3,
  Length: 4,
  Quantize: 5,
  Tempo: 6,
  InfLoop: 7,
  LoopBegin: 8,
  LoopExit: 9,
  LoopEnd: 10,
  End: 99,
};

},{}],8:[function(_dereq_,module,exports){
"use strict";

var WHEN = 0;
var FUNC = 1;

var extend  = _dereq_("./extend");
var Emitter = _dereq_("./emitter");

function schedSorter(a, b) {
  return a[WHEN] - b[WHEN];
}

function Track(parent, nodes) {
  Emitter.call(this);

  this._parent = parent;
  this._nodes = nodes;
  this._state = {
    index: 0,
    postMessage: this.onmessage.bind(this)
  };
  this._sched = [];
  this._currentTimeIncr = 0;
}
extend(Track, Emitter);

Track.prototype._init = function(currentTime, currentTimeIncr) {
  this._currentTimeIncr = currentTimeIncr;

  var next = function(currentTime, state) {
    var nextCurrentTime = currentTime + this._currentTimeIncr;
    var nodes = this._nodes;

    while (state.index < nodes.length && currentTime < nextCurrentTime) {
      var when = nodes[state.index](currentTime, state);

      state.index += 1;

      if (when) {
        currentTime = when;
      }
    }

    if (state.index < nodes.length) {
      this.sched(currentTime, next);
    }

  }.bind(this);

  next(currentTime, this._state);
};

Track.prototype._process = function(currentTime) {
  var nextCurrentTime = currentTime + this._currentTimeIncr;

  var sched = this._sched;
  var state = this._state;

  while (sched.length && sched[0][WHEN] < nextCurrentTime) {
    var elem = sched.shift();

    elem[FUNC](elem[WHEN], state);
  }
};

Track.prototype.onmessage = function(message, opts) {
  opts = opts || {};

  if (message.type === "sched") {
    this.sched(message.when, message.callback);
  }
  if (!opts.private) {
    this.emit(message.type, message);
  }
  if (opts.bubble && this._parent) {
    this._parent.onmessage(message);
  }
};

Track.prototype.sched = function(when, fn) {
  this._sched.push([ when, fn ]);
  this._sched.sort(schedSorter);

  return this;
};

module.exports = Track;

},{"./emitter":3,"./extend":4}],9:[function(_dereq_,module,exports){
"use strict";

var Sequencer = _dereq_("./sequencer");

module.exports = {
  version: "0.1.0",
  Sequencer: Sequencer
};

},{"./sequencer":6}]},{},[1])
(1)
});