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

  function fn() {
    this.off(event, fn);
    listener.apply(this, arguments);
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

Emitter.prototype.emit = function(event) {
  var args = [].slice.call(arguments, 1);

  this.listeners(event).forEach(function(fn) {
    fn.apply(this, args);
  }, this);
};

module.exports = Emitter;
