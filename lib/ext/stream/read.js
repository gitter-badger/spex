'use strict';

/**
 * @method read
 * @summary Consumes and processes data from a $[Readable] stream.
 * @description
 * **Alternative Syntax:**
 * `read(stream, receiver, {closable, readSize})` &#8658; `Promise`
 *
 * Reads the entire stream, using **paused mode**, with support for both synchronous
 * and asynchronous data processing.
 *
 * **NOTE:** Once the method has finished, the onus is on the caller to release the stream
 * according to its protocol.
 *
 * <img src="../../images/read.png" width="641px" height="193px" alt="read">
 *
 * @param {Object} stream
 * $[Readable] stream object.
 *
 * Passing in anything else will throw `Readable stream is required.`
 *
 * @param {Function|generator} receiver
 * Data processing callback (or generator).
 *
 * Passing in anything else will throw `Invalid stream receiver.`
 *
 * Parameters:
 *  - `index` = index of the call made to the function
 *  - `data` = array of all data reads from the stream's buffer
 *  - `delay` = number of milliseconds since the last call (`undefined` when `index=0`)
 *
 * The function is called with the same `this` context as the calling method.
 *
 * It can optionally return a promise object, if data processing is asynchronous.
 * And if a promise is returned, the method will not read data from the stream again,
 * until the promise has been resolved.
 *
 * If the function throws an error or returns a rejected promise, the method rejects
 * with the same error / rejection reason.
 *
 * @param {Boolean} [closable=false]
 * Instructs the method to resolve on event `close` supported by the stream,
 * as opposed to event `end` that's used by default.
 *
 * @param {Number} [readSize]
 *
 * When the value is greater than 0, it sets the read size from the stream's buffer
 * when the next data is available. By default, the method uses as few reads as possible
 * to get all the data currently available in the buffer.
 *
 * @returns {Promise}
 * When finished successfully, resolves with object `{calls, reads, length, duration}`:
 *  - `calls` = number of calls made into the `receiver`
 *  - `reads` = number of successful reads from the stream
 *  - `length` = total length for all the data reads from the stream
 *  - `duration` = number of milliseconds consumed by the method
 *
 * When it fails, the method rejects with the error/reject specified,
 * which can happen as a result of:
 *  - event `error` emitted by the stream
 *  - receiver throws an error or returns a rejected promise
 */
function read(stream, receiver, closable, readSize) {

    if (!$utils.isReadableStream(stream)) {
        throw new TypeError("Readable stream is required.");
    }

    if (typeof receiver !== 'function') {
        throw new TypeError("Invalid stream receiver.");
    }

    readSize = (readSize > 0) ? parseInt(readSize) : null;
    receiver = $utils.wrap(receiver);

    var self = this, reads = 0, length = 0, start = Date.now(),
        index = 0, cbTime, ready, waiting, stop;

    return $p(function (resolve, reject) {

        function onReadable() {
            ready = true;
            process();
        }

        function onEnd() {
            if (!closable) {
                success();
            }
        }

        function onClose() {
            success();
        }

        function onError(error) {
            fail(error);
        }

        stream.on('readable', onReadable);
        stream.on('end', onEnd);
        stream.on('close', onClose);
        stream.on('error', onError);

        function process() {
            if (!ready || stop || waiting) {
                return;
            }
            ready = false;
            waiting = true;
            var page, data = [];
            do {
                page = stream.read(readSize);
                if (page) {
                    data.push(page);
                    // istanbul ignore next: requires a unique stream that
                    // creates objects without property `length` defined.
                    length += page.length || 0;
                    reads++;
                }
            } while (page);

            if (!data.length) {
                waiting = false;
                return;
            }

            var result, cbNow = Date.now(),
                cbDelay = index ? (cbNow - cbTime) : undefined;
            cbTime = cbNow;
            try {
                result = receiver.call(self, index++, data, cbDelay);
            } catch (e) {
                fail(e);
                return;
            }

            if ($utils.isPromise(result)) {
                result
                    .then(function () {
                        waiting = false;
                        process();
                    })
                    .catch(function (error) {
                        fail(error);
                    });
            } else {
                waiting = false;
                process();
            }
        }

        function success() {
            cleanup();
            resolve({
                calls: index,
                reads: reads,
                length: length,
                duration: Date.now() - start
            });
        }

        function fail(error) {
            stop = true;
            cleanup();
            reject(error);
        }

        function cleanup() {
            stream.removeListener('readable', onReadable);
            stream.removeListener('close', onClose);
            stream.removeListener('error', onError);
            stream.removeListener('end', onEnd);
        }
    });
}

///////////////////////////////////
// object-to-parameters converter;
function _read(stream, receiver, closable, readSize) {
    if (closable && typeof closable === 'object') {
        return read.call(this, stream, receiver, closable.closable, closable.readSize);
    } else {
        return read.call(this, stream, receiver, closable, readSize);
    }
}

var $utils, $p;

module.exports = function (config) {
    $utils = config.utils;
    $p = config.promise;
    return _read;
};
