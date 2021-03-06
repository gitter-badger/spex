'use strict';

/**
 * @method sequence
 * @summary Resolves a dynamic sequence of $[mixed values].
 * @description
 * **Alternative Syntax:**
 * `sequence(source, {dest, limit, track})` &#8658; `Promise`
 *
 * Acquires $[mixed values] from the source function, one at a time, and resolves them,
 * till either no more values left in the sequence or an error/reject occurs.
 * It supports both [linked and detached sequencing](../concept/sequencing.md).
 *
 * <img src="../images/sequence.png" width="561px" height="193px" alt="sequence">
 *
 * @param {Function|generator} source
 * Expected to return the next $[mixed value] to be resolved. Returning or resolving
 * with `undefined` ends the sequence, and the method resolves.
 *
 * Parameters:
 *  - `index` = current request index in the sequence
 *  - `data` = resolved data from the previous call (`undefined` when `index=0`)
 *  - `delay` = number of milliseconds since the last call (`undefined` when `index=0`)
 *
 * The function is called with the same `this` context as the calling method.
 *
 * If the function throws an error or returns a rejected promise, the sequence terminates,
 * and the method rejects with object `{index, error, source}`:
 *  - `index` = index of the request that failed
 *  - `error` = the error thrown or the rejection reason
 *  - `source` = resolved `data` that was passed into the function
 *
 * Passing in anything other than a function will throw `Invalid sequence source.`
 *
 * @param {Function|generator} [dest]
 * Optional destination function (or generator), to receive resolved data for each index,
 * process it and respond as required.
 *
 * Parameters:
 *  - `index` = index of the resolved data in the sequence
 *  - `data` = the data resolved
 *  - `delay` = number of milliseconds since the last call (`undefined` when `index=0`)
 *
 * The function is called with the same `this` context as the calling method.
 *
 * It can optionally return a promise object, if data processing is done asynchronously.
 * If a promise is returned, the method will not request another value from the `source` function,
 * until the promise has been resolved.
 *
 * If the function throws an error or returns a rejected promise, the sequence terminates,
 * and the method rejects with object `{index, error, dest}`:
 * - `index` = index of the data that was processed
 * - `error` = the error thrown or the rejection reason
 * - `dest` = resolved data that was passed into the function
 *
 * @param {Number} [limit=0]
 * Limits the maximum size of the sequence. If the value is greater than 0, the method will
 * successfully resolve once the specified limit has been reached.
 *
 * When `limit` isn't specified (default), the sequence is unlimited, and it will continue
 * till one of the following occurs:
 *  - `source` either returns or resolves with `undefined`
 *  - either `source` or `dest` functions throw an error or return a rejected promise
 *
 * @param {Boolean} [track=false]
 * Changes the type of data to be resolved by this method. By default, it is `false`
 * (see the return result). When set to be `true`, the method tracks/collects all resolved data
 * into an array internally, and resolves with that array once the method has finished successfully.
 *
 * It must be used with caution, as to the size of the sequence, because accumulating data for
 * a very large sequence can result in consuming too much memory.
 *
 * @returns {Promise}
 * When successful, the resolved data depends on parameter `track`. When `track` is `false`
 * (default), the method resolves with object `{total, duration}`:
 *  - `total` = number of values resolved by the sequence
 *  - `duration` = number of milliseconds consumed by the method
 *
 * When `track` is `true`, the method resolves with an array of all the data that has been resolved,
 * the same way that the standard `promise.all` resolves. In addition, the array comes extended with
 * read-only property `duration` - number of milliseconds consumed by the method.
 *
 * When the method fails, the reject result depends on which function caused the failure - `source`
 * or `dest`. See the two parameters for the rejection details.
 */
function sequence(source, dest, limit, track) {

    if (typeof source !== 'function') {
        throw new TypeError("Invalid sequence source.");
    }

    limit = (limit > 0) ? parseInt(limit) : 0;
    source = $utils.wrap(source);
    dest = $utils.wrap(dest);

    var self = this, data, srcTime, destTime, result = [], start = Date.now();

    return $p(function (resolve, reject) {

        function loop(idx) {
            var srcNow = Date.now(),
                srcDelay = idx ? (srcNow - srcTime) : undefined;
            srcTime = srcNow;
            $utils.resolve.call(self, source, [idx, data, srcDelay], function (value, delayed) {
                data = value;
                if (data === undefined) {
                    finish();
                } else {
                    if (track) {
                        result.push(data);
                    }
                    if (dest) {
                        var destResult, destNow = Date.now(),
                            destDelay = idx ? (destNow - destTime) : undefined;
                        destTime = destNow;
                        try {
                            destResult = dest.call(self, idx, data, destDelay);
                        } catch (e) {
                            reject({
                                index: idx,
                                error: e,
                                dest: data
                            });
                            return;
                        }
                        if ($utils.isPromise(destResult)) {
                            destResult
                                .then(function () {
                                    next(true);
                                })
                                .catch(function (error) {
                                    reject({
                                        index: idx,
                                        error: error,
                                        dest: data
                                    });
                                });
                        } else {
                            next(delayed);
                        }
                    } else {
                        next(delayed);
                    }
                }
            }, function (reason) {
                reject({
                    index: idx,
                    error: reason,
                    source: data
                });
            });

            function next(delayed) {
                if (limit === ++idx) {
                    finish();
                } else {
                    if (delayed) {
                        loop(idx);
                    } else {
                        $p.resolve()
                            .then(function () {
                                loop(idx);
                            });
                    }
                }
            }

            function finish() {
                var length = Date.now() - start;
                if (track) {
                    $utils.extend(result, 'duration', length);
                } else {
                    result = {
                        total: idx,
                        duration: length
                    }
                }
                resolve(result);
            }
        }

        loop(0);
    });
}

///////////////////////////////////
// object-to-parameters converter;
function _sequence(source, dest, limit, track) {
    if (dest && typeof dest === 'object') {
        return sequence.call(this, source, dest.dest, dest.limit, dest.track);
    } else {
        return sequence.call(this, source, dest, limit, track);
    }
}

var $utils, $p;

module.exports = function (config) {
    $utils = config.utils;
    $p = config.promise;
    return _sequence;
};
