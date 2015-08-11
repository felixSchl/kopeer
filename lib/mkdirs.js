'use strict';

var Promise = require('bluebird')
  , fs      = Promise.promisifyAll(require('fs'))
  , path    = require('path')
  , _       = require('lodash')
  , debug   = require('debug')('kopeer')
;

module.exports = function(directory) {
    return (
        _.foldl(
            _.tail(directory.split(path.sep))
          , function(acc, seg) {
                return acc.then(function(curpath) {
                    curpath = ([
                        (curpath === null)
                            ? _.head(directory.split(path.sep))
                            : curpath
                        , seg
                    ]).join(path.sep);

                    var tries = 0
                      , maxTries = 10;
                    return (function mkdir() {
                        debug(
                          'Creating directory `' + curpath + '`'
                        + ' (Try ' + (tries + 1) + '/' + maxTries + ')');
                        return fs.mkdirAsync(curpath)
                            .catch(function(e) {
                                switch (e.code) {
                                    case 'ENOENT':
                                        // Retry up to `n` times.
                                        // `maxTries` is chosen arbitrarily here.
                                        tries += 1;
                                        if (tries < maxTries) {
                                            return mkdir();
                                        } else {
                                            throw e;
                                        }
                                    case 'EEXIST':
                                        return;
                                    default:
                                        throw e;
                                }
                            })
                        ;
                    })()
                        .then(_.partial(Promise.resolve, curpath))
                    ;
                });
            }
          , Promise.resolve(null)
       )
   );
};
