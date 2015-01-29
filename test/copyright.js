var assert       = require('assert')
  , fs           = require('fs')
  , path         = require('path')
  , rimraf       = require('rimraf')
  , readDirFiles = require('read-dir-files')
  , copyright    = require('../lib/copyright.js')
;

describe('copyright', function () {
    describe('regular files and directories', function () {
        var fixtures = path.join(__dirname, 'regular-fixtures')
          , src = path.join(fixtures, 'src')
          , out = path.join(fixtures, 'out')
        ;

        before(function (done) {
            rimraf(out, function() {
                copyright.copyFolder(src, out).then(function() {
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
    });
});
