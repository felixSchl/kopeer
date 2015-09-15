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

const copyFile
= Bluebird.coroutine(function*(source, dest, options) {

  debug(`using options.limit: ${ options.limit }`);
  debug(`using options.dereference: ${ options.dereference }`);

  /*
   * Create the directories
   */
  yield mkdirs(path.dirname(dest));
  const stat = yield (fs[
    options.dereference
      ? 'statAsync'
      : 'lstatAsync'])(source);

  /*
   * Write the files
   */
  yield stat.isSymbolicLink()
    ? copy.link(source, dest)
    : stat.isDirectory()
      ? copyDir(source, path.resolve(dest, path.basename(source)), options)
      : copy.file(source, dest, stat);
});

const copyDir
= Bluebird.coroutine(function*(directory, destination, options, callback) {

  debug(`Walking \`${ directory }\`...`);

  const mappings = yield walk.dir(
    directory
  , { filter: options.filter, followLinks: options.dereference })
    .map(entry => (
      { sourceEntry: entry
      , targetPath: options.rename(path.resolve(destination, entry.relpath)) }
      ));

    /*
     * Create the directories
     */
    debug('Creating directories...');
    yield map.chunked(
      _.unique(
        [destination].concat(
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
        (unit.sourceEntry.filepath, unit.targetPath, unit.sourceEntry.stats));
});

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

function _kopeer(source, dest, options, callback) {

  if (_.isFunction(options)) {
    callback = options;
    options = {};
  }

  const promise = (fs[options.dereference ? 'statAsync' : 'lstatAsync'])(source)
    .then(function(stat) {
      return (stat.isDirectory() ? _directory : _file)(
        source
      , dest
      , options
      );
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

