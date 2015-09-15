import _ from 'lodash';
import Promise from 'bluebird';

export default { chunked: chunked };

function chunked(xs, limit, f) {
  return _.foldl(
    _.chunk(xs, limit)
  , (acc, chunk) =>
      acc.then(() =>
        Promise.all(_.map(chunk, f)))
  , Promise.resolve());
};
