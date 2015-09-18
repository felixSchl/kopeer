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

describe('kopeer', () => {

  describe('regular files and directories', () => {
    const fixtures = path.join(__dirname, 'regular-fixtures')
        , src = path.join(fixtures, 'src')
        , out = path.join(fixtures, 'out');

    before(() => {
      return rimrafAsync(out);
    });

    describe('when copying a single file', () => {
      describe('to a path that signifies a filename',() => {
        it('file is copied correctly', async function() {
          await kopeer.file(path.resolve(src, 'a'), path.resolve(out, 'a'));
          const srcFiles = await readDirFilesAsync(src, 'utf8', true)
              , outFiles = await readDirFilesAsync(out, 'utf8', true);
          assert.deepEqual(_.pick(srcFiles, 'a'), outFiles);
        });
      });

      describe('to a path that signifies a directory', function() {
        it('file is copied correctly', async () => {
          const target = path.join(out, 'dir/');
          await kopeer.file(path.resolve(src, 'a'), target);
          const srcFiles = await readDirFilesAsync(src, 'utf8', true)
              , outFiles = await readDirFilesAsync(target, 'utf8', true);
          assert.deepEqual(_.pick(srcFiles, 'a'), outFiles);
        });
      });
    });

    describe('when copying a directory of files', () => {
      before(async () => {
        await rimrafAsync(out);
        await kopeer.directory(src, out);
      });

      it('files are copied correctly', async () => {
        const srcFiles = await readDirFilesAsync(src, 'utf8', true)
            , outFiles = await readDirFilesAsync(out, 'utf8', true);
        assert.deepEqual(srcFiles, outFiles);
      });
    });

    describe('when copying a directory of files to non-existant folder', () => {

      const target = path.resolve(out, 'foo/bar/');

      before(async () => {
        await rimrafAsync(out);
        await  kopeer.directory(src, target);
      });

      it('files are copied correctly', async () => {
        const srcFiles = await readDirFilesAsync(src, 'utf8', true)
            , outFiles = await readDirFilesAsync(target, 'utf8', true);
        assert.deepEqual(srcFiles, outFiles);
      });
    });

    describe('when copying files using filter', () => {
      before(async () => {
        await rimrafAsync(out);
        await kopeer.directory(
          src
        , out
        , { filter: relpath => _.last(relpath) != 'a' });
      });

      it('files are copied correctly', async () => {
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

    describe('when writing over existing files', () => {
      it('the copy is completed successfully', async () => {
        await kopeer.directory(src, out, { clobber: false })
        await kopeer.directory(src, out, { clobber: false })
      });
    });

    describe('when using rename', () => {
      it('output files are correctly redirected', async () => {
        await kopeer.directory(src, out, {
          rename: relpath =>
            path.basename(relpath) === 'a'
              ? path.resolve(path.dirname(relpath), 'z')
              : relpath
        });
        const srcFiles = await readDirFilesAsync(src, 'utf8', true)
            , outFiles = await readDirFilesAsync(out, 'utf8', true);
        assert.deepEqual(srcFiles.a, outFiles.z);
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

  describe('when given a callback parameter', function() {
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
          assert.strictEqual(err, undefined);
          done(err);
        }
      );
    });

    it('`kopeer.file` receives a callback with `err` set on failure', function(done) {
      kopeer.file(
        path.resolve(src, 'DOESNT_EXIST')
      , path.resolve(out, 'a')
      , function(err) {
          assert.notStrictEqual(err, undefined);
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
          assert.strictEqual(err, undefined);
          done(err);
        });
    });

    it('`kopeer` receives a callback with `err` set on failure', function(done) {
      kopeer(
        path.resolve(src, 'DOESNT_EXIST')
      , path.resolve(out, 'a')
      , function(err) {
          assert.notStrictEqual(err, undefined);
          assert.strictEqual(err.code, 'ENOENT');
          done();
        });
    });

    it('`kopeer.directory` receives a callback', function(done) {
      kopeer.directory(src, out, function(err) {
        assert.strictEqual(err, undefined);
        done(err);
      });
    });

    it('`kopeer.directory` receives a callback with `err` set on failure', function(done) {
      kopeer.directory(src + 'DOESNT_EXIST', out, function(err) {
        assert.notStrictEqual(err, undefined);
        assert.strictEqual(err.code, 'ENOENT');
        done();
      });
    });
  });
});

describe('utilities', function () {
  it('map.chunked processes all items', async () => {
    let i = 0;
    await (require('../dist/map').chunked)(_.range(100), 3, n => {
      assert.equal(i, n);
      i++;
      return Bluebird.resolve();
    });
    assert.equal(i, 100);
  });
});

