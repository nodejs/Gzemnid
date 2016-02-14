'use strict';

var gulp = require('gulp');
var changed = require('gulp-changed');
var plumber = require('gulp-plumber');
var babel = require('gulp-babel');

var files = {
    libs: 'libs/**/*.js'
};

var babelOptions = {
    presets: ['es2015-node5', 'stage-3']
};

gulp.task('libs', function () {
    gulp.src(files.libs)
        .pipe(plumber())
        .pipe(changed('build'))
        .pipe(babel(babelOptions))
        .pipe(babel())
        .pipe(gulp.dest('build'));
});

gulp.task('build', ['libs']);

gulp.task('default', ['build'], function() {
    gulp.watch(files.libs, ['libs']);
});
