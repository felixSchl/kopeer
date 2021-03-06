'use strict';

import Bluebird from 'bluebird';
import fs from 'fs';
import path from 'path';
import _ from 'lodash';
import FSStatCache from './cache';

export default { dir: dir }

/**
 * Recursively walk directory `top`.
 *
 * @param {string} top
 * The directory to walk
 *
 * @param {Object} options
 * @param {Boolean} options.dereference
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
  , dereference: true
  });
  options.cache = options.cache || new FSStatCache(options.dereference);
  return walkDirectory(top, top, options.filter, options.cache);
};

async function walkDirectory(top, dir, filter, fsstats) {
  return fs.readdirAsync(dir)
    .map(filename => path.resolve(dir, filename))
    .filter(fullpath => Bluebird.resolve(
      filter
        ? filter(fullpath)
        : true))
    .map(async (filepath) => ({
        filepath: filepath
      , relpath: path.normalize(path.relative(top, filepath))
      , stats: await fsstats.stat(filepath)
    }))
    .map(({ stats, filepath, relpath }) =>
      stats.isDirectory()
        ?  walkDirectory(top, filepath, filter, fsstats)
        : { filepath: filepath, relpath: relpath })
    .reduce((a, b) => a.concat(b), []);
};
