import Bluebird from 'bluebird';
import fs from 'fs';
import path from 'path';
import _ from 'lodash';
import _debug from 'debug';

const debug = _debug('kopeer');

/**
 * Given an absolute path to `directory`, create all
 * intermediate directories leading up to and including
 * `directory`, similar to `mkdirs -p`.
 * 
 * @param {string} directory
 * The absolute path of the directory to create.
 *
 * @returns {Promise}
 * Returns the unit promise.
 */
export default async function(directory) {
  const maxTries = 10;
  await _.foldl(
    _.tail(directory.split(path.sep))
  , (acc, seg) => acc.then(async (curpath) => {
      const _curpath = ([
        (curpath === null) ? _.head(directory.split(path.sep)) : curpath
        , seg
      ]).join(path.sep);

      let tries = 0
      await (function mkdir() {
        debug(
          `Creating directory \`${ _curpath }\` `
        + `(Try ${ tries + 1 } / ${ maxTries })`);
        return fs.mkdirAsync(_curpath)
          .catch(function(e) {
            switch (e.code) {
              case 'ENOENT':
                // Retry up to `n` times.
                // `maxTries` is chosen arbitrarily here.
                tries += 1;
                if (tries < maxTries) {
                  return mkdir();
                } else {
                  throw e;
                }
              case 'EEXIST':
                return;
              default:
                throw e;
            }
          });
      })();
      return _curpath;
    })
  , Bluebird.resolve(null));
};
