var assert       = require('assert')
  , fs           = require('fs')
  , path         = require('path')
  , rimraf       = require('rimraf')
  , _            = require('lodash')
  , readDirFiles = require('read-dir-files')
  , kopeer       = require('../lib/kopeer.js')
  , Promise      = require('bluebird')
;

describe('kopeer', function () {

    describe('regular files and directories', function () {
        var fixtures = path.join(__dirname, 'regular-fixtures')
          , src = path.join(fixtures, 'src')
          , out = path.join(fixtures, 'out')
        ;

        before(function (done) { rimraf(out, done); });

        describe('when copying a single file', function() {

            it('file is copied correctly', function(done) {
                kopeer.file(path.resolve(src, 'a'), path.resolve(out, 'a'))
                    .then(function() {
                        readDirFiles(src, 'utf8', true, function (srcErr, srcFiles) {
                            readDirFiles(out, 'utf8', true, function (outErr, outFiles) {
                                assert.ifError(srcErr);
                                assert.deepEqual(_.pick(srcFiles, 'a'), outFiles);
                                done();
                            });
                        });
                    })
                    .catch(function(e) { done(e); })
            });
        });

        describe('when copying a directory of files', function () {

            before(function (done) {
                rimraf(out, function() {
                    kopeer.directory(src, out)
                        .then(function()   { done();  })
                        .catch(function(e) { done(e); })
                    ;
                });
            });

            it('files are copied correctly', function (done) {
                readDirFiles(src, 'utf8', true, function (srcErr, srcFiles) {
                    readDirFiles(out, 'utf8', true, function (outErr, outFiles) {
                        assert.ifError(srcErr);
                        assert.deepEqual(srcFiles, outFiles);
                        done();
                    });
                });
            });
        });

        describe('when copying files using filter', function () {

            before(function (done) {
                rimraf(out, function () {
                    kopeer.directory(
                          src
                        , out
                        , { filter: function(relpath) {
                            return _.last(relpath) != 'a'
                          } }
                    )
                    .catch(function(e) { done(e); throw e; })
                    .then(function()   { done();  });
                });
            });

            it('files are copied correctly', function (done) {
                readDirFiles(src, 'utf8', true, function (srcErr, srcFiles) {

                    var filtered = function(xs) {
                        return _.omit(_.mapValues(xs, function(file, filename) {
                            return file instanceof Object
                                ? filtered(file)
                                : _.last(filename) == 'a' ? undefined : file
                        }), function(v) { return v === undefined; });
                    };

                    readDirFiles(out, 'utf8', function (outErr, outFiles) {
                        assert.ifError(outErr);
                        assert.deepEqual(filtered(srcFiles), outFiles);
                        done();
                    });
                });
            });
        });

        describe('when writing over existing files', function () {
            it('the copy is completed successfully', function (done) {

                kopeer.directory(src, out, { clobber: false })
                    .then(function() {
                        return kopeer.directory(src, out, { clobber: false })
                            .then(function()   { done(); })
                            .catch(function(e) { done(e); })
                        ;
                    })
                    .catch(function(e) { done(e); })
                ;
            });
        });

        describe('when using rename', function() {
            it('output files are correctly redirected', function(done) {
                kopeer.directory(src, out, {
                    rename: function(relpath) {
                        return path.basename(relpath) === 'a'
                            ? path.resolve(path.dirname(relpath), 'z')
                            : relpath
                    }
                })
                .catch(function(e) { done(e); throw e; })
                .then(function() {
                    readDirFiles(src, 'utf8', function (srcErr, srcFiles) {
                        readDirFiles(out, 'utf8', function (outErr, outFiles) {
                            assert.ifError(srcErr);
                            assert.deepEqual(srcFiles.a, outFiles.z);
                            done();
                        });
                    });
                });
            });
        });
    });

    describe('symlink handling', function () {
        var fixtures = path.join(__dirname, 'symlink-fixtures')
          , src      = path.join(fixtures, 'src')
          , out      = path.join(fixtures, 'out')
        ;

        beforeEach(function (done) {
            rimraf(out, done);
        });

        it('copies the directory pointed to by link', function(done) {
            kopeer.file(path.resolve(src, 'dir-symlink'), out, { dereference: true })
                .then(function() {
                    assert.deepEqual(fs.readdirSync(path.resolve(out)), ['dir-symlink']);
                    assert.deepEqual(fs.readdirSync(path.resolve(out, 'dir-symlink')), ['bar']);
                    done();
                })
                .catch(function(e) { done(e); })
        });

        it('copies symlinks by default', function (done) {
            kopeer.directory(src, out)
                .then(function() {
                    assert.equal(fs.readlinkSync(path.join(out, 'file-symlink')), 'foo');
                    assert.equal(fs.readlinkSync(path.join(out, 'dir-symlink')), 'dir');
                    done();
                })
                .catch(function(e) { done(e); })
            ;
        });

        it('copies file contents when dereference=true', function (done) {
            kopeer.directory(src, out, { dereference: true })
                .then(function() {
                    var fileSymlinkPath = path.join(out, 'file-symlink');
                    assert.ok(fs.lstatSync(fileSymlinkPath).isFile());
                    assert.equal(fs.readFileSync(fileSymlinkPath), 'foo contents');

                    var dirSymlinkPath = path.join(out, 'dir-symlink');
                    assert.ok(fs.lstatSync(dirSymlinkPath).isDirectory());
                    assert.deepEqual(fs.readdirSync(dirSymlinkPath), ['bar']);

                    done();
                })
                .catch(function(e) { done(e); })
            ;
        });
    });

    describe('broken symlink handling', function () {
        var fixtures = path.join(__dirname, 'broken-symlink-fixtures')
            , src      = path.join(fixtures, 'src')
            , out      = path.join(fixtures, 'out')
        ;

        beforeEach(function (done) { rimraf(out, done); });

        it('copies broken symlinks by default', function (done) {
            kopeer.directory(src, out)
                .then(function() {
                    assert.equal(fs.readlinkSync(
                          path.join(out, 'broken-symlink'))
                        , 'does-not-exist'
                    );
                    done();
                })
                .catch(function(e) { done(e); })
            ;
        });

        it('returns an error when dereference=true', function (done) {
            var error = null;
            kopeer.directory(src, out, { dereference: true })
                .catch(function(e) { error = e; })
                .then(function() {
                    assert.notEqual(error, null);
                    assert.equal(error.code, 'ENOENT');
                    done();
                });
        });
    });

});


describe('utilities', function () {

    it('map.chunked processes all items', function (done) {
        var i = 0;
        (require('../lib/map').chunked)(
              _.range(100)
            , 3
            , function(n) {
                assert.equal(i, n);
                i++;
                return Promise.resolve();
            }
        ).then(function() {
            assert.equal(i, 100);
            done();
        });
    });

});

