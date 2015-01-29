var
    Promise = require('bluebird')
  , fs      = Promise.promisifyAll(require('fs'))
  , path    = require('path')
  , _       = require('lodash')
  , walk    = require('./walk')
  , map     = require('./map')
;

module.exports = {
    copyFolder: copyFolder
}

function copyFolder(directory, destination, options) {

    options = _.defaults(options || {}, {
          filter: null
        , limit:  512
    });

    console.log("Discovering files...");
    return walk.dir(directory, options.filter)
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
            console.log("Creating directories...");
            return map.chunked(
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
            return map.chunked(
                  mappings
                , options.limit
                , function(unit) {
                    return fs.readFileAsync(unit.sourceEntry.filepath)
                        .then(function(contents) {
                            return fs.writeFileAsync(unit.targetPath, contents)
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
