'use strict';

var
    Promise = require('bluebird')
  , _       = require('lodash')
;

module.exports.chunked = function(xs, limit, f) {
    return Promise.all(_.foldl(
        _.chunk(xs, limit)
      , function(acc, chunk) {
            return acc.then(
                _.partial(
                    Promise.all
                  , _.map(chunk, f)
                )
            );
        }
      , Promise.resolve()
    ));
};

