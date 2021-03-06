/**
 * Email plugin
 *
 * Notifies all events (up, down, paused, restarted) by email
 *
 * Installation
 * ------------
 * This plugin is disabled by default. To enable it, add its entry 
 * to the `plugins` key of the configuration:
 *
 *   // in config/production.yaml
 *   plugins:
 *     - ./plugins/email
 *
 * Usage
 * -----
 * This plugin sends an email each time a check is started, goes down, or goes back up. 
 * When the check goes down, the email contains the error details:
 *
 *   Object: [Down] Check "FooBar" just went down
 *   On Thursday, September 4th 1986 8:30 PM,
 *   a test on URL "http://foobar.com" failed with the following error:
 *
 *     Error 500
 *
 *   Uptime won't send anymore emails about this check until it goes back up.
 *   ---------------------------------------------------------------------
 *   This is an automated email sent from Uptime. Please don't reply to it.
 *
 * Configuration
 * -------------
 * Here is an example configuration:
 *
 *   // in config/production.yaml
 *   email:
 *     method:      SMTP  # possible methods are SMTP, SES, or Sendmail
 *     transport:         # see https://github.com/andris9/nodemailer for transport options
 *       service:   Gmail
 *       auth:            
 *         user:    foobar@gmail.com
 *         pass:    gursikso
 *     event:
 *       up:        true
 *       down:      true
 *       paused:    false
 *       restarted: false
 *     message:           
 *       from:     'Fred Foo <foo@blurdybloop.com>'
 *       to:       'bar@blurdybloop.com, baz@blurdybloop.com'
 *     # The email plugin also uses the main `url` param for hyperlinks in the sent emails
 */
var fs         = require('fs');
var nodemailer = require('nodemailer');
var moment     = require('moment');
var CheckEvent = require('../../models/checkEvent');
var ejs        = require('ejs');
var template = fs.readFileSync(__dirname + '/views/_detailsEdit.ejs', 'utf8');


exports.initWebApp = function(options) {
  var config = options.config.email;
  var mailer = nodemailer.createTransport(config.method, config.transport);
  var templateDir = __dirname + '/views/';
  var dashboard = options.dashboard;
  CheckEvent.on('afterInsert', function(checkEvent) {
    if (!config.event[checkEvent.message]) return;
    checkEvent.findCheck(function(err, check) {
      if (err) return console.error(err);
      var filename = templateDir + checkEvent.message + '.ejs';
      var renderOptions = {
        check: check,
        checkEvent: checkEvent,
        url: options.config.url,
        moment: moment,
        filename: filename
      };
      var lines = ejs.render(fs.readFileSync(filename, 'utf8'), renderOptions).split('\n');
      var mailOptions = {
        from:    config.message.from,
        to:      config.message.to,
        subject: lines.shift(),
        text:    lines.join('\n')
      };
      if (check.pollerParams.alert_email) {
        mailOptions.to = check.pollerParams.alert_email;
      }
      mailer.sendMail(mailOptions, function(err2, response) {
        if (err2) return console.error('Email plugin error: %s', err2);
        console.log('Notified event by email: Check ' + check.name + ' ' + checkEvent.message);
      });
    });
  });

  dashboard.on('populateFromDirtyCheck', function(checkDocument, dirtyCheck, type) {
      if (type !== 'http' && type !== 'https') return;
      var alert_email = dirtyCheck.alert_email;
      if(!alert_email) return;
	  var mail_list = alert_email.split(",");
	  var len = mail_list.length;
	  var i=0;

	  for (i=0;i<len;i++) {
	      var mailto = mail_list[i];
	      var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
	      if (!re.test(mailto)) {
	      	throw new Error('Invalid email address');
		  }
	   }
		  console.log(alert_email);
		  checkDocument.setPollerParam('alert_email', alert_email);
    });

  dashboard.on('checkEdit', function(type, check, partial) {
    if (type !== 'http' && type !== 'https') return;
    partial.push(ejs.render(template, { locals: { check: check } }));
  });


  console.log('Enabled Email notifications');
};
