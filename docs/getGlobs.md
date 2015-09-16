# injector.getGlobs(templateType[, placeholderName])

This method search inject placeholders in template and returns Promise with merged lists matched to `templateType` and `placeholderName`.  
It's handful for set up watchers.

## Example:

`template.html`
```html
<!doctype html>
<html>
<head>
    <!-- inject:css (assets/**/*.css) -->

    <!-- endinject -->
</head>
<body>
    <!-- inject:js:bower -->
    <!-- endinject -->
    <!-- inject:js:vendors (vendors/**/*.js) -->
    <!-- endinject -->
    
    <!-- inject:js:app (src/**/*.module.js) -->
    <!-- endinject -->
    
    <!-- inject:js:app (src/**/*.!(module).js) -->
    <!-- endinject -->
</body>
</html>
```

`gulpfile.js:`
```js
var pathsInjector = require('gulp-paths-injector');
var runSequence = require('run-sequence');
var plumber = require('gulp-plumber');
var watch = require('gulp-watch');
   
gulp.task('watch', function () {
    var injector = pathsInjector();

    pathsInjector()
        .getGlobs('index.html', 'js', 'app')
        .then(function (globs) {
            //globs will be ['src/**/*.module.js', 'src/**/*.!(module).js']
        
            watch(globs, function () {
                console.log('js changed');
                runSequence('js__app');
            });
        }, function (reason) {
            console.error(reason);
        });
});
```