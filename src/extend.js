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
