# wamml
[![NPM Version](http://img.shields.io/npm/v/wamml.svg?style=flat)](https://www.npmjs.org/package/wamml)
[![Build Status](http://img.shields.io/travis/mohayonao/wamml.svg?style=flat)](https://travis-ci.org/mohayonao/wamml)
[![Coverage Status](http://img.shields.io/coveralls/mohayonao/wamml.svg?style=flat)](https://coveralls.io/r/mohayonao/wamml?branch=master)
[![Dependency Status](http://img.shields.io/david/mohayonao/wamml.svg?style=flat)](https://david-dm.org/mohayonao/wamml)
[![devDependency Status](http://img.shields.io/david/dev/mohayonao/wamml.svg?style=flat)](https://david-dm.org/mohayonao/wamml)

> **Wamml** (wáml, ワムル) is a MML sequencer for Web Audio API.

:zap::zap::zap: work in progress :zap::zap::zap:

## Install

  - wamml.js
  - wamml.min.js

```html
<script src="/path/to/wamml.js"></script>
```

## Usage

```javascript
var wamml = new Wamml(audioContext, "t120 l8 cdef gab<c >");

wamml.on("note", function(when, midi, duration, done) {
  var osc = audioContext.createOscillator();
  var amp = audioContext.createGain();

  osc.frequency.value = midicps(midi);
  amp.gain.linearRampToValueAtTime(0, when + duration + 0.5);

  osc.start(when);
  osc.connect(amp);
  amp.connect(audioContext.destination);

  done(function() {
    amp.disconnect();
  }, 0.5); // called after noteOff + 0.5sec
});

wamml.start();
```

## Features

#### Mustache Bindings

```javascript
var wamml = new Wamml(audioContext, "t{{tempo}} l{{len}} cege gab<c >");

wamml.tempo = 125;
wamml.len   = 16;
```

#### Method Call

```javascript
var wamml = new Wamml(audioContext, "t120 l8 cdef @hello(10) gab<c >");

wamml.hello = function(arg) {
  console.log(arg); // 10
};
```

## Syntax

###### Control

  - **t**_n_
    - tempo (1-511, default: 120)
  - **$**
    - infinite loop
  - **[** ... **|** ... **]**_n_
    - loop

###### Pitch

  - [**a**-**g**][**+-**]?_n_**.***
    - note on (1-1920, default: l)
  - **(** [**a**-**g**][**+-**]? (**,** [**a**-**g**][**+-**]?)+ **)**_n_
    - chord (1-1920, default: l)
  - **r**_n_**.***
    - rest (1-1920, default: l)
  - **o**_n_
    - octave (0-9, default: 5)
  - [**<>**]_n_
    - octave shift (1-9, default: 1)

###### Duration

  - **l**_n_**.***
    - length (1-1920, default: 4)
  - **^**_n_**.***
    - tie (1-1920, default: l)
  - **q**_n_
    - quantize (0-8, default: 6)

###### Programming

  - **//** ...
    - comment
  - **/*** ... ***/**
    - block comment
  - **@** ... **(** ...args **)**
    - method call

## API

###### Constructor

  - `new Wamml(ctx:AudioContext, mml:string="") : Wamml`

###### Methods

  - `on(eventName:string, callback:function) : Wamml`
  - `once(eventName:string, callback:function) : Wamml`
  - `off(eventName:string, callback:function) : Wamml`
  - `start() : Wamml`
  - `stop() : Wamml`

###### Properties

  - `context : AudioContext`
  - `mml : string`
  - `currentTime : number`

###### Events

  - `"note" : (when:number, midi:number, duration:number, done:function, index:number)`
  - `"end" : ()`

## Contribution

  1. Fork (https://github.com/mohayonao/wamml/fork)
  1. Create a feature branch (`git checkout -b my-new-feature`)
  1. Commit your changes (`git commit -am 'add some feature'`)
  1. Run test suite with the `gulp travis` command and confirm that it passes
  1. Push to the branch (`git push origin my-new-feature`)
  1. Create new Pull Request

## License

Wamml is available under the The MIT License.
