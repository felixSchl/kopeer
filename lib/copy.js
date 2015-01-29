var
    Promise = require('bluebird')
  , fs      = Promise.promisifyAll(require('fs'))
  , path    = require('path')
  , _       = require('lodash')
;

const modern = /^v0\.1\d\.\d+/.test(process.version);

module.exports.file = function(source, dest, stat) {

    return new Promise(function(resolve, reject) {

        var readStream = fs.createReadStream(source)
          , writeStream = fs.createWriteStream(dest, { mode: stat.mode })
        ;

        writeStream.on('open', function() {
            readStream.pipe(writeStream);
        });

        writeStream.on('error', function(error) {
            reject(error);
        });

        readStream.on('error', function(error) {
            reject(error);
        });

        writeStream.on(modern ? 'finish' : 'close', function() {
            resolve(
                fs.chmodAsync(
                      dest
                    , stat.mode
                )
                .then(function() {
                    return fs.utimesAsync(dest, stat.atime, stat.mtime);
                })
            )
        });
    });
};

module.exports.link = function(source, dest) {
    return fs.readlinkAsync(source)
        .then(function(link) {
            return fs.symlinkAsync(link, dest)
        })
};
