# injector.inject()

This method search inject placeholders in template and inject into it/replace it formed paths to assets.  
Placeholder format: `<!-- inject:templateType[:placeholderName] (glob) --><!-- endinject-->`

## Base example:

`template.html`
```html
<!doctype html>
<html>
<head>
    <!-- inject:css (assets/**/*.css) -->

    <!-- endinject -->
</head>
<body>
    <!-- inject:js (src/**/*.module.js) -->
    <!-- endinject -->
    
    <!-- inject:js (src/**/*.!(module).js) -->
    <!-- endinject -->
</body>
</html>
```

`gulpfile.js:`
```js
var pathsInjector = require('gulp-paths-injector');
var plumber = require('gulp-plumber');
   
gulp.task('inject', function () {
    var injector = pathsInjector({ host: 'http://somecdn.net' });

    gulp.src('template.html')
        .pipe(plumber())
        .pipe(injector.inject())
        .pipe(gulp.dest('./result.html'));
});
```

and in `result.html` you can find injected dependencies paths:

`result.html`
```html
<!doctype html>
<html>
<head>
    <!-- inject:css (assets/**/*.css) -->
    <link rel="stylesheet" href="assets/styles/test.css">
    <link rel="stylesheet" href="assets/styles/test2.css">
    <!-- endinject -->
</head>
<body>
    <!-- inject:js (src/**/*.module.js) -->
    <script src="/src/app.module.js"></script>
    <!-- endinject -->
    
    <!-- inject:js (src/**/*.!(module).js) -->
    <script src="/src/api.service.js"></script>
    <!-- endinject -->
</body>
</html>
```

## Injecting bower dependencies:

For inject `bower` dependencies you should set `templateType` to `js`, and `placeholderName` to `bower`. You no need set glob.
Bower dependencies list will received from [main-bower-files](https://github.com/ck86/main-bower-files) plugin.

`template.html`
```html
<!doctype html>
<html>
<head></head>
<body>
    <!-- with bower you don't need use glob -->
    <!-- inject:js:bower -->
    <!-- endinject -->
</body>
</html>
```

`result.html`
```html
<!doctype html>
<html>
<head></head>
<body>
    <!-- with bower you don't need use glob -->
    <!-- inject:js:bower -->
    <script src="bower_components/angular/angular.js"></script>
    <script src="bower_components/jquery/dist/jquery.js"></script>
    <script src="bower_components/lodash/lodash.js"></script>
    <!-- endinject -->
</body>
</html>
```

        


        