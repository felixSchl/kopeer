import _ from 'lodash';
import Bluebird from 'bluebird';

export default { chunked: chunked
               , throttled: throttled
               , throttledOrd: throttledOrd };

/**
 * Map over a list and turn each element into a promise, using `f`.
 * Process a number of `limit` promises in parallel at a time.
 *
 * @param {Array} xs
 * The list array to iterate
 *
 * @param {Number} limit
 * The concurrency limit
 *
 * @param {Function} f
 * The function to apply to each element in the array.
 * Must return a promise.
 *
 * @returns {Promise}
 * Returns the composite unit promise.
 */
function chunked(xs, limit, f) {
  return _.foldl(
    _.chunk(xs, limit)
  , (acc, chunk) =>
      acc.then(() =>
        Promise.all(_.map(chunk, f)))
  , Promise.resolve());
}

/**
 * Run over a list and turn each element into a promise, using `f`.
 * Process a number of `limit` promises in parallel at a time.
 *
 * @param {Array} xs
 * The list array to iterate
 *
 * @param {Number} limit
 * The concurrency limit
 *
 * @param {Function} f
 * The function to apply to each element in the array.
 * Must return a promise.
 *
 * @param {Function} onNext
 * The function to call on each produced result.
 *
 * @param {Function} onCompleted
 * The function to call on completion.
 *
 * @param {Function} onError
 * The function to call on error. It provides a 'retry' handler, that when
 * invoked will cause a retry, otherwise will fail.
 *
 * @returns {Promise}
 * Returns the composite unit promise.
 */
function _throttled(xs, limit, f, onNext, onCompleted, onError) {
  onError = onError || _.ary(Bluebird.reject, 1);
  let i = 0;
  return Bluebird.all(_.map(
    _.range(limit)
  , __ => (function work(isRetry, lastW, lastJ) {
        const j = isRetry ? lastJ : i
            , w = isRetry ? lastW : xs[j]
        if (!isRetry) {
          i += 1;
        }
        return (j < xs.length)
          ? Bluebird.resolve(f(w))
              .tap(_.partialRight(onNext, j))
              .then(
                _.ary(work, 0)
              , e => onError(e, () => work(true, w, j)) || Bluebird.reject(e))
          : Bluebird.resolve();
    })()
  )).then(_.ary(onCompleted, 0));
}

/**
 * Run over a list and turn each element into a promise, using `f`.
 * Process a number of `limit` promises in parallel at a time.
 *
 * @param {Array} xs
 * The list array to iterate
 *
 * @param {Number} limit
 * The concurrency limit
 *
 * @param {Function} f
 * The function to apply to each element in the array.
 * Must return a promise.
 *
 * @returns {Promise}
 * Returns the elements in order of completion.
 */
function throttled(xs, limit, f) {
  const acc = [];
  return _throttled(
    xs, limit, f
  , x => acc.push(x)
  , () => _.toArray(acc)
  , (e, retry) => {
      if (e.code === 'EMFILE' || e.code === 'ENFILE') {
        return retry();
      }
    });
};

/**
 * Run over a list and turn each element into a promise, using `f`.
 * Process a number of `limit` promises in parallel at a time.
 *
 * @param {Array} xs
 * The list array to iterate
 *
 * @param {Number} limit
 * The concurrency limit
 *
 * @param {Function} f
 * The function to apply to each element in the array.
 * Must return a promise.
 *
 * @returns {Promise}
 * Returns the results in order of the input array.
 */
function throttledOrd(xs, limit, f) {
  const acc = {};
  return _throttled(
    xs, limit, f
  , (x, i) => { acc[i] = x; }
  , () => _.toArray(acc)
  , (e, retry) => {
      if (e.code === 'EMFILE' || e.code === 'ENFILE') {
        return retry();
      }
    });
};
