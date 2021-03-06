'use strict';

/**
 * @method page
 * @summary Resolves a dynamic sequence of pages/arrays with $[mixed values].
 * @description
 * **Alternative Syntax:**
 * `page(source, {dest, limit})` &#8658; `Promise`
 *
 * Acquires pages (arrays of $[mixed values]) from the source function, one by one,
 * and resolves each page as a $[batch], till no more pages left or an error/reject occurs.
 *
 * <img src="../images/page.png" width="561px" height="193px" alt="page">
 *
 * @param {Function|generator} source
 * Expected to return a $[mixed value] that resolves with the next page of data (array of $[mixed values]).
 * Returning or resolving with `undefined` ends the sequence, and the method resolves.
 *
 * The function is called with the same `this` context as the calling method.
 *
 * Parameters:
 *  - `index` = index of the page being requested
 *  - `data` = previously returned page, resolved as a $[batch] (`undefined` when `index=0`)
 *  - `delay` = number of milliseconds since the last call (`undefined` when `index=0`)
 *
 * If the function throws an error or returns a rejected promise, the method rejects with
 * object `{index, error, source}`:
 *  - `index` = index of the request that failed
 *  - `error` = the error thrown or the rejection reason
 *  - `source` = resolved `data` that was passed into the function
 *
 * And if the function returns or resolves with anything other than an array or `undefined`,
 * the method rejects with the same object, but with `error` set to `Unexpected data returned
 * from the source.`
 *
 * Passing in anything other than a function will throw `Invalid page source.`
 *
 * @param {Function|generator} [dest]
 * Optional destination function (or generator), to receive a resolved $[batch] of data
 * for each page, process it and respond as required.
 *
 * Parameters:
 *  - `index` = page index in the sequence
 *  - `data` = page data resolved as a $[batch]
 *  - `delay` = number of milliseconds since the last call (`undefined` when `index=0`)
 *
 * The function is called with the same `this` context as the calling method.
 *
 * It can optionally return a promise object, if notifications are handled asynchronously.
 * And if a promise is returned, the method will not request another page from the `source`
 * function until the promise has been resolved.
 *
 * If the function throws an error or returns a rejected promise, the sequence terminates,
 * and the method rejects with object `{index, error, dest}`:
 * - `index` = index of the page passed into the function
 * - `error` = the error thrown or the rejection reason
 * - `dest` = resolved $[batch] that was passed into the function
 *
 * @param {Number} [limit=0]
 * Limits the maximum number of pages to be requested from the `source`. If the value is greater
 * than 0, the method will successfully resolve once the specified limit has been reached.
 *
 * When `limit` isn't specified (default), the sequence is unlimited, and it will continue
 * till one of the following occurs:
 *  - `source` returns or resolves with `undefined` or an invalid value (non-array)
 *  - either `source` or `dest` functions throw an error or return a rejected promise
 *
 * @returns {Promise}
 * When successful, the method resolves with object `{pages, total, duration}`:
 *  - `pages` = number of pages resolved
 *  - `total` = the sum of all page sizes (total number of values resolved)
 *  - `duration` = number of milliseconds consumed by the method
 *
 * When the method fails, there are two types of rejects that may occur:
 *  - *Normal Reject*: when one of the pages failed to resolve as a $[batch]
 *  - *Internal Reject*: caused by either the `source` or the `dest` functions
 *
 * *Normal Rejects* are reported with object `{index, data}`:
 *  - `index` = index of the page rejected by method $[batch]
 *  - `data` = the rejection data from method $[batch]
 *
 * *Internal Rejects* are reported with object `{index, error, [source], [dest]}`:
 *  - `index` = index of the page for which the error/reject occurred
 *  - `error` = the error thrown or the rejection reason
 *  - `source` - set when caused by the `source` function (see `source` parameter)
 *  - `dest` - set when caused by the `dest` function (see `dest` parameter)
 *
 * Object for both reject types has method `getError()` to simplify access to the error.
 * For *Normal Rejects* it will return `data.getErrors()[0]` (see method $[batch]),
 * and `error` value for the *Internal Rejects*.
 */
function page(source, dest, limit) {

    if (typeof source !== 'function') {
        throw new TypeError("Invalid page source.");
    }

    limit = (limit > 0) ? parseInt(limit) : 0;
    source = $utils.wrap(source);
    dest = $utils.wrap(dest);

    var self = this, request, srcTime, destTime, start = Date.now(), total = 0;

    return $p(function (resolve, reject) {

        function loop(idx) {
            var srcNow = Date.now(),
                srcDelay = idx ? (srcNow - srcTime) : undefined;
            srcTime = srcNow;
            $utils.resolve.call(self, source, [idx, request, srcDelay], function (value) {
                if (value === undefined) {
                    success();
                } else {
                    if (value instanceof Array) {
                        $spex.batch(value)
                            .then(function (data) {
                                request = data;
                                total += data.length;
                                if (dest) {
                                    var destResult, destNow = Date.now(),
                                        destDelay = idx ? (destNow - destTime) : undefined;
                                    destTime = destNow;
                                    try {
                                        destResult = dest.call(self, idx, data, destDelay);
                                    } catch (err) {
                                        fail({
                                            error: err,
                                            dest: data
                                        });
                                        return;
                                    }
                                    if ($utils.isPromise(destResult)) {
                                        destResult
                                            .then(next)
                                            .catch(function (error) {
                                                fail({
                                                    error: error,
                                                    dest: data
                                                });
                                            });
                                    } else {
                                        next();
                                    }
                                } else {
                                    next();
                                }
                            })
                            .catch(function (error) {
                                fail({
                                    data: error
                                });
                            });
                    } else {
                        fail({
                            error: "Unexpected data returned from the source.",
                            source: request
                        });
                    }
                }
            }, function (reason) {
                fail({
                    error: reason,
                    source: request
                });
            });

            function next() {
                if (limit === ++idx) {
                    success();
                } else {
                    loop(idx);
                }
            }

            function success() {
                resolve({
                    pages: idx,
                    total: total,
                    duration: Date.now() - start
                });
            }

            function fail(reason) {
                reason.index = idx;
                $utils.extend(reason, 'getError', function () {
                    return ('data' in reason) ? reason.data.getErrors()[0] : reason.error;
                });
                reject(reason);
            }
        }

        loop(0);
    });
}

///////////////////////////////////
// object-to-parameters converter;
function _page(source, dest, limit) {
    if (dest && typeof dest === 'object') {
        return page.call(this, source, dest.dest, dest.limit);
    } else {
        return page.call(this, source, dest, limit);
    }
}

var $spex, $utils, $p;

module.exports = function (config) {
    $spex = config.spex;
    $utils = config.utils;
    $p = config.promise;
    return _page;
};
