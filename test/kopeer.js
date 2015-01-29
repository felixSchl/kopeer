var assert       = require('assert')
  , fs           = require('fs')
  , path         = require('path')
  , rimraf       = require('rimraf')
  , _            = require('lodash')
  , readDirFiles = require('read-dir-files')
  , kopeer       = require('../lib/kopeer.js')
;

describe('kopeer', function () {
    describe('regular files and directories', function () {
        var fixtures = path.join(__dirname, 'regular-fixtures')
          , src = path.join(fixtures, 'src')
          , out = path.join(fixtures, 'out')
        ;

        before(function (done) {
            rimraf(out, function() {
                kopeer.copyFolder(src, out).then(function() {
                    done();
                });
            });
        });

        describe('when copying a directory of files', function () {
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
                    kopeer.copyFolder(
                          src
                        , out
                        , { filter: function(relpath) {
                            return _.last(relpath) != 'a'
                          } }
                    ).then(function() { done(); });
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

                kopeer.copyFolder(src, out, { clobber: false })
                    .then(function() {
                        return kopeer.copyFolder(src, out, { clobber: false })
                            .catch(function(e) {
                                throw e;
                            })
                            .finally(function() {
                                done();
                            })
                        ;
                    })
                ;
            });
        });

        describe('when using rename', function() {
            it('output files are correctly redirected', function(done) {
                kopeer.copyFolder(src, out, {
                    rename: function(relpath) {
                        return path.basename(relpath) === 'a'
                            ? path.resolve(path.dirname(relpath), 'z')
                            : relpath
                    }
                }).then(function() {
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

});
