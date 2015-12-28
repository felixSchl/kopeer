import _ from 'lodash';
import Worker from './Worker';
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
 * @param {Array} ws
 * The array of work to iterate
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
function _throttled(ws, limit, f, onNext, onCompleted, onError) {
  const worker = new Worker(
    ({ w, i }) => Bluebird.resolve(f(w)).then(r => ({ r: r, i: i }))
  , { limit: limit
    , recover: onError });
  worker.on('next', ({ r, i }) => { onNext(r, i); });
  return new Bluebird((resolve, reject) => {
    worker.once('completed', () => resolve(onCompleted()));
    worker.once('failed', e => reject(e));
    worker.once('drain', () => worker.dispose());
    if (ws.length) {
      _.each(ws, (w, i) => worker.queue({ i: i, w: w }));
    } else {
      resolve(onCompleted());
    }
  });
}

/**
 * Run over a list and turn each element into a promise, using `f`.
 * Process a number of `limit` promises in parallel at a time.
 *
 * @param {Array} xs
 * The array of work to iterate
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
