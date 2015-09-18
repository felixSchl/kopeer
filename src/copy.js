import Bluebird from 'bluebird';
import fs from 'fs';
import _ from 'lodash';
import _debug from 'debug';

export default { file: copyAnyFile };

Bluebird.promisifyAll(fs);

const debug = _debug('kopeer');
const modern = /^v0\.1\d\.\d+/.test(process.version);

async function copyAnyFile(source, dest, stat) {
  await (stat.isSymbolicLink()
    ? copyLink(source, dest)
    : copyFile(source, dest, stat));
};

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
async function copyFile(source, dest, stat) {
  debug('Copying file `' + source + '`' + ' to `' + dest + '`');
  await new Promise(function(resolve, reject) {
    const readStream = fs.createReadStream(source)
        , writeStream = fs.createWriteStream(dest, { mode: stat.mode });
    writeStream.on('open', () => readStream.pipe(writeStream));
    writeStream.on('error', reject)
    readStream.on('error', reject)
    writeStream.on(modern ? 'finish' : 'close', _.ary(resolve, 0));
  });

  await fs.chmodAsync(dest, stat.mode)
  await fs.utimesAsync(dest, stat.atime, stat.mtime);
};

/**
 * Copy a single symlink.
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
async function copyLink(source, dest) {
  await fs.symlinkAsync(
    await fs.readlinkAsync(source), dest);
};
