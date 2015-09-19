import path from 'path';
import Bluebird from 'bluebird';
import _ from 'lodash';
import _debug from 'debug';
import fs from 'fs';
import map from './map';
import mkdirs from './mkdirs';
import copy from './copy';

const debug = _debug('kopeer');
Bluebird.promisifyAll(fs);

/**
 * Commit to a set of mappings, i.e. copy each file.
 *
 * @param {Array.<{ source, dest }>} mappings
 * The mappings to copy, each item has a source and a dest field, giving
 * the full path path the file in question.
 *
 * @param {Number} limit
 * The limit of concurrent IO operations.
 *
 * @param {FSStatCache} fsstats
 * The FFStateCache to get file stats from.
 */
export default async function commit(mappings, limit, fsstats) {
  // Create the directories
  debug('Creating directories...');
  await map.throttled(
    _.unique(
      _.map(mappings, ({ dest }) => path.dirname(dest)))
    , limit
    , _.ary(mkdirs, 1));

  // Write the files
  debug('Writing files...');
  await map.throttled(
    mappings
  , limit
  , async ({ source, dest }) =>
    copy.file(source, dest, await fsstats.stat(source)));
}
