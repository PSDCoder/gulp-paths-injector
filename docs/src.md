# injector.src(templateType[, placeholderName])

This method search inject placeholders in template and returns stream with files matched with glob.  

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
var concat = require('gulp-concat');
var plumber = require('gulp-plumber');
   
gulp.task('inject', function () {
    var injector = pathsInjector();

    gulp.src('template.html')
        .pipe(plumber())
        .pipe(injector.src('js'))
        .pipe(concat('all.js'))
        .pipe(gulp.dest('./'));
});
```

In `all.js` you can find concatenated code from all matched js files