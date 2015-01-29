var
    Promise = require('bluebird')
  , fs      = Promise.promisifyAll(require('fs'))
  , path    = require('path')
  , _       = require('lodash')
;

module.exports = {
    copyFolder: copyFolder
}

/*
 * Walk a directory recursively.
 *
 * `dir`    The directory to start from.
 * `filter` Function that takes the relative filepath and returns a boolean.
 *
 * `entry` is an object that with two keys:
 *     `filepath`: The fully resolved filepath
 *     `stats`:    The output of `fs.stat`
 */
function walkDirectory(dir, filter) {
    return walkDirectory_(dir, dir, filter);
}

function walkDirectory_(top, dir, filter) {
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
                return walkDirectory_(top, entry.filepath);
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

function mapChunked(xs, limit, f) {
    return Promise.all(_.foldl(
          _.chunk(xs, limit)
        , function(acc, chunk) {
            return acc.then(function() {
                return Promise.all(
                    _.map(chunk, function(val) { return f(val); })
                );
            })
          }
        , new Promise(function(resolve, reject) { resolve(); })
    ));
};

function copyFolder(directory, destination, filter) {

    console.log("Discovering files...");
    return walkDirectory(directory, filter)
        // --------------------
        // Resolve target paths
        // --------------------
        .map(function(entry) {
            return Promise.resolve({
                  sourceEntry: entry
                , targetPath:  path.resolve(
                      destination
                    , entry.relpath
                  )
            });
        })
        // ----------------------
        // Create the directories
        // ----------------------
        .then(function(mappings) {
            console.log("Creating directories");
            return mapChunked(
                  _.unique(
                    [destination].concat(
                        _.map(mappings, function(unit) {
                            return path.dirname(unit.targetPath)
                        })
                    )
                  )
                , 1
                , function(directory) {
                    return (
                        _.foldl(
                              _.tail(directory.split(path.sep))
                            , function(acc, seg) {
                                return acc.then(function(curpath) {

                                    curpath = ([
                                          curpath === null
                                            ? _.head(directory.split(path.sep))
                                            : curpath
                                        , seg
                                    ]).join(path.sep);

                                    return fs.mkdirAsync(curpath)
                                        .catch(function(e) {
                                            if (e.code != 'EEXIST') {
                                                throw e;
                                            }
                                        })
                                        .then(function() {
                                            return Promise.resolve(curpath);
                                        })
                                    ;
                                });
                              }
                            , Promise.resolve(null)
                        )
                    );
                  }
            ).then(function() { return Promise.resolve(mappings); });
        })
        // ---------------
        // Write the files
        // ---------------
        .then(function(mappings) {
            console.log("Writing files...");
            return mapChunked(
                  mappings
                , 1
                , function(unit) {
                    return fs.readFileAsync(unit.sourceEntry.filepath)
                        .then(function(contents) {
                            return fs.writeFileAsync(unit.targetPath)
                                .then(function() {
                                    return fs.chmodAsync(
                                          unit.targetPath
                                        , unit.sourceEntry.stats.mode
                                    )
                                })
                        })
                  }
            )
        })
    ;
}
