'use strict';

var stream = require('stream');

/////////////////////////////////////
// Checks if the value is a promise;
function isPromise(value) {
    return value && value.then instanceof Function;
}

////////////////////////////////////////////
// Checks object for being a readable stream;

function isReadableStream(obj) {
    return obj instanceof stream.Stream &&
        typeof obj._read === 'function' &&
        typeof obj._readableState === 'object';
}

////////////////////////////////////////////////////////////
// Sets an object property as read-only and non-enumerable.
function extend(obj, name, value) {
    Object.defineProperty(obj, name, {
        value: value,
        enumerable: false,
        writable: false
    });
}

/////////////////////////////////////////////////////
// Resolves a mixed value into the actual value,
// consistent with the way mixed values are defined:
// https://github.com/vitaly-t/spex/wiki/Mixed-Values
function resolve(value, params, onSuccess, onError) {

    var self = this,
        delayed = false;

    function loop() {
        while (value instanceof Function) {
            if (value.constructor.name === 'GeneratorFunction') {
                value = asyncAdapter(value);
            }
            try {
                value = params ? value.apply(self, params) : value.call(self);
            } catch (e) {
                onError(e);
                return;
            }
        }
        if (isPromise(value)) {
            value
                .then(function (data) {
                    delayed = true;
                    value = data;
                    loop();
                })
                .catch(function (error) {
                    onError(error);
                });
        } else {
            onSuccess(value, delayed);
        }
    }

    loop();
}

/////////////////////////////////
// Generator-to-Promise adapter;
//
// Based on: https://www.promisejs.org/generators/#both
function asyncAdapter(generator) {
    return function () {
        var g = generator.apply(this, arguments);

        function handle(result) {
            if (result.done) {
                return $p.resolve(result.value);
            }
            return $p.resolve(result.value)
                .then(function (res) {
                    return handle(g.next(res));
                }, function (err) {
                    return handle(g.throw(err));
                });
        }

        return handle(g.next());
    }
}

//////////////////////////////////////////
// Checks if the function is a generator,
// and if so - wraps it up into a promise;
function wrap(func) {
    if (func instanceof Function) {
        if (func.constructor.name === 'GeneratorFunction') {
            return asyncAdapter(func);
        }
        return func;
    }
    return null;
}

var $p;

module.exports = function (config) {
    $p = config.promise;
    return {
        isPromise: isPromise,
        isReadableStream: isReadableStream,
        extend: extend,
        resolve: resolve,
        wrap: wrap
    };
};
