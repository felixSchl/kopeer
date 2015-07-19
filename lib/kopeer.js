'use strict';

var Promise = require('bluebird')
  , fs      = Promise.promisifyAll(require('fs'))
  , path    = require('path')
  , _       = require('lodash')
  , walk    = require('./walk')
  , map     = require('./map')
  , copy    = require('./copy')
  , mkdirs  = require('./mkdirs');

module.exports = function(source, dest, options, callback) {

    if (_.isFunction(options)) {
        callback = options;
        options = {};
    }

    options = _.defaults(options || {}, { dereference: false });

    var promise = (fs[options.dereference ? 'statAsync' : 'lstatAsync'])(source)
        .then(function(stat) {
            return (stat.isDirectory() ? copyDir : copyFile)(
                source
              , dest
              , options
            );
        })
    ;

    if (callback) {
        promise
            .tap(_.ary(callback, 0))
            .catch(callback);
    }

    return promise;
};

var copyFile = module.exports.file = function(source, dest, options, callback) {

    if (_.isFunction(options)) {
        callback = options;
        options = {};
    }

    options = _.defaults(options || {}, {
        limit:       512
      , dereference: false
    });

    dest = (_.endsWith(dest, '/') || _.endsWith(dest, '\\'))
        ? dest = path.resolve(dest, path.basename(source))
        : dest
    ;

    var promise = mkdirs(path.dirname(dest))
        .then(function() {
            return ((
                fs[options.dereference ? 'statAsync' : 'lstatAsync']
                )(source)
            );
        })
        .then(function(stat) {
            return (
                stat.isSymbolicLink()
                    ? copy.link(source, dest)
                    : stat.isDirectory()
                        ? copyDir(
                            source
                          , path.resolve(dest, path.basename(source))
                          , options
                          )
                        : copy.file(source, dest, stat)
            );
        })
    ;

    if (callback) {
        promise
            .tap(_.ary(callback, 0))
            .catch(callback);
    }

    return promise;
};

var copyDir = module.exports.directory = function(directory, destination, options, callback) {

    if (_.isFunction(options)) {
        callback = options;
        options = {};
    }

    options = _.defaults(options || {}, {
        filter:      null
      , limit:       512
      , rename:      _.identity
      , dereference: false
    });

    var promise = walk.dir(
        directory
      , { filter: options.filter, followLinks: options.dereference }
    )

        // Resolve target paths
        .map(function(entry) {
            return Promise.resolve({
                sourceEntry: entry
              , targetPath:  options.rename(path.resolve(
                    destination
                  , entry.relpath
                ))
            });
        })

        // Create the directories
        .then(function(mappings) {
            return map.chunked(
                _.unique(
                    [destination].concat(
                        _.map(mappings, function(unit) {
                            return path.dirname(unit.targetPath);
                        })
                    )
                  )
              , options.limit
              , mkdirs
            ).then(function() { return Promise.resolve(mappings); });
        })

        // Write the files
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
            );
        })
    ;

    if (callback) {
        promise
            .tap(_.ary(callback, 0))
            .catch(callback);
    }

    return promise;
};
