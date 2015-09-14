/* globals describe, before, after, it */
/* jshint -W030 */
'use strict';

var expect = require('chai').expect;
var mockery = require('mockery');
var sinon = require('sinon');
var File = require('vinyl');
var stream = require('stream');

//@todo use template type without settings template to options - error
//@todo save indentation

describe('gulp-paths-injector', function () {
    var pathsInjector;
    var mainBowerFilesSpy;

    before(function () {
        mockery.enable({
            warnOnUnregistered: false
        });
        mockery.registerMock('glob', function (globPattern, opts, cb) {
            var EXT = /(\.\w+)$/;
            var extension = EXT.exec(globPattern)[1];

            cb(null, [
                'files/file1' + extension,
                'files/file2' + extension
            ]);
        });

        var mainBowerFilesMock = function () {
            return [
                '../../bower_components/jquery/jquery.js',
                '../../bower_components/lodash/lodash.js'
            ];
        };

        mainBowerFilesSpy = sinon.spy(mainBowerFilesMock);
        mockery.registerMock('main-bower-files', mainBowerFilesSpy);
        pathsInjector = require('./index');
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
                }, done);
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
                }, done);
            });
            injectorStream.write(fakeFile);
            injectorStream.end();
        });

        it('Multiple inlined injects', function (done) {
            var injector = pathsInjector();
            var injectorStream = injector.inject();
            var fakeFile = new File({
                contents: new Buffer(
                    'hello <!-- inject:js:test (**/*.js) -->\n<!-- endinject -->\n' +
                    'some test custom text\n' +
                    '<!-- inject:css:test (**/*.css) -->\n<!-- endinject -->'
                )
            });

            injectorStream.once('data', function (file) {
                handleExceptions(function () {
                    expect(file.contents.toString('utf8')).to.equal([
                        'hello <!-- inject:js:test (**/*.js) -->',
                        '<script src="files/file1.js"></script>',
                        '<script src="files/file2.js"></script>',
                        '<!-- endinject -->',
                        'some test custom text',
                        '<!-- inject:css:test (**/*.css) -->',
                        '<link rel="stylesheet" href="files/file1.css">',
                        '<link rel="stylesheet" href="files/file2.css">',
                        '<!-- endinject -->'
                    ].join('\n'));
                }, done);
            });
            injectorStream.write(fakeFile);
            injectorStream.end();
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
                }, done);
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

                    }, done);
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
                    }, done);
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
                        }, done);
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
                        }, done);
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
                        }, done);
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
                        }, done);
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
                                '<script src="../../bower_components/jquery/jquery.js"></script>',
                                '<script src="../../bower_components/lodash/lodash.js"></script>',
                                '<!-- endinject -->'
                            ].join('\n'));
                        }, done);
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
                        }, done);
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
                        }, done);
                    });
                    injectorStream.write(fakeFile);
                    injectorStream.end();


                });
            });
        });
    });

    describe('.src()', function () {

    });
});

function handleExceptions(test, done) {
    try {
        test();
        done();
    } catch (e) {
        done(e);
    }
}