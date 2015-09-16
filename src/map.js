import _ from 'lodash';
import Promise from 'bluebird';

export default { chunked: chunked };

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
};
