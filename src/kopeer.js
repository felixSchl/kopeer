import Bluebird from 'bluebird';
import fs from 'fs';
import path from 'path';
import _debug from 'debug';
import _ from 'lodash';
import walk from './walk';
import map from './map';
import copy from './copy';
import mkdirs from './mkdirs';
import FSStatCache from './cache';
import commit from './commit';
import { Minimatch } from 'minimatch';

const debug = _debug('kopeer');
Bluebird.promisifyAll(fs);

/**
 * Sanitize the defaults for all kopeer public methods.
 *
 * @param {Object} opts
 * The options as passed in by the caller.
 *
 * @returns {Object}
 * The sanitized options
 */
function defaults(opts) {
  return _.defaults(opts || {}, {
    limit: 512
  , filter: null
  , rename: _.identity
  , dereference: false
  , ignore: null
  });
}

/**
 * Run a promise and invoke the given callback
 * handle on success and error.
 *
 * @param {Promise} promise
 * The promsie to run
 *
 * @param {Function} callback
 * The callback to invoke
 *
 * @returns {Promise}
 */
function runPromise(promise, callback) {
  if (callback) {
    promise
      .tap(_.ary(callback, 0))
      .catch(callback);
  }
  return promise;
}

/**
 * Copy a file
 *
 * Copy a file from source location `source` to destination `dest`,
 * given `options`. Any intermediate directories will be created.
 *
 * @param {String} source
 * The absolute path the file in question.
 *
 * @param {String} destination
 * The absolute path the target location of the file.
 *
 * @param {Object} options
 * @param {Boolean} options.dereference
 * If true, makes symlinks "real" by following them.
 * If `source` is determined to be a directory, not a file, `EISDIR` is thrown.
 *
 * @param {Function} [callback]
 * The callback to invoke.
 *
 * @returns {Promise}
 */
function _file(source, destination, options, callback) {

  // shuffle arguments
  if (_.isFunction(options)) {
    callback = options;
    options = {};
  }

  // fallback to sane defaults
  options = defaults(options);

  debug(`using options.limit: ${ options.limit }`);
  debug(`using options.dereference: ${ options.dereference }`);

  // If the destination path looks like a directory, resolve the source path
  // relative to the destination path.
  destination = (_.endsWith(destination, '/') || _.endsWith(destination, '\\'))
    ? path.resolve(destination, path.basename(source))
    : destination;

  return runPromise(
    (async () => {
      const fsstats = new FSStatCache(options.dereference);

      if ((await fsstats.stat(source)).isDirectory()) {
        await Bluebird.reject(new Error('EISDIR'))
      } else {
        await commit(
          [{ source: source, dest: destination }]
        , options.limit
        , fsstats);
      }
    })()
  , callback);
}

/**
 * Copy a directory
 *
 * Copy a directory from it's source location `source` to destination `dest`,
 * given `options`. Any intermediate directories will be created.
 *
 * @param {String} source
 * The absolute path the directory in question.
 *
 * @param {String} destination
 * The absolute path the target location.
 *
 * @param {Boolean} options.dereference
 * If true, makes symlinks "real" by following them.
 * If `source` is determined to be a file, not a directory, `EISFILE` is thrown.
 *
 * @param {Function} [options.rename]
 * Function applied to each new path, relative to it's new root.
 * Returns a string to alter the path.
 *
 * @deprecated
 * @param {Function} [options.filter]
 * Predicate function applied to each source path, in order to eliminate paths
 * early that are not welcome.
 *
 * @param {String|Array.<String>} [options.ignore]
 * A `.gitignore` like pattern.
 *
 * @param {Function} [callback]
 * The callback to invoke.
 *
 * @returns {Promise}
 */
function _directory(directory, destination, options, callback) {

  // shuffle arguments
  if (_.isFunction(options)) {
    callback = options;
    options = {};
  }

  // fallback to sane defaults
  options = defaults(options);

  return runPromise(
    (async () => {
      const fsstats = new FSStatCache(options.dereference);

      if (!(await fsstats.stat(directory)).isDirectory()) {
        await Bluebird.reject(new Error('EISFILE'));
      } else {

        let filter;
        if (options.ignore) {
          const minis = _.map(
            _.isArray(options.ignore)
              ? options.ignore
              : [ options.ignore ]
          , p => new Minimatch(p));
          filter = p => _.all(minis, m => m.match(p) === false);
        } else {
          filter = options.filter
            ? options.filter
            : _.constant(true);
        }

        // Collect the `{ source, dest }` mappings
        debug('Collecting mappings...');
        const mappings = await walk.dir(
          directory
        , { filter: filter
          , dereference: options.dereference
          , cache: fsstats })
          .map(item => (
            { source: item.filepath
            , dest: options.rename(path.resolve(destination, item.relpath)) }
            ));

        // Create the directories and files.
        await commit(mappings, options.limit, fsstats);
      }
    })()
  , callback);
};

/**
 * Callback/Defaults wrapper for either @see _directory, or @see _file,
 * if `source` turns out to be a directory or file, respectively.
 */
function _kopeer(source, dest, options, callback) {

  if (_.isFunction(options)) {
    callback = options;
    options = {};
  }

  options = defaults(options);

  const fsstats = new FSStatCache(options.dereference);

  return runPromise(
    fsstats.stat(source)
      .then(stat => stat.isDirectory() ? _directory : _file)
      .then(fn => fn(source, dest, options))
  , callback);
};

module.exports = _kopeer;
module.exports.file = _file;
module.exports.directory = _directory;
