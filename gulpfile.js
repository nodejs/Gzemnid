'use strict';

const gulp = require('gulp');
const changed = require('gulp-changed');
const plumber = require('gulp-plumber');
const babel = require('gulp-babel');
const eslint = require('gulp-eslint');

const files = {
  libs: ['libs/**/*.js'],
  js: ['libs/**/*.js', '*.js']
};

gulp.task('libs', () =>
  gulp.src(files.libs)
    .pipe(plumber())
    .pipe(changed('build'))
    .pipe(babel({
      presets: ['stage-3']
    }))
    .pipe(gulp.dest('build'))
);

gulp.task('lint', () =>
  gulp.src(files.js)
    .pipe(eslint())
);

gulp.task('build', ['libs']);

gulp.task('default', ['lint', 'build'], () => {
  gulp.watch(files.libs, ['lint', 'libs']);
});
