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

var PLUGIN_NAME = 'gulp-paths-injector';
var INJECTOR_EXPRESSION = /(^[ \t]*){0,1}(<!--\s*inject:(\w+)(?::(\w+))?(?:\s*\((.+)\))?\s*-->)(?:.|\n)*?(<!--\s*endinject\s*-->)/m;
var defaultOptions = {
    removePlaceholder: false,
    host: null,
    templates: {
        js: '<script src="%path%"></script>',
        css: '<link rel="stylesheet" href="%path%">'
    },
    mainBowerFiles: {}
};

module.exports = function (options) {
    options = objectAssign({}, defaultOptions, options) || {};

    return {
        inject: injectStream.bind(null, options)
    };
};

function injectStream(options) {
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
            var contents = file.contents.toString();
            options.cwd = options.cwd || file.base;

            extractPlaceholders(contents)
                .then(resolveGlobs.bind(null, options))
                .then(injectFiles.bind(null, contents, options))
                .then(function (contents) {
                    file.contents = new Buffer(contents);
                    cb(null, file);
                },
                function (err) {
                    self.emit('error', err);
                    return cb();
                });
        }
    });
}

function extractPlaceholders(contents) {
    var placeholdersParams = [];

    function onResolved(result) {
        if (result) {
            placeholdersParams.push(result.params);
            return extractPlaceholder(result.contents, result.nextIndexStart).then(onResolved);
        } else {
            return placeholdersParams;
        }
    }

    return extractPlaceholder(contents).then(onResolved);
}

function extractPlaceholder(contents, indexStart) {
    indexStart = indexStart || 0;

    return new Promise(function (resolve, reject) {
        try {
            var matches = contents.slice(indexStart).match(INJECTOR_EXPRESSION);

            if (matches) {
                var params = {
                    name: matches[4],
                    templateType: matches[3],
                    glob: matches[5] || null,
                    indexStart: indexStart + matches.index,
                    indexEnd: indexStart + matches.index + matches[0].length,
                    injectStartComment: matches[2],
                    injectEndComment: matches[6],
                    indentation: matches[1] ? new Array(matches[1].length + 1).join(' ') : ''
                };

                return resolve({
                    params: params,
                    contents: contents,
                    nextIndexStart: indexStart + matches[0].length
                });
            }

            return resolve(null);
        } catch (e) {
            return reject(new PluginError(PLUGIN_NAME, e.message));
        }
    });
}

function resolveGlobs(options, placeholdersParams) {
    return Promise.all(placeholdersParams.map(function (placeholderParams) {
        return new Promise(function (resolve, reject) {
            try {
                if (placeholderParams.name === 'bower') {
                    if (placeholderParams.glob) {
                        return reject(new PluginError(PLUGIN_NAME, '"bower" is reserved name for auto injecting ' +
                            'bower dependencies, so you shouldn\'t use glob pattern with it'));
                    }

                    placeholderParams.files = mainBowerFiles(options.mainBowerFiles).map(function (filePath) {
                        return path.relative(options.cwd, filePath);
                    });

                    return resolve(placeholderParams);
                } else {
                    if (!placeholderParams.glob) {
                        return reject(
                            new PluginError(PLUGIN_NAME, 'You should set glob pattern for including files. Passed: ' +
                                placeholderParams.glob)
                        );
                    }

                    glob(placeholderParams.glob, { cwd: options.cwd }, function (err, files) {
                        if (err) {
                            return reject(new PluginError(PLUGIN_NAME, err.message));
                        }

                        placeholderParams.files = files;

                        return resolve(placeholderParams);
                    });
                }
            } catch (e) {
                return reject(new PluginError(PLUGIN_NAME, e.message));
            }
        });
    }));
}

function injectFiles(contents, options, placeholdersParams) {
    return new Promise(function (resolve, reject) {
        try {
            var offset = 0;
            var params;
            var replacement;

            for (var i = 0, ii = placeholdersParams.length; i < ii; i++) {
                params = placeholdersParams[i];
                if (!options.templates[params.templateType]) {
                    return reject(new PluginError(PLUGIN_NAME, 'You should add template for injection type: "' +
                        params.templateType + '"'));
                }

                replacement = buildTemplate(params, options);
                params.indexStart += offset;
                params.indexEnd += offset;
                contents = contents.slice(0, params.indexStart) + replacement + contents.slice(params.indexEnd);
                offset += replacement.length - (params.indexEnd - params.indexStart);
            }

            return resolve(contents);
        } catch (e) {
            return reject(new PluginError(PLUGIN_NAME, e.message));
        }
    });
}

function buildTemplate(placeholderParams, options) {
    var template = options.templates[placeholderParams.templateType];
    var replacement = '';
    var indentation = os.EOL + placeholderParams.indentation;

    if (!options.removePlaceholder)            {
        replacement += placeholderParams.injectStartComment + indentation;
    }

    replacement += placeholderParams.files.map(function (filename) {
            if (options.host) {
                filename = url.resolve(options.host, filename);
            }

            return template.replace('%path%', filename);
        }).join(indentation) + indentation;

    if (!options.removePlaceholder) {
        replacement += placeholderParams.injectEndComment;
    }

    return replacement;
}
