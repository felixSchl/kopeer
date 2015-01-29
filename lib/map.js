var
    Promise = require('bluebird')
  , _       = require('lodash')
;

module.exports.chunked = function(xs, limit, f) {
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

