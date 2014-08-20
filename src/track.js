"use strict";

var WHEN = 0;
var FUNC = 1;

var extend  = require("./extend");
var Emitter = require("./emitter");
var MMLCompiler = require("./mml-compiler");

function schedSorter(a, b) {
  return a[WHEN] - b[WHEN];
}

function Track(parent, nodes) {
  Emitter.call(this);

  this._index = 0;
  this._parent = parent;
  this._shared = parent;
  this._nodes = MMLCompiler.compile(this, nodes);
  this._sched = [];
  this._currentTimeIncr = 0;
}
extend(Track, Emitter);

Track.prototype._init = function(currentTime, currentTimeIncr) {
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

Track.prototype._process = function(currentTime) {
  var nextCurrentTime = currentTime + this._currentTimeIncr;

  var sched = this._sched;

  while (sched.length && sched[0][WHEN] < nextCurrentTime) {
    var elem = sched.shift();

    elem[FUNC](elem[WHEN]);
  }
};

Track.prototype._recv = function(message, opts) {
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

Track.prototype.sched = function(when, fn) {
  this._sched.push([ when, fn ]);
  this._sched.sort(schedSorter);

  return this;
};

module.exports = Track;
