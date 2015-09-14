/* globals describe, before, after, it */
/* jshint -W030 */
'use strict';

var expect = require('chai').expect;
var mockery = require('mockery');
var sinon = require('sinon');
var File = require('vinyl');
var stream = require('stream');

describe('gulp-paths-injector', function () {
    var pathsInjector = null;
    var mainBowerFilesSpy;

    before(function () {
        mockery.enable({
            warnOnUnregistered: false
        });
        mockery.registerMock('glob', function (globPattern, opts, cb) {
            var IS_JS = /\.js$/;
            var IS_CSS = /\.css$/;
            var extension = IS_JS.test(globPattern) ? '.js' : (IS_CSS.test(globPattern) ? '.css' : '');

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

    describe('Base behaviour', function () {
        it('Emit error event on stream type of file', function (done) {
            var injectorStream = pathsInjector();
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
            var injectorStream = pathsInjector();
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

        it('Multiple injects', function (done) {
            var injectorStream = pathsInjector();
            var fakeFile = new File({
                contents: new Buffer(
                    '<!-- inject:js (**/*.js) -->\n<!-- endinject -->\n' +
                    '<!-- inject:css (**/*.css) -->\n<!-- endinject -->'
                )
            });

            injectorStream.once('data', function (file) {
                handleExceptions(function () {
                    expect(file.contents.toString('utf8')).to.equal([
                        '<!-- inject:js (**/*.js) -->',
                        '<script src="files/file1.js"></script>',
                        '<script src="files/file2.js"></script>',
                        '<!-- endinject -->',
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

        it('Correct template selection - css', function (done) {
            var injectorStream = pathsInjector();
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
    });



    describe('Options handling', function () {
        it('Remove inject placeholders', function (done) {
            var injectorStream = pathsInjector({ removePlaceholder: true });
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
            var injectorStream = pathsInjector({ host: host });
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

        describe('Custom templates', function () {
            it('js templates', function (done) {
                var injectorStream = pathsInjector({
                    templates: { js: '<script  type="javascript" src="%path%" defer></script>' }
                });
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

            it('css templates', function (done) {
                var injectorStream = pathsInjector({
                    templates: { css: '<link href="%path%" />' }
                });
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
        });

        describe('Bower injecting', function () {
            it('Correct bower injection', function (done) {
                var injectorStream = pathsInjector();
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
                var injectorStream = pathsInjector();
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
                var injectorStream = pathsInjector({ mainBowerFiles: mainBowerFilesOptions });
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

function handleExceptions(test, done) {
    try {
        test();
        done();
    } catch (e) {
        done(e);
    }
}