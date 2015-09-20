import assert from 'assert';
import os from 'os';
import fs from 'fs';
import path from 'path';
import rimraf from 'rimraf';
import _ from 'lodash';
import readDirFiles from 'read-dir-files';
import kopeer from '..';
import Bluebird from 'bluebird';

const rimrafAsync = Bluebird.promisify(rimraf);
const readDirFilesAsync = Bluebird.promisify(readDirFiles);
Bluebird.promisifyAll(fs);

// Kopeer internal
const mkdirs = require('../dist/mkdirs')
    , walk = require('../dist/walk')
    , Worker = require('../dist/Worker')
    , map = require('../dist/map');

describe('Worker', () => {
  it('should emit the `completed` event', async () => {
    const worker = new Worker(
      w => Bluebird.resolve(w).delay(10)
    , { limit: 1 });
    await new Bluebird(resolve => {
      worker.on('completed', resolve);
      worker.queue(1);
      worker.queue(2);
    });
  });

  it('should emit the `next` event', async () => {
    const worker = new Worker(
      w => Bluebird.resolve(w).delay(10)
    , { limit: 1 });
    await new Bluebird(resolve => {
      worker.on('next', resolve);
      worker.queue(1);
    });
  });

  it('should recover failure', async () => {
    let hasThrown = false;
    const worker = new Worker(
      w => {
        if (hasThrown) {
          return Bluebird.resolve(w);
        } else {
          hasThrown = true;
          return Bluebird.reject({ code: 'EMFILE' });
        }
      }
    , { limit: 1
      , recover: (e, retry) => e.code === 'EMFILE' ? retry() : null
      });
    await new Bluebird(resolve => {
      worker.on('completed', resolve);
      worker.queue(1);
    });
  });
});

describe('kopeer', () => {

  describe('regular files and directories', () => {
    const fixtures = path.join(__dirname, 'regular-fixtures')
        , src = path.join(fixtures, 'src')
        , out = path.join(fixtures, 'out');

    before(() => rimrafAsync(out));

    describe('copying a single file', () => {
      describe('to a path that signifies a filename',() => {
        it('file is copied correctly', async function() {
          await kopeer.file(path.resolve(src, 'a'), path.resolve(out, 'a'));
          assert.deepEqual(
            _.pick((await readDirFilesAsync(src, 'utf8', true)), 'a')
          , await readDirFilesAsync(out, 'utf8', true));
        });
      });

      describe('to a path that signifies a directory', function() {
        it('file is copied correctly', async () => {
          const target = path.join(out, 'dir/');
          await kopeer.file(path.resolve(src, 'a'), target);
          assert.deepEqual(
            _.pick((await readDirFilesAsync(src, 'utf8', true)), 'a')
          , await readDirFilesAsync(target, 'utf8', true));
        });
      });
    });

    describe('copying a directory of files', () => {
      beforeEach(() => rimrafAsync(out));

      it('files are copied correctly', async () => {
        await kopeer.directory(src, out);
        assert.deepEqual(
          await readDirFilesAsync(src, 'utf8', true)
        , await readDirFilesAsync(out, 'utf8', true));
      });
    });

    describe('copying a directory of files to non-existant folder', () => {
      beforeEach(() => rimrafAsync(out));

      it('files are copied correctly', async () => {
        const target = path.resolve(out, 'foo/bar/');
        await  kopeer.directory(src, target);
        assert.deepEqual(
          await readDirFilesAsync(src, 'utf8', true)
        , await readDirFilesAsync(target, 'utf8', true));
      });
    });

    describe('copying files using filter', () => {
      beforeEach(() => rimrafAsync(out));

      it('files are copied correctly', async () => {
        await kopeer.directory(
          src
        , out
        , { filter: relpath => _.last(relpath) != 'a' });
        const srcFiles = await readDirFilesAsync(src, 'utf8', true)
            , outFiles = await readDirFilesAsync(out, 'utf8', true)
            , filtered = xs =>
                _.omit(_.mapValues(xs, (file, filename) =>
                  file instanceof Object
                    ? filtered(file)
                    : _.last(filename) == 'a' ? undefined : file)
                , v => v === undefined);
          assert.deepEqual(filtered(srcFiles), outFiles);
      });

      it('files are copied correctly', async () => {
        await kopeer.directory(
          src
        , out
        , { ignore: [ '**/*a' ] });
        const srcFiles = await readDirFilesAsync(src, 'utf8', true)
            , outFiles = await readDirFilesAsync(out, 'utf8', true)
            , filtered = xs =>
                _.omit(_.mapValues(xs, (file, filename) =>
                  file instanceof Object
                    ? filtered(file)
                    : _.last(filename) == 'a' ? undefined : file)
                , v => v === undefined);
          assert.deepEqual(filtered(srcFiles), outFiles);
      });
    });

    describe('writing over existing files', () => {
      it('the copy is completed successfully', async () => {
        await kopeer.directory(src, out, { clobber: false })
        await kopeer.directory(src, out, { clobber: false })
      });
    });

    describe('using rename', () => {
      it('output files are correctly redirected', async () => {
        await kopeer.directory(src, out, {
          rename: relpath =>
            path.basename(relpath) === 'a'
              ? path.resolve(path.dirname(relpath), 'z')
              : relpath
        });
        assert.deepEqual(
          (await readDirFilesAsync(src, 'utf8', true)).a
        , (await readDirFilesAsync(out, 'utf8', true)).z);
      });
    });
  });

  describe('symlink handling', function () {
    const fixtures = path.join(__dirname, 'symlink-fixtures')
        , src = path.join(fixtures, 'src')
        , out = path.join(fixtures, 'out')

    beforeEach(async () => {
      await Bluebird.all([
        rimrafAsync(out)
      , rimrafAsync(path.resolve(src, 'dir-symlink'))
      , rimrafAsync(path.resolve(src, 'file-symlink'))]);
      await Bluebird.all([
        fs.symlinkAsync(
          path.resolve(src, 'dir')
        , path.resolve(src, 'dir-symlink')
        , 'dir')
      , fs.symlinkAsync(
          path.resolve(src, 'foo')
        , path.resolve(src, 'file-symlink')
        , 'file')]);
    });

    it('copies the directory pointed to by link', async () => {
      await kopeer.directory(
        path.resolve(src, 'dir-symlink')
      , out
      , { dereference: true });

      assert.deepEqual(
        fs.readdirSync(path.resolve(out))
      , ['bar']);
    });

    it('copies symlinks by default', async () => {
      await kopeer.directory(src, out)
      assert.equal(
        fs.readlinkSync(path.join(out, 'file-symlink'))
      , path.resolve(src, 'foo'));
      assert.equal(
        fs.readlinkSync(path.join(out, 'dir-symlink'))
      , path.resolve(src, 'dir'));
    });

    it('copies file contents when dereference=true', async () => {
      await kopeer.directory(src, out, { dereference: true });

      const fileSymlinkPath = path.join(out, 'file-symlink')
          , dirSymlinkPath = path.join(out, 'dir-symlink');

      assert.ok(fs.lstatSync(fileSymlinkPath).isFile());
      assert.equal(
        fs.readFileSync(fileSymlinkPath).toString('utf8')
      , 'foo contents');
      assert.ok(fs.lstatSync(dirSymlinkPath).isDirectory());
      assert.deepEqual(fs.readdirSync(dirSymlinkPath), ['bar']);
    });
  });

  if (os.platform() !== 'win32') {
    describe('broken symlink handling', function () {
      const fixtures = path.join(__dirname, 'broken-symlink-fixtures')
          , src = path.join(fixtures, 'src')
          , out = path.join(fixtures, 'out');

      beforeEach(async () => {
        await rimrafAsync(out);
      });

      it('copies broken symlinks by default', async () => {
        await kopeer.directory(src, out);
        assert.equal(fs.readlinkSync(
          path.join(out, 'broken-symlink'))
        , 'does-not-exist');
      });

      it('returns an error when dereference=true', async () => {
        try {
          await kopeer.directory(src, out, { dereference: true })
          assert.false();
        } catch(e) {
          assert.equal(e.code, 'ENOENT');
        }
      });
    });
  }

  describe('given a callback parameter', function() {
    const fixtures = path.join(__dirname, 'regular-fixtures')
        , src = path.join(fixtures, 'src')
        , out = path.join(fixtures, 'out');

    beforeEach(async () => {
      await rimrafAsync(out);
    });

    it('`kopeer.file` receives a callback', function(done) {
      kopeer.file(
        path.resolve(src, 'a')
      , path.resolve(out, 'a')
      , function(err) {
          assert.strictEqual(err, null);
          done(err);
        }
      );
    });

    it('`kopeer.file` receives a callback with `err` set on failure', function(done) {
      kopeer.file(
        path.resolve(src, 'DOESNT_EXIST')
      , path.resolve(out, 'a')
      , function(err) {
          assert.notStrictEqual(err, null);
          assert.strictEqual(err.code, 'ENOENT');
          done();
        }
      );
    });

    it('`kopeer` receives a callback', function(done) {
      kopeer(
        path.resolve(src, 'a')
      , path.resolve(out, 'a')
      , function(err) {
          assert.strictEqual(err, null);
          done(err);
        });
    });

    it('`kopeer` receives a callback with `err` set on failure', function(done) {
      kopeer(
        path.resolve(src, 'DOESNT_EXIST')
      , path.resolve(out, 'a')
      , function(err) {
          assert.notStrictEqual(err, null);
          assert.strictEqual(err.code, 'ENOENT');
          done();
        });
    });

    it('`kopeer.directory` receives a callback', function(done) {
      kopeer.directory(src, out, function(err) {
        assert.strictEqual(err, null);
        done(err);
      });
    });

    it('`kopeer.directory` receives a callback with `err` set on failure', function(done) {
      kopeer.directory(src + 'DOESNT_EXIST', out, function(err) {
        assert.notStrictEqual(err, null);
        assert.strictEqual(err.code, 'ENOENT');
        done();
      });
    });
  });
});

describe('utilities', function () {
  it('map.chunked processes all items', async () => {
    let i = 0;
    await map.chunked(_.range(100), 3, n => {
      assert.equal(i, n);
      i++;
      return Bluebird.resolve();
    });
    assert.equal(i, 100);
  });

  it('map.throttledOrd returns in order', async () => {
    assert.deepEqual(
      _.range(100)
    , await map.throttledOrd(_.range(100), 3, _.identity));
  });

  it('map.throttled collects all items', async () => {
    const res = await map.throttled(_.range(100), 3, _.identity);
    _.each(_.range(100), i => assert(_.contains(res, i)));
  });

  it('map.throttled collects all items', async () => {
    let hasThrown = false;
    const res = await map.throttled(_.range(100), 3, n => {
      if (n === 1 && !hasThrown) {
        hasThrown = true;
        return Bluebird.reject({ code: 'EMFILE' })
      } else {
        return n
      }
    });
    _.each(_.range(100), i => assert(_.contains(res, i)));
  });
});

