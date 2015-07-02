'use strict';

var
    Promise = require('bluebird')
  , fs      = Promise.promisifyAll(require('fs'))
  , path    = require('path')
  , _       = require('lodash')
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

                    var tries = 0;
                    return (function mkdir() {
                        return fs.mkdirAsync(curpath)
                            .catch(function(e) {
                                switch (e.code) {
                                    case 'ENOENT':
                                        // Retry up to `n` times.
                                        // `10` is chosen arbitraryly here.
                                        tries += 1;
                                        if (tries < 10) {
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
