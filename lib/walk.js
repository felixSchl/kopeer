var
    Promise = require('bluebird')
  , fs      = Promise.promisifyAll(require('fs'))
  , path    = require('path')
  , _       = require('lodash')
;

module.exports.dir = function(top, options) {

    options = _.defaults(options || {}, {
          filter: function(relpath) { return true; }
    });

    return _walkDirectory(top, top, options.filter);
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
                .then(function(stat) {
                    return Promise.resolve({
                          filepath: filepath
                        , relpath:  path.normalize(path.relative(top, filepath))
                        , stats:    stat
                    })
                })
            ;
        })
        .map(function(entry) {
            if (entry.stats.isDirectory()) {
                return _walkDirectory(top, entry.filepath, filter);
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

