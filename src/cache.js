import _ from 'lodash';
import Bluebird from 'bluebird';
import fs from 'fs';
Bluebird.promisifyAll(fs);

/**
 * FSState cache
 * Caches calls to `fs.stat` and `fs.lstat`.
 */
export default class FSStatCache {

  /**
   * @constructor
   * @param {Boolean} dereference
   * Dereference symlinks?
   */
  constructor(dereference) {
    this._cache = {};
    this._dereference = dereference;
    this._fsstat = fs[this._dereference ? 'statAsync' : 'lstatAsync'];
  }

  /**
   * Perform a fs stat/lstat call.
   *
   * @param {String} filepath
   * The filepath to stat
   *
   * @returns {Promise.<Stat>}
   */
  async stat(filepath) {
    if (!_.has(this._cache, filepath)) {
      this._cache[filepath] = await this._fsstat.call(fs, filepath);
    }
    return this._cache[filepath];
  }
}
