let gulp = require('gulp');
let sass = require('gulp-sass');

let stylePaths = {
    public: 'public/assets/stylesheets/**/*.scss'
};

gulp.task('sass', (done) => {
    gulp.src(stylePaths.public, {base: "./"})
    .pipe(sass().on('error', sass.logError))
    .pipe(gulp.dest('./'));
    done();
});

gulp.task('watch:sass', () => {
    gulp.watch(stylePaths.public, gulp.series('sass'));
});