# XCamp

This is part of the xcamp.co website, the ticketing system and the NetVis tool that connects XCamp Members.

## Prerequisites

You need to install some components first:

- [git](https://git-scm.com/downloads)
- [node](https://nodejs.org/en/)

## How to change the website contents

Check out the source code and the website content and install dependencies, then start the development server:

    git clone https://github.com/jschirrmacher/xcamp.git
    cd xcamp
    npm install
    git clone https://github.com/jschirrmacher/xcamp-content.git content
    npm start

After doing the above, open your favourite browser (hopefully *not* Edge - or even Internet Explorer!) and open
the URL http://localhost:8001/index - you should see the main page of xcamp!

You find all relevant css, image and js files in `/public`. The content is mostly writte with Markdown and located in `/content`.

Html is generated using templates which can be found in `/templates` folder. You find all generated pages here directly,
html mail templates are in the subfolder `/templates/mail`.

Templates, which are used by more than one page (e.g. menu, footer and so on) can be found in
`/templates/sub`. If you change some of these, you need to restart the development server: just press CTRL-C
and call `npm start` again.

css files should not be modified directly. Instead, you should have a look at the corresponding .scss files. After
making changes there, you need to run `npm run scss` to re-genereate the css files again. It is also possible to run
`npx sass --watch public/scss:public/dist/css` prior to modifying anything - this looks out for changing files in the `public` folder
and re-generates the corresponding css file immediately. But you would need a second terminal to run `npm start` then.


### Commit and push

After applying all desired changes and verifying in the browser, that all works well, you need to "commit" and "push"
your changes to the repository by calling

    git commit -am "<describe here, why you changed the files>"

You need to have write access to do so, else you are guided to create a "fork" of the repository and then a
"pull request" to incorporate your changes in the original repository. One of the maintainers will then receive a
notice and approve the changes - or reject them, if there is something missing.
