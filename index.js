'use strict';

var through = require('through2');
var gutil = require('gulp-util');
var glob = require('glob');
var os = require('os');
var mainBowerFiles = require('main-bower-files');
var path = require('path');
var url = require('url');
var objectAssign = require('object-assign');
var Promise = require('es6-promise-polyfill').Promise;
var PluginError = gutil.PluginError;

var PLUGIN_NAME = 'gulp-injector';
var INJECTOR_EXPRESSION = /^([^\n]*)(<!--\s*inject:(\w+)(?::(\w+))?(?:\s*\((.+)\))?\s*-->)(?:.|\n)*?(<!--\s*endinject\s*-->)/gm;
var defaultOptions = {
    removePlaceholder: false,
    host: null,
    templates: {
        js: '<script src="%path%"></script>',
        css: '<link rel="stylesheet" href="%path%">'
    },
    mainBowerFiles: {}
};

module.exports = gulpInjector;

function gulpInjector(options) {
    return {
        inject: inject.bind(null, options)
    };
}

function inject(options) {
    options = objectAssign({}, defaultOptions, options) || {};

    return through.obj(function (file, enc, cb) {
        var self = this;

        if (file.isNull()) {
            return cb(null, file);
        }

        if (file.isStream()) {
            self.emit('error', new PluginError(PLUGIN_NAME, 'Streams not supported'));
            return cb();
        }

        if (file.isBuffer()) {
            replacePlaceholders(file, options)
                .then(function (contents) {
                    file.contents = contents;
                    cb(null, file);
                },
                function (err) {
                    self.emit('error', err);
                    return cb();
                });
        }
    });
}

function replacePlaceholders(file, options) {
    var cwd = options.cwd || path.dirname(file.path);

    function onResolved(result) {
        if (result.done) {
            return new Buffer(result.value);
        } else {
            return replaceOnePlaceholder(result.value, cwd, options).then(onResolved);
        }
    }

    return replaceOnePlaceholder(file.contents.toString(), cwd, options)
        .then(onResolved);
}

function replaceOnePlaceholder(contents, cwd, options) {
    return new Promise(function (resolve, reject) {
        var matches = INJECTOR_EXPRESSION.exec(contents);

        if (matches) {
            var templateType = matches[3];
            var params = {
                name: matches[4],
                template: null,
                globPattern: matches[5] || null,
                indexStart: matches.index,
                indexInnerStart: matches.index +
                (!options.removePlaceholder ? (matches[1].length + matches[2].length) : 0),
                indexEnd: matches.index + matches[0].length,
                indexInnerEnd: matches.index + matches[0].length -
                (!options.removePlaceholder ? matches[6].length : 0),
                indentation: new Array(matches[1].length + 1).join(' ')
            };

            if (!options.templates[templateType]) {
                return reject(
                    new PluginError(PLUGIN_NAME, 'You should add template for injection type: "' + templateType + '"')
                );
            } else {
                params.template = options.templates[templateType];
            }

            if (params.name === 'bower') {
                if (params.globPattern) {
                    return reject(new PluginError(PLUGIN_NAME, '"bower" is reserved name for auto injecting bower ' +
                        'dependencies, so you shouldn\'t use glob pattern with it'));
                }

                var files = mainBowerFiles(options.mainBowerFiles).map(function (filePath) {
                    return path.relative(cwd, filePath);
                });

                return injectFiles(contents, files, params, options).then(resolve);
            } else {
                if (!params.globPattern) {
                    return reject(
                        new PluginError(PLUGIN_NAME, 'You should set glob pattern for including files. Passed: ' +
                            params.globPattern)
                    );
                }

                glob(params.globPattern, {cwd: cwd}, function (err, matchedFiles) {
                    if (err) {
                        return reject(new PluginError(PLUGIN_NAME, err.message));
                    }

                    return injectFiles(contents, matchedFiles, params, options).then(resolve);
                });
            }
        } else {
            resolve({
                value: contents,
                done: true
            });
        }
    });
}

function injectFiles(contents, files, params, options) {
    return new Promise(function (resolve, reject) {
        var indentation = os.EOL + params.indentation;
        var injectionTemplate = indentation +
            files.map(function (filename) {
                if (options.host) {
                    filename = url.resolve(options.host, filename);
                }

                return params.template.replace('%path%', filename);
            }).join(indentation) +
            indentation;

        return resolve({
            value: contents.substring(0, params.indexInnerStart) + injectionTemplate +
            contents.substring(params.indexInnerEnd),
            done: false
        });
    });
}

