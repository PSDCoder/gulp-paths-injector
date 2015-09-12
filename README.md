Inspired by [gulp-include-source](https://github.com/gil/gulp-include-source) but this module more extensible and fully asynchronous!

# Usage

```html
    <!doctype html>
    <html lang="en" ng-app="appName">
    <head>
        <meta charset="UTF-8">
        <title>AppName</title>
        <!-- inject:css (assets/**/*.css) -->
    
        <!-- endinject -->
    </head>
    <body>
        <!-- inject:js:bower -->
    
        <!-- endinject -->
    
        <!-- inject:js (src/**/*.module.js) -->
    
        <!-- endinject -->
        <!-- inject:js (src/**/*.!(module).js) -->
    
        <!-- endinject -->
    </body>
    </html>
```

this template may be handled with this gulp config:


```js
    var injector = require('gulp-injector');
    var plumber = require('gulp-plumber');
       
    gulp.task('inject', function () {
        gulp.src('index.html')
            .pipe(plumber())
            .pipe(injector({
                cwd: 'some/path', //by default dirname of file
                removePlaceholder: false, //by default false
                host: null, // you can set host and paths will be prefixed with it
                templates: {
                  js: '<script src="%path%"></script>',
                  css: '<link rel="stylesheet" href="%path%">'
                },
                mainBowerFiles: {} // config for main-bower-files plugin
            }))
            .pipe(gulp.dest('./index-injected.html'));
    });
```

and index.html will be transformed to:

```html
    <!doctype html>
    <html lang="en" ng-app="appName">
    <head>
        <meta charset="UTF-8">
        <title>AppName</title>
        <!-- inject:css (assets/**/*.css) -->
        <link rel="stylesheet" href="assets/styles/test.css">
        <link rel="stylesheet" href="assets/styles/test2.css">
        <!-- endinject -->
    </head>
    <body>
        <!-- inject:js:bower -->
        <script src="bower_components/angular/angular.js"></script>
        <script src="bower_components/jquery/dist/jquery.js"></script>
        <script src="bower_components/lodash/lodash.js"></script>
        <!-- endinject -->
    
        <!-- inject:js (src/**/*.module.js) -->
        <script src="/src/appName/hitrock.module.js"></script>
        <!-- endinject -->
        <!-- inject:js (src/**/*.!(module).js) -->
        <script src="/src/appName/services/some.service.js"></script>
        <!-- endinject -->
    </body>
    </html>
```