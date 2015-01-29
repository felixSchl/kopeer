var
    Promise = require('bluebird')
  , fs      = Promise.promisifyAll(require('fs'))
  , path    = require('path')
;

module.exports.dir = function(top, filter) {
    return _walkDirectory(top, top, filter);
}

function _walkDirectory(top, dir, filter) {
    return fs.readdirAsync(dir)
        .map(function(filename) {
            return Promise.resolve(
                path.resolve(dir, filename)
            );
        })
        .filter(function(fullpath) {
            return Promise.resolve(
                filter
                    ? filter(path.relative(top, fullpath))
                    : true
            )
        })
        .map(function(filepath) {
            return fs.lstatAsync(filepath)
                .then(function(stats) {
                    return Promise.resolve({
                          filepath: filepath
                        , relpath:  path.normalize(path.relative(top, filepath))
                        , stats:    stats
                    })
                });
        })
        .map(function(entry) {
            if (entry.stats.isDirectory()) {
                return _walkDirectory(top, entry.filepath);
            }
            else {
                return entry;
            }
        })
        .reduce(function(a, b) {
            return a.concat(b);
        }, [])
    ;
}

