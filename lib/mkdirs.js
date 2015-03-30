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
                       .then(_.partial(Promise.resolve, curpath));
                   ;
               });
             }
           , Promise.resolve(null)
       )
   );
}
