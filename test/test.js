/* globals describe, before, after, beforeEach, afterEach, it */
/* jshint -W030 */
'use strict';

var expect = require('chai').expect;
var mockery = require('mockery');
var sinon = require('sinon');
var fs = require('fs');
var path = require('path');
var File = require('vinyl');
var stream = require('stream');
var eventStream = require('event-stream');

describe('gulp-paths-injector', function () {
    var EXT = /(\.\w+)$/;
    var pathsInjector;
    var mainBowerFilesSpy;

    var globCounter = 0;
    var vinylCounter = 0;

    before(function () {
        mockery.enable({
            warnOnUnregistered: false
        });
        mockery.registerMock('glob', function (globPattern, opts, cb) {
            var extension = globPattern.match(EXT)[1];

            cb(null, [
                'files/file' + (++globCounter) + extension,
                'files/file' + (++globCounter) + extension
            ]);
        });
        mockery.registerMock('vinyl-fs', {
            src: function (filesPaths) {
                var streamArraySource = [];

                //for each glob we return two files
                filesPaths.forEach(function (filePath) {
                    var extension = filePath.match(EXT)[1];

                    for (var i = 0; i < 2; i++) {
                        var fileId = ++vinylCounter;

                        streamArraySource.push(new File({
                            path: 'files/file' + fileId + extension,
                            contents: new Buffer('data of #' + fileId + ' ' + extension + ' file')
                        }));
                    }
                });

                return eventStream.readArray(streamArraySource);
            }
        });

        var mainBowerFilesMock = function () {
            return [
                '../bower_components/jquery/jquery.js',
                '../bower_components/lodash/lodash.js'
            ];
        };

        mainBowerFilesSpy = sinon.spy(mainBowerFilesMock);
        mockery.registerMock('main-bower-files', mainBowerFilesSpy);
        pathsInjector = require('./../index');
    });

    afterEach(function () {
        globCounter = 0;
        vinylCounter = 0;
    });

    after(function () {
        mockery.disable();
    });

    describe('.inject()', function () {
        it('Emit error event on stream type of file', function (done) {
            var injector = pathsInjector();
            var injectorStream = injector.inject();
            var fakeFile = new File({ contents: new stream.Writable() });
            var errorSpy = sinon.spy();

            injectorStream.on('error', errorSpy);
            injectorStream.on('data', function () {}); //consuming data for 'end' event emitting
            injectorStream.on('end', function () {
                handleExceptions(function () {
                    expect(errorSpy.calledOnce).to.be.true;
                    expect(errorSpy.calledWithMatch({ message: 'Streams not supported' })).to.be.true;
                }, done, done);
            });
            injectorStream.write(fakeFile);
            injectorStream.end();
        });

        it('Handle base template', function (done) {
            var injector = pathsInjector();
            var injectorStream = injector.inject();
            var fakeFile = new File({ contents: new Buffer('<!-- inject:js (**/*.js) -->\n<!-- endinject -->') });

            injectorStream.once('data', function (file) {
                handleExceptions(function () {
                    expect(file.contents.toString('utf8')).to.equal([
                        '<!-- inject:js (**/*.js) -->',
                        '<script src="files/file1.js"></script>',
                        '<script src="files/file2.js"></script>',
                        '<!-- endinject -->'
                    ].join('\n'));
                }, done, done);
            });
            injectorStream.write(fakeFile);
            injectorStream.end();
        });

        it('Handle complex template', function (done) {
            var injector = pathsInjector();
            var injectorStream = injector.inject();
            var fakeFile = new File({ contents: fs.readFileSync(path.join(__dirname, './fixtures/complex.html')) });
            var templateResult = fs.readFileSync(path.join(__dirname, './fixtures/complex-injected.html'), 'utf8');

            injectorStream.once('data', function (file) {
                handleExceptions(function () {
                    expect(file.contents.toString('utf8')).to.equal(templateResult);
                }, done, done);
            });
            injectorStream.write(fakeFile);
            injectorStream.end();
        });

        describe('Correct indentation', function () {
            it('Inlined', function (done) {
                var injector = pathsInjector();
                var injectorStream = injector.inject();
                var fakeFile = new File({
                    contents: new Buffer(
                        'hello <!-- inject:js:test (**/*.js) -->\n<!-- endinject -->some test custom text'
                    )
                });

                injectorStream.once('data', function (file) {
                    handleExceptions(function () {
                        expect(file.contents.toString('utf8')).to.equal([
                            'hello <!-- inject:js:test (**/*.js) -->',
                            '<script src="files/file1.js"></script>',
                            '<script src="files/file2.js"></script>',
                            '<!-- endinject -->some test custom text'
                        ].join('\n'));
                    }, done, done);
                });
                injectorStream.write(fakeFile);
                injectorStream.end();
            });

            it('Own line', function (done) {
                var injector = pathsInjector();
                var injectorStream = injector.inject();
                var fakeFile = new File({
                    contents: new Buffer(
                        'hello\n    <!-- inject:js:test (**/*.js) -->\n    <!-- endinject -->\nsome test custom text'
                    )
                });

                injectorStream.once('data', function (file) {
                    handleExceptions(function () {
                        expect(file.contents.toString('utf8')).to.equal([
                            'hello',
                            '    <!-- inject:js:test (**/*.js) -->',
                            '    <script src="files/file1.js"></script>',
                            '    <script src="files/file2.js"></script>',
                            '    <!-- endinject -->',
                            'some test custom text'
                        ].join('\n'));
                    }, done, done);
                });
                injectorStream.write(fakeFile);
                injectorStream.end();
            });
        });

        it('Correct template selection - css', function (done) {
            var injector = pathsInjector();
            var injectorStream = injector.inject();
            var fakeFile = new File({ contents: new Buffer('<!-- inject:css (**/*.css) -->\n<!-- endinject -->') });

            injectorStream.once('data', function (file) {
                handleExceptions(function () {
                    expect(file.contents.toString('utf8')).to.equal([
                        '<!-- inject:css (**/*.css) -->',
                        '<link rel="stylesheet" href="files/file1.css">',
                        '<link rel="stylesheet" href="files/file2.css">',
                        '<!-- endinject -->'
                    ].join('\n'));
                }, done, done);
            });
            injectorStream.write(fakeFile);
            injectorStream.end();
        });

        describe('Options handling', function () {
            it('Remove inject placeholders', function (done) {
                var injector = pathsInjector({ removePlaceholder: true });
                var injectorStream = injector.inject();
                var fakeFile = new File({ contents: new Buffer('<!-- inject:js (**/*.js) -->\n\n<!-- endinject -->') });

                injectorStream.once('data', function (file) {
                    handleExceptions(function () {
                        expect(file.contents.toString('utf8')).to.equal(
                            '<script src="files/file1.js"></script>\n<script src="files/file2.js"></script>\n'
                        );

                    }, done, done);
                });
                injectorStream.write(fakeFile);
                injectorStream.end();
            });


            it('Adding host prefix', function (done) {
                var host = 'https://somecdn.com/';
                var injector = pathsInjector({ host: host });
                var injectorStream = injector.inject();
                var fakeFile = new File({ contents: new Buffer('<!-- inject:js (**/*.js) -->\n<!-- endinject -->') });

                injectorStream.once('data', function (file) {
                    handleExceptions(function () {
                        expect(file.contents.toString('utf8')).to.equal([
                            '<!-- inject:js (**/*.js) -->',
                            '<script src="' + host + 'files/file1.js"></script>',
                            '<script src="' + host + 'files/file2.js"></script>',
                            '<!-- endinject -->'
                        ].join('\n'));
                    }, done, done);
                });
                injectorStream.write(fakeFile);
                injectorStream.end();
            });

            describe('Templates', function () {
                it('custom js templates', function (done) {
                    var injector = pathsInjector({
                        templates: { js: '<script  type="javascript" src="%path%" defer></script>' }
                    });
                    var injectorStream = injector.inject();
                    var fakeFile = new File({
                        contents: new Buffer('<!-- inject:js (**/*.js) -->\n<!-- endinject -->')
                    });

                    injectorStream.once('data', function (file) {
                        handleExceptions(function () {
                            expect(file.contents.toString('utf8')).to.equal([
                                '<!-- inject:js (**/*.js) -->',
                                '<script  type="javascript" src="files/file1.js" defer></script>',
                                '<script  type="javascript" src="files/file2.js" defer></script>',
                                '<!-- endinject -->'
                            ].join('\n'));
                        }, done, done);
                    });
                    injectorStream.write(fakeFile);
                    injectorStream.end();
                });

                it('custom css templates', function (done) {
                    var injector = pathsInjector({
                        templates: { css: '<link href="%path%" />' }
                    });
                    var injectorStream = injector.inject();
                    var fakeFile = new File({
                        contents: new Buffer('<!-- inject:css (**/*.css) -->\n<!-- endinject -->')
                    });

                    injectorStream.once('data', function (file) {
                        handleExceptions(function () {
                            expect(file.contents.toString('utf8')).to.equal([
                                '<!-- inject:css (**/*.css) -->',
                                '<link href="files/file1.css" />',
                                '<link href="files/file2.css" />',
                                '<!-- endinject -->'
                            ].join('\n'));
                        }, done, done);
                    });
                    injectorStream.write(fakeFile);
                    injectorStream.end();
                });

                it('Emit error when use custom template type without setting it to options', function (done) {
                    var injector = pathsInjector();
                    var injectorStream = injector.inject();
                    var fakeFile = new File({
                        contents: new Buffer('<!-- inject:xml (**/*.xml) -->\n<!-- endinject -->')
                    });
                    var errorSpy = sinon.spy();

                    injectorStream.on('error', errorSpy);
                    injectorStream.on('data', function () {}); //consuming data for 'end' event emitting
                    injectorStream.on('end', function () {
                        handleExceptions(function () {
                            expect(errorSpy.calledOnce).to.be.true;
                            expect(errorSpy.calledWithMatch({
                                message: 'You should add template for injection type: "xml"'
                            })).to.be.true;
                        }, done, done);
                    });
                    injectorStream.write(fakeFile);
                    injectorStream.end();
                });

                it('Use custom template when set up custom template type', function (done) {
                    var injector = pathsInjector({
                        templates: {
                            jsx: '<script type="text/jsx" src="%path%"></script>'
                        }
                    });
                    var injectorStream = injector.inject();
                    var fakeFile = new File({
                        contents: new Buffer('<!-- inject:jsx (**/*.jsx) -->\n<!-- endinject -->')
                    });

                    injectorStream.once('data', function (file) {
                        handleExceptions(function () {
                            expect(file.contents.toString('utf8')).to.equal([
                                '<!-- inject:jsx (**/*.jsx) -->',
                                '<script type="text/jsx" src="files/file1.jsx"></script>',
                                '<script type="text/jsx" src="files/file2.jsx"></script>',
                                '<!-- endinject -->'
                            ].join('\n'));
                        }, done, done);
                    });
                    injectorStream.write(fakeFile);
                    injectorStream.end();
                });
            });

            describe('Bower injecting', function () {
                it('Correct bower injection', function (done) {
                    var injector = pathsInjector();
                    var injectorStream = injector.inject();
                    var fakeFile = new File({ contents: new Buffer('<!-- inject:js:bower -->\n<!-- endinject -->') });

                    injectorStream.once('data', function (file) {
                        handleExceptions(function () {
                            expect(file.contents.toString('utf8')).to.equal([
                                '<!-- inject:js:bower -->',
                                '<script src="../bower_components/jquery/jquery.js"></script>',
                                '<script src="../bower_components/lodash/lodash.js"></script>',
                                '<!-- endinject -->'
                            ].join('\n'));
                        }, done, done);
                    });
                    injectorStream.write(fakeFile);
                    injectorStream.end();
                });

                it('With bower we must not use glob pattern', function (done) {
                    var injector = pathsInjector();
                    var injectorStream = injector.inject();
                    var fakeFile = new File({
                        contents: new Buffer('<!-- inject:js:bower (../**/*.*) -->\n<!-- endinject -->')
                    });
                    var errorSpy = sinon.spy();

                    injectorStream.on('error', errorSpy);
                    injectorStream.on('data', function () {}); //consuming data for 'end' event emitting
                    injectorStream.on('end', function () {
                        handleExceptions(function () {
                            expect(errorSpy.calledOnce).to.be.true;
                            expect(errorSpy.calledWithMatch({
                                message: '"bower" is reserved name for auto injecting bower ' +
                                'dependencies, so you shouldn\'t use glob pattern with it'
                            })).to.be.true;
                        }, done, done);
                    });

                    injectorStream.write(fakeFile);
                    injectorStream.end();
                });

                it('Proxy options to plugin', function (done) {
                    var mainBowerFilesOptions = {
                        debugging: true,
                        includeDev: true
                    };
                    var injector = pathsInjector({ mainBowerFiles: mainBowerFilesOptions });
                    var injectorStream = injector.inject();
                    var fakeFile = new File({
                        contents: new Buffer('<!-- inject:js:bower -->\n<!-- endinject -->')
                    });
                    injectorStream.on('data', function () {}); //consuming data for 'end' event emitting
                    injectorStream.on('end', function () {
                        handleExceptions(function () {
                            expect(mainBowerFilesSpy.calledWith(mainBowerFilesOptions)).to.be.true;
                        }, done, done);
                    });
                    injectorStream.write(fakeFile);
                    injectorStream.end();


                });
            });
        });
    });

    describe('.src()', function () {
        it('Throw when templateType is not passed', function (done) {
            var injector = pathsInjector();
            var srcStream = injector.src();
            var fakeFile = new File({ contents: new Buffer('<!-- inject:js (**/*.js) -->\n<!-- endinject -->') });
            var errorSpy = sinon.spy();

            srcStream.on('error', errorSpy);
            srcStream.on('data', function () {}); //consuming data for 'end' event emitting
            srcStream.on('end', function () {
                handleExceptions(function () {
                    expect(errorSpy.calledOnce).to.be.true;
                    expect(errorSpy.calledWithMatch({ message: '"templateType" is mandatory parameter' })).to.be.true;
                }, done, done);
            });
            srcStream.write(fakeFile);
            srcStream.end();
        });

        it('Return vinyl-fs stream of files by glob', function (done) {
            var injector = pathsInjector();
            var srcStream = injector.src('js');
            var fakeFile = new File({ contents: new Buffer('<!-- inject:js (**/*.js) -->\n<!-- endinject -->') });
            var totalFilesCount = 2;
            var counter = 0;

            srcStream.on('data', function (file) {
                handleExceptions(function () {
                    counter++;

                    if (counter < totalFilesCount) {
                        expect(file.path).to.equal('files/file' + counter + '.js');
                        expect(file.contents.toString('utf8')).to.equal('data of #' + counter + ' .js file');
                    } else if (counter === totalFilesCount) {
                        done();
                    } else if (counter > totalFilesCount) {
                        done('In result stream count of files bigger than should to be');
                    }
                }, null, done);
            });
            srcStream.write(fakeFile);
            srcStream.end();
        });

        describe('Correct filtering inject placeholders', function () {
            it('By template type', function (done) {
                var injector = pathsInjector();
                var srcStream = injector.src('css');
                var fakeFile = new File({
                    contents: new Buffer(
                        '<!-- inject:js (**/*.js) -->\n<!-- endinject -->\n' +
                        '<!-- inject:css (**/*.css) -->\n<!-- endinject -->'
                    )
                });
                var totalFilesCount = 2;
                var counter = 0;

                srcStream.on('data', function (file) {
                    handleExceptions(function () {
                        counter++;

                        if (counter < totalFilesCount) {
                            expect(file.path).to.equal('files/file' + counter + '.css');
                            expect(file.contents.toString('utf8')).to.equal('data of #' + counter + ' .css file');
                        } else if (counter === totalFilesCount) {
                            done();
                        } else if (counter > totalFilesCount) {
                            done('In result stream count of files bigger than should to be');
                        }
                    }, null, done);
                });
                srcStream.write(fakeFile);
                srcStream.end();
            });

            it('By name of placeholder', function (done) {
                var injector = pathsInjector();
                var srcStream = injector.src('js', 'app');
                var fakeFile = new File({
                    contents: new Buffer(
                        '<!-- inject:js:app (**/*.js) -->\n<!-- endinject -->\n' +
                        '<!-- inject:js:vendors (**/*.js) -->\n<!-- endinject -->\n' +
                        '<!-- inject:js:app (**/*.js) -->\n<!-- endinject -->'
                    )
                });
                var totalFilesCount = 4;
                var counter = 0;

                srcStream.on('data', function (file) {
                    handleExceptions(function () {
                        counter++;

                        if (counter < totalFilesCount) {
                            expect(file.path).to.equal('files/file' + counter + '.js');
                            expect(file.contents.toString('utf8')).to.equal('data of #' + counter + ' .js file');
                        } else if (counter === totalFilesCount) {
                            done();
                        } else if (counter > totalFilesCount) {
                            done('In result stream count of files bigger than should to be');
                        }
                    }, null, done);
                });
                srcStream.write(fakeFile);
                srcStream.end();
            });
        });
    });

    describe('.getGlobs()', function () {
        it('Should return correct globs', function (done) {
            var injector = pathsInjector();

            injector
                .getGlobs(path.join(__dirname, './fixtures/get-globs.html'), 'js', 'app')
                .then(function (globs) {
                    expect(globs).to.deep.equal([
                        'src/**/*.module.js',
                        'src/**/*.!(module).js'
                    ]);
                    done();
                });

        });
    });
});

function handleExceptions(test, success, error) {
    try {
        test();

        if (success) {
            success();
        }
    } catch (e) {
        error(e);
    }
}