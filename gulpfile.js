'use strict';

var gulp = require('gulp')
  , sourcemaps = require('gulp-sourcemaps')
  , git = require('gulp-git')
  , bump = require('gulp-bump')
  , filter = require('gulp-filter')
  , tag = require('gulp-tag-version')
  , babel = require('gulp-babel');

gulp.task('make', function () {
  return gulp.src(['src/**/*.js'])
    .pipe(sourcemaps.init())
    .pipe(babel({ optional: [ 'bluebirdCoroutines' ] }))
    .pipe(babel({ optional: [ 'runtime' ] }))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('dist'));
});

function inc(importance) {
  return function() {
    return gulp.src(['./package.json', './bower.json'])
        .pipe(bump({ type: importance }))
        .pipe(gulp.dest('./'))
        .pipe(git.commit('Bump version'))
        .pipe(filter('package.json'))
        .pipe(tag());
  };
}

gulp.task('patch',      inc('patch'));
gulp.task('feature',    inc('minor'));
gulp.task('prerelease', inc('prerelease'));
gulp.task('release',    inc('major'));

gulp.task('make:resilient', function () {
  return gulp.src(['src/**/*.js'])
    .pipe(sourcemaps.init())
    .pipe(babel({ optional: [ 'bluebirdCoroutines' ] }))
    .pipe(babel({ optional: [ 'runtime' ] }))
    .on('error', function(error) {
      console.error(error.stack);
      this.emit('end');
    })
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('dist'));
});

gulp.task('default', ['make']);

gulp.task('watch', ['make'], function () {
  gulp.watch('./src/**/*', ['make:resilient']);
});
