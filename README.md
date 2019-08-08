#XCamp

This is part of the xcamp.co website, the ticketing system and the NetVis tool that connects XCamp Members.

## Installation for changing the website contents

Check out the source code and install dependencies, then start the development server:

    git checkout https://github.com/jschirrmacher/xcamp.git
    npm install
    npm start
    
Naturally, you need to install [git](https://git-scm.com/downloads) and [node](https://nodejs.org/en/) first.

After doing the above, open your favourite browser (hopefully *not* Edge - or even Internet Explorer!) and open
the URL http://localhost:8001/index - you should see the main page of xcamp!

You find all relevant css, image and js files in /public, html is generated using templates which can be found in
/templates. If you change some of the latter, you might need to restart the development server: just press CTRL-C
and call `npm start` again. This is only necessary, if you change headers or footers or some of the other templates
which are used by more than one page.

css files should not be modified directly. Instead, you should have a look at the corresponding .scss files. After
making changes there, you need to run [scss](https://sass-lang.com/install) (which you then would have to install as
well) to re-genereate the css files again. 

### Commit and push

After applying all desired changes and verifying in the browser, that all works well, you need to "commit" and "push"
your changes to the repository by calling

    git commit -am "<describe here, why you changed the files>"
    
You need to have write access to do so, else you are guided to create a "fork" of the repository and then a
"pull request" to incorporate your changes in the original repository. One of the maintainers will then receive a
notice and approve the changes - or reject them, if there is something missing.
