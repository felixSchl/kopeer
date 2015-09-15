'use strict';

import Bluebird from 'bluebird';
import fs from 'fs';
import path from 'path';
import _ from 'lodash';

export default { dir: dir }

/**
 * Recursively walk directory `top`.
 *
 * @param {string} top
 * The directory to walk
 *
 * @param {Object} options
 * @param {Boolean} options.followLinks
 * Resolve symbolic links and treat them as real files.
 *
 * @param {Function} options.filter
 * Predicate function applied to each entry in order to eleminate mismatchs.
 * This allows to occlude e.g. hidden directories or dotfiles.
 *
 * @returns {Promise}
 * Returns a the list of filepaths
 */
export function dir(top, options) {
  options = _.defaults(options || {}, {
      filter: _.constant(true)
    , followLinks: false
  });
  return _walkDirectory(top, top, options.filter, options.followLinks);
};

const _walkDirectory
= Bluebird.coroutine(function*(top, dir, filter, followLinks) {
  return fs.readdirAsync(dir)
    .map(filename => path.resolve(dir, filename))
    .filter(fullpath => Bluebird.resolve(
      filter
        ? filter(path.relative(top, fullpath))
        : true))
    .map(Bluebird.coroutine(function*(filepath) {
      return {
        filepath: filepath
      , relpath: path.normalize(path.relative(top, filepath))
      , stats: yield (fs[followLinks ? 'statAsync' : 'lstatAsync'])(filepath)
      };
    }))
    .map(entry =>
      entry.stats.isDirectory()
        ?  _walkDirectory(top, entry.filepath, filter, followLinks)
        : entry)
    .reduce((a, b) => a.concat(b), []);
});
