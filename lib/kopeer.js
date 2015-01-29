var
    Promise = require('bluebird')
  , fs      = Promise.promisifyAll(require('fs'))
  , path    = require('path')
  , _       = require('lodash')
  , walk    = require('./walk')
  , map     = require('./map')
  , copy    = require('./copy')
  , mkdirs  = require('./mkdirs')
;

module.exports = {
    copyFolder: copyFolder
}

function copyFolder(directory, destination, options) {

    options = _.defaults(options || {}, {
          filter:      null
        , limit:       512
        , rename:      function(relpath) { return relpath; }
        , dereference: false
    });

    return walk.dir(
          directory
        , { filter: options.filter, followLinks: options.dereference  }
    )

        // --------------------
        // Resolve target paths
        // --------------------
        .map(function(entry) {
            return Promise.resolve({
                  sourceEntry: entry
                , targetPath:  options.rename(path.resolve(
                      destination
                    , entry.relpath
                  ))
            });
        })

        // ----------------------
        // Create the directories
        // ----------------------
        .then(function(mappings) {
            return map.chunked(
                  _.unique(
                    [destination].concat(
                        _.map(mappings, function(unit) {
                            return path.dirname(unit.targetPath)
                        })
                    )
                  )
                , options.limit
                , mkdirs
            ).then(function() { return Promise.resolve(mappings); });
        })

        // ---------------
        // Write the files
        // ---------------
        .then(function(mappings) {
            return map.chunked(
                  mappings
                , options.limit
                , function(unit) {
                    return (
                        unit.sourceEntry.stats.isSymbolicLink()
                            ? copy.link
                            : copy.file
                    )(
                          unit.sourceEntry.filepath
                        , unit.targetPath
                        , unit.sourceEntry.stats
                    );
                }
            )
        })
    ;
}
