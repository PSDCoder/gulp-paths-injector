[![Build Status](https://travis-ci.org/PSDCoder/gulp-paths-injector.svg?branch=v0.1.2)](https://travis-ci.org/PSDCoder/gulp-paths-injector)
[![npm version](https://badge.fury.io/js/gulp-paths-injector.svg)](http://badge.fury.io/js/gulp-paths-injector)

Gulp plugin for including paths to scripts, bower scripts and styles by passed glob into HTML automatically.  
Inspired by [gulp-include-source](https://github.com/gil/gulp-include-source), but this module more extensible and asynchronous (except bower injecting - it's doing by main-bower-files plugin. Maybe you want do this asynchronous too? Create pull request for it)!

# Install

Install with [npm](https://npmjs.org/package/gulp-paths-injector)

```
npm install gulp-paths-injector --save-dev
```

# Usage examples

* [Injecting paths to template](/docs/inject.md)
* [Get files by globs in inject placeholders](/docs/src.md)
* [Get globs list from template](/docs/getGlobs.md)

# API

## injector(options)

Returns instance of injector.

### options.cwd

Type: `String`  
Default: `gulp.src(file)`

Base directory from where the plugin will search for source files.

### options.removePlaceholder

Type: `Boolean`  
Default: `false`

Remove `<!-- inject:js:bower --><!-- endinject -->` placeholders in result HTML or not.

### options.host

Type: `String`  
Default: `''`

You can set host prefix for files by passing this option. For example you can you it for set CDN hosts.

### options.templates

Type: `Object`  
Default: 
```
{
    js: '<script src="%path%"></script>',
    css: '<link rel="stylesheet" href="%path%">'
}
```

You can set own templates for each type, for including path use `%path` placeholder.

### options.mainBowerFiles

Type: `Object`  
Default: `{}`

If you want pass custom options to main-bower-files plugin you can use this option.

## injector.inject()

Return type: `Stream`  
Resolve all injections in passed template and return handled template.

## injector.src(templateType, name)

Return type: `Stream`  
Returns stream of files matched to globs filtered by passed `templateType` and `name` params

## injector.getGlobs(pathToTemplate, templateType, name)

Return type: `Promise`  


# Contributing

* Code must follow [.jscsrc](http://jscs.info/) and [.jshintrc](http://jshint.com/docs/) rules. Setup your code editor for use it code style rules.
* You should test code: `npm test` or `npm run dev` for development mode (run tests with watchers). If you want add feature - you must add tests for it.

# License

MIT © [Pavel Grinchenko](http://webdao.net)