/* eslint no-process-env:0 */
const fs = require('fs');
const gulp = require('gulp');
const sourcemaps = require('gulp-sourcemaps');
const eslint = require('gulp-eslint');
const webpack = require('webpack-stream');
const WebpackErrorNotificationPlugin = require('webpack-error-notification');
const nodeModules = {};

fs.readdirSync('node_modules').filter(function (x) {
  return ['.bin'].indexOf(x) === -1;
}).forEach(function (mod) {
  nodeModules[mod] = 'commonjs ' + mod;
});

gulp.task ('webpack', function () {
  const stream = gulp.src('solution.es6').
    pipe(eslint()).
    pipe(eslint.format()).
    pipe(sourcemaps.init()).
    pipe(webpack({
      output: {
        filename: 'solution.js',
        sourceMapFilename: 'solution.map'
      },
      devtool: 'source-map',
      module: {
        plugins: [
          new WebpackErrorNotificationPlugin()
        ],
        loaders: [
            {
              test: /\.es6?$/,
              exclude: /(node_modules|bower_components)/,
              loader: 'babel',
              query: {
                presets: ['es2015']
              }
            }
        ]
      }
    })).
    pipe(sourcemaps.write({ includeContent: true })).
    pipe(gulp.dest('./'));
  return stream;
});

gulp.task('watch', ['webpack'], function () {
  gulp.watch(['solution.es6'], ['webpack']);
});

gulp.task('default', ['webpack']);
