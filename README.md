# XCamp

This is part of the xcamp.co website, the ticketing system and the NetVis tool that connects XCamp Members.

## How to change the website contents

Check out the source code and install dependencies, then start the development server:

    git clone https://github.com/jschirrmacher/xcamp.git
    npm install
    npm start

Naturally, you need to install [git](https://git-scm.com/downloads) and [node](https://nodejs.org/en/) first.

After doing the above, open your favourite browser (hopefully *not* Edge - or even Internet Explorer!) and open
the URL http://localhost:8001/index - you should see the main page of xcamp!

You find all relevant css, image and js files in `/public`.

Html is generated using templates which can be found in `/templates` folder. You find all generated pages here directly,
html mail templates are in the subfolder `/templates/mail`.

Templates, which are used by more than one page (e.g. menu, footer and so on) can be found in
`/templates/sub`. If you change some of these, you need to restart the development server: just press CTRL-C
and call `npm start` again.

css files should not be modified directly. Instead, you should have a look at the corresponding .scss files. After
making changes there, you need to run `npm run scss` to re-genereate the css files again. It is also possible to run
`npx sass --watch public/scss:public/dist/css` prior to modifying anything - this looks out for changing files in the `public` folder
and re-generates the corresponding css file immediately. But you would need a second terminal to run `npm start` then.

## Adding sponsors or partners

The files for these can be found in /public/sponsors and /public/partners.
If a new sponsor or partner is to be added, first get a logo in the required size and add it to the corresponding
folders. New files need to be added to the repository by calling

    git add <path to file>

Then, open the .json file which is in the folder and add an entry for the sponsor or partner, by specifying a URL
and the name of the logo file.

### Commit and push

After applying all desired changes and verifying in the browser, that all works well, you need to "commit" and "push"
your changes to the repository by calling

    git commit -am "<describe here, why you changed the files>"

You need to have write access to do so, else you are guided to create a "fork" of the repository and then a
"pull request" to incorporate your changes in the original repository. One of the maintainers will then receive a
notice and approve the changes - or reject them, if there is something missing.
