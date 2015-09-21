'use strict';

var gulp = require('gulp')
  , sourcemaps = require('gulp-sourcemaps')
  , babel = require('gulp-babel');

gulp.task('make', function () {
  return gulp.src(['src/**/*.js'])
    .pipe(sourcemaps.init())
    .pipe(babel({ optional: [ 'bluebirdCoroutines' ] }))
    .pipe(babel({ optional: [ 'runtime' ] }))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('dist'));
});

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
