'use strict';

import Bluebird from 'bluebird';
import fs from 'fs';
import _ from 'lodash';
import _debug from 'debug';

const debug = _debug('kopeer');
Bluebird.promisifyAll(fs);

const modern = /^v0\.1\d\.\d+/.test(process.version);

/**
 * Copy a single, real file.
 *
 * @param {String} source
 * The absolute path the file in question.
 *
 * @param {String} dest
 * The absolute path the target location of the file.
 *
 * @param {stat}
 * The fs-stats for this file.
 *
 * @returns {Promise}
 * Returns the unit promise.
 */
const copyFile
= Bluebird.coroutine(function*(source, dest, stat) {

  debug('Copying file `' + source + '`' + ' to `' + dest + '`');

  yield new Promise(function(resolve, reject) {

    var readStream = fs.createReadStream(source)
      , writeStream = fs.createWriteStream(dest, { mode: stat.mode });

    writeStream.on('open', function() {
      readStream.pipe(writeStream);
    });

    writeStream.on('error', function(error) {
      reject(error);
    });

    readStream.on('error', function(error) {
      reject(error);
    });

    writeStream.on(modern ? 'finish' : 'close', _.ary(resolve, 0));
  });

  yield fs.chmodAsync(dest, stat.mode)
  yield fs.utimesAsync(dest, stat.atime, stat.mtime);
});

/**
 * Copy a single symlink.
 * This makes the link "real", i.e. it copies the contents of the file
 * pointed to by symlink `source` to destination `dest`.
 *
 * @param {String} source
 * The absolute path the file in question.
 *
 * @param {String} dest
 * The absolute path the target location of the file.
 *
 * @returns {Promise}
 * Returns the unit promise.
 */
const copyLink
= Bluebird.coroutine(function*(source, dest) {
  yield fs.symlinkAsync(
    yield fs.readlinkAsync(source)
  , dest);
});

export default {
  file: copyFile
, link: copyLink
}
