'use strict';

var Promise = require('bluebird')
  , _       = require('lodash')
;

module.exports.chunked = function(xs, limit, f) {
    return _.foldl(
        _.chunk(xs, limit)
      , function(acc, chunk) {
            return acc.then(function() {
              return Promise.all(_.map(chunk, f));
            });
        }
      , Promise.resolve()
    );
};

