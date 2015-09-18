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
 * @param {String} dest
 * The absolute path the target location of the file.
 *
 * @param {Object} options
 * @param {Boolean} options.dereference
 * If true, makes symlinks "real" by following them.
 * If `source` is determined to be a directory, not a file, `EISDIR` is thrown.
 */
async function copyFile(source, dest, options) {

  debug(`using options.limit: ${ options.limit }`);
  debug(`using options.dereference: ${ options.dereference }`);

  const fsstats = new FSStatCache(options.dereference)
      , stat = await fsstats.stat(source);

  if (stat.isDirectory()) {
    await Bluebird.reject(new Error('EISDIR'))
  } else {
    await mkdirs(path.dirname(dest));
    await copy.file(source, dest, stat);
  }
};

/**
 * Copy a directory
 *
 * Copy a directory from it's source location `source` to destination `dest`,
 * given `options`. Any intermediate directories will be created.
 *
 * @param {String} source
 * The absolute path the directory in question.
 *
 * @param {String} dest
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
 * @param {Function} [options.filter]
 * Predicate function applied to each source path, in order to eliminate paths
 * early that are not welcome.
 */
async function copyDir(source, dest, options) {

  debug(`Walking \`${ source }\`...`);

  const fsstats = new FSStatCache(options.dereference)
      , stat = await fsstats.stat(source);

  if (!stat.isDirectory()) {
    await Bluebird.reject(new Error('EISFILE'));
  } else {

    /*
     * Collect the mappings
     */
    debug('Collecting mappings...');
    const mappings = await walk.dir(
      source
    , { filter: options.filter
      , followLinks: options.dereference })
      .map(entry => (
        { sourceEntry: entry
        , targetPath: options.rename(path.resolve(dest, entry.relpath)) }
        ));

      /*
       * Create the directories
       */
      debug('Creating directories...');
      await map.chunked(
        _.unique(
          [dest].concat(_.map(
              mappings
            , unit => path.dirname(unit.targetPath))))
        , options.limit
        , _.ary(mkdirs, 1));

      /*
       * Write the files
       */
      debug('Writing files...');
      await map.chunked(
        mappings
      , options.limit
      , unit =>
        copy.file(
          unit.sourceEntry.filepath
        , unit.targetPath
        , unit.sourceEntry.stats));
  }
};

/**
 * Callback/Defaults wrapper for @see copyFile
 */
function _file(source, dest, options, callback) {

  if (_.isFunction(options)) {
    callback = options;
    options = {};
  }

  return runPromise(
    copyFile(
      source
    , (_.endsWith(dest, '/') || _.endsWith(dest, '\\'))
        ? dest = path.resolve(dest, path.basename(source))
        : dest
    , defaults(options))
  , callback);
}

/**
 * Callback/Defaults wrapper for @see copyDir
 */
function _directory(directory, destination, options, callback) {

  if (_.isFunction(options)) {
    callback = options;
    options = {};
  }

  return runPromise(
    copyDir(directory, destination, defaults(options))
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
