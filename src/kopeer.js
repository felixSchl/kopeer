import Bluebird from 'bluebird';
import fs from 'fs';
import path from 'path';
import _debug from 'debug';
import _ from 'lodash';
import walk from './walk';
import map from './map';
import copy from './copy';
import mkdirs from './mkdirs';

const debug = _debug('kopeer');
Bluebird.promisifyAll(fs);

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
const copyFile
= Bluebird.coroutine(function*(source, dest, options) {

  debug(`using options.limit: ${ options.limit }`);
  debug(`using options.dereference: ${ options.dereference }`);

  const stat = yield (fs[
    options.dereference
      ? 'statAsync'
      : 'lstatAsync'])(source);

  if (stat.isDirectory()) {
    yield Bluebird.reject(new Error('EISDIR'))
  } else {
    /*
     * Create the directories
     */
    yield mkdirs(path.dirname(dest));

    /*
     * Copy the file
     */
    yield stat.isSymbolicLink()
      ? copy.link(source, dest)
      : copy.file(source, dest, stat);
  }
});

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
const copyDir
= Bluebird.coroutine(function*(source, dest, options, callback) {

  debug(`Walking \`${ source }\`...`);

  const stat = yield (fs[
    options.dereference
      ? 'statAsync'
      : 'lstatAsync'])(source);

  if (!stat.isDirectory()) {
    yield Bluebird.reject(new Error('EISFILE'));
  } else {

    /*
     * Create the directories
     */
    yield mkdirs(path.dirname(dest));

    /*
     * Collect the mappings
     */
    debug('Collecting mappings...');
    const mappings = yield walk.dir(
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
      yield map.chunked(
        _.unique(
          [dest].concat(
            _.map(
              mappings
            , unit => path.dirname(unit.targetPath))))
        , options.limit
        , _.ary(mkdirs, 1));

      /*
       * Write the files
       */
      debug('Writing files...');
      yield map.chunked(
        mappings
      , options.limit
      , unit =>
        (unit.sourceEntry.stats.isSymbolicLink() ? copy.link : copy.file)
          (unit.sourceEntry.filepath
          , unit.targetPath
          , unit.sourceEntry.stats));
  }
});

/**
 * Callback/Defaults wrapper for @see copyFile
 */
function _file(source, dest, options, callback) {
  if (_.isFunction(options)) {
    callback = options;
    options = {};
  }

  const promise = copyFile(
    source
  , (_.endsWith(dest, '/') || _.endsWith(dest, '\\'))
      ? dest = path.resolve(dest, path.basename(source))
      : dest
  , _.defaults(options || {}, {
      limit: 512
    , filter: null
    , rename: _.identity
    , dereference: false
    })
  , callback);

  if (callback) {
    promise
      .tap(_.ary(callback, 0))
      .catch(callback);
  }

  return promise;
}

/**
 * Callback/Defaults wrapper for @see copyDir
 */
function _directory(directory, destination, options, callback) {
  if (_.isFunction(options)) {
    callback = options;
    options = {};
  }

  const promise = copyDir(
    directory
  , destination
  , _.defaults(options || {}, {
      filter: null
    , limit: 512
    , rename: _.identity
    , dereference: false
    }));

  if (callback) {
    promise
      .tap(_.ary(callback, 0))
      .catch(callback);
  }

  return promise;
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

  const promise = (fs[options.dereference ? 'statAsync' : 'lstatAsync'])(source)
    .then(function(stat) {
      return (stat.isDirectory() ? _directory : _file)(source, dest, options);
    })
  ;

  if (callback) {
    promise
      .tap(_.ary(callback, 0))
      .catch(callback);
  }

  return promise;
};

module.exports = _kopeer;
module.exports.file = _file;
module.exports.directory = _directory;
