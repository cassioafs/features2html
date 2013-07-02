// DEFAULT SETTINGS
var FILE_ENCODING = 'utf-8';
var INPUTDIR = 'examples/features';
var TEMPLATESDIR = 'default/templates';
var OUTPUTDIR = 'output';
var LANGUAGE = 'en';
var DOCTEMPLATE, FEATURETEMPLATE;

// MODULES
var commander = require('commander'),
  fs = require('fs'),
  handlebars = require('handlebars'),
  linereader = require('line-reader'),
  underscore = require('underscore'),
  underscorestring = require('underscore.string'),
  async = require('async'),
  i18n = require('i18next');

// options
commander
  .version('0.1')
  .option('-i, --input-dir [path]', 'read feature files from path (default: examples/features)')
  .option('-t, --templates-dir [path]', 'read the files doc_template.html, feature_template.html and style.css from path (default: default/templates)')
  .option('-o, --output-dir [path]', 'send output to folder path (default: output)')
  .option('-l, --lang [en|sv]', 'language used in feature files (default: en)');


// commands
commander
  .command('create')
  .description('Create html from feature files')
  .action(createCommand);

// Check if called without command
if (process.argv.length < 3) {
  commander.help();
}

// parse commands
commander.parse(process.argv);

function setup(done) {
  INPUTDIR = commander.inputDir || INPUTDIR;
  TEMPLATESDIR = commander.templatesDir || TEMPLATESDIR;
  OUTPUTDIR = commander.outputDir || OUTPUTDIR;
  LANGUAGE = commander.lang || LANGUAGE;
  DOCTEMPLATE = TEMPLATESDIR + '/doc_template.html';
  FEATURETEMPLATE = TEMPLATESDIR + '/feature_template.html';
  i18n.init({ lng: LANGUAGE}, function(t) {
    done();
  });
}

function createCommand() {
  setup(create);
}

function create(){
  var docHandlebarTemplate = handlebars.compile(fs.readFileSync(DOCTEMPLATE, FILE_ENCODING));
  var featureHandlebarTemplate = handlebars.compile(fs.readFileSync(FEATURETEMPLATE, FILE_ENCODING));
  var cssStyles = fs.readFileSync(TEMPLATESDIR + '/style.css', FILE_ENCODING);

  parseFeatures(function(features) {

    var featuresHtml = '';
    if (features) {
      for (var i = 0; i < features.length; i++) {
        featuresHtml += featureHandlebarTemplate(features[i]);
      }
    }
    var docData = new Object();
    docData.cssStyles = cssStyles;
    docData.featuresHtml = featuresHtml;
    var docHtml = docHandlebarTemplate(docData);

    fs.mkdir(OUTPUTDIR,function(e){
      if(!e || (e && e.code === 'EEXIST')){
        fs.writeFileSync(OUTPUTDIR + '/features.html', docHtml, FILE_ENCODING);
        console.log('Done');
      } else {
        console.log(e);
      }
    });

  });


}

function parseFeatures(callback) {

  var allFiles = fs.readdirSync(INPUTDIR);
  var featureFiles = underscore.filter(allFiles, function(item) {
    return underscorestring.endsWith(item,'.feature');
  });
  var sortedFeatureFiles = featureFiles.sort();
  var sortedFeaturesFullpath = underscore.map(sortedFeatureFiles, function(filename) {
     return INPUTDIR + '/' + filename;
  });

  async.mapSeries(sortedFeaturesFullpath, parseFeatureFile, function(err, results) {
     callback(results);
  });
}

function parseFeatureFile(featureFilename, callback) {

  var feature = new Object();
  feature.background = '';
  feature.scenarios = [];
  var scenario = new Object();
  scenario.content = '';

  var foundMultirowScenario = false;
  var foundMultirowBackground = false;
  linereader.eachLine(featureFilename, function(line) {

    if (i18nStringContains(line, 'feature')) {
       feature.name = line.replace(i18n.t('feature'), '');
    }

    if ((i18nStringContains(line, 'scenario') || i18nStringContains(line, 'sidenote')) && foundMultirowScenario) {
      // new scenario found. start parsing new scenario
      feature.scenarios.push(scenario);
      scenario = new Object();
      scenario.content = '';
      foundMultirowScenario = false;
    }

    if (i18nStringContains(line, 'scenario') || i18nStringContains(line, 'sidenote') || foundMultirowScenario) {
      foundMultirowScenario = true;

      // we are no longer looking for more background rows, reset flag
      foundMultirowBackground = false;

      // Handle sidenote
      if (i18nStringContains(line, 'sidenote')) {
         scenario.sidenote = line.replace(i18n.t('sidenote'), '');
      } else {
        // Handle scenario content
        if (scenario.content) {
          scenario.content = scenario.content + '\n' + line;
        } else {
          scenario.content = line;
        }
      }

    }

    if (i18nStringContains(line, 'background') || foundMultirowBackground) {
       foundMultirowBackground = true;
       feature.background = feature.background + ' ' + line.replace(i18n.t('background'), '').replace('Som', '<br/>Som');
    }


  }).then(function () {
      // Add last scenario, if exists
      if (scenario && scenario.content) {
        feature.scenarios.push(scenario);
      }
      callback(null, feature);
  });

}

function i18nStringContains(orgstring, i18nkey) {
  return  orgstring.indexOf(i18n.t(i18nkey)) !== -1;
}

