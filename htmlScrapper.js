const axios = require('axios');
const cheerio = require('cheerio');
const firebase = require("firebase");
const Jetty = require("jetty");
const log = require('single-line-log').stdout;

var jetty = new Jetty(process.stdout);
jetty.clear();

require("firebase/firestore");

firebase.initializeApp({
  apiKey: 'AIzaSyAmZkZPh71rJSsg3eEXyfKO0FK89nrJ0lI',
  authDomain: 'igromaniaapp-a95f1.firebaseapp.com',
  projectId: 'igromaniaapp-a95f1'
});

var db = firebase.firestore();
var i = 300;
var rssCollection = [];
var htmlCollection = [];
var links = [];

checkCollectionHtml();

function checkCollectionRss() {
  console.log('CHECKING RSS COLLECTION')
  db.collection("rss")
    .onSnapshot(function(querySnapshot) {
        querySnapshot.forEach(function(doc) {
          if(htmlCollection.includes(doc.data().articleId))
          {
            // Don't add the link
          } else {
            links.push(doc.data().link);
          }
          console.log('Number of entries in the links array: ' + links.length);
        });
    });
    startTimer();
}

function checkCollectionHtml() {
  console.log('CHECKING HTML COLLECTION')
  db.collection("html")
    .onSnapshot(function(querySnapshot) {
        querySnapshot.forEach(function(doc) {
          htmlCollection.push(doc.data().articleId);
          console.log('Number of entries in the HTML Collection: ' + htmlCollection.length);
        });
    });
    checkCollectionRss();
}

function startTimer() {
  jetty.clear();
  console.log('STARTING TIMER')
  var countdownTimer = setInterval(function() {
    log("HTML Scrape in: " + i);
    i = i - 1;
    if (i <= 0) {
      scrape();
      clearInterval(countdownTimer);
    }
  }, 1000);
}

function scrape() {
  i = 300;
  links.forEach(element => {
    var link = '';
    var title = '';
    var headMedia = '';
    var author = '';
    var link = '';
    var viewCount = '';
    var articleBody; 
    var articleContainer = [[],[]];
    var spiritContents = [];
    var dupRemover = false;

    axios(element)
    .then(response => {
      const body = response.data;
      const $ = cheerio.load(body)
      const infoStructure = $('.lcol');

      infoStructure.each(function () {  
        //Grab title
        title = $(this).find('div > h1').text();

        //Grab link from meta data
        link = $.html('head', { decodeEntities: false });
        link = link.split('<link rel="canonical" href="https://www.igromania.ru/');
        link = link.pop().split('">');
        link = 'https://www.igromania.ru/'+link[0];
        if(link == '')
        {
          console.log("COULDN'T FIND LINK IN HEAD");
          console.log(s$.html('head', { decodeEntities: false }));
          throw new Error();
        }

        //Grab type from the meta data
        type = $.html('head', { decodeEntities: false });
        type = type.split('<link rel="canonical" href="https://www.igromania.ru/');
        type = type.pop().split('">');
        type = type.shift().split('/').shift();

        if(type == '')
        {
          console.log("COULDN'T FIND TYPE IN HEAD");
          console.log($.html('head', { decodeEntities: false }));
          throw new Error();
        }

        if(type.includes('video'))
        {
          isVideo = true;
        } else {
          isVideo = false;
        }

        //Grab link with formatting
        tempDateAll = $(this).find('div.avn_icons').text(); 
        tempDate = $(this).find('div.page_article_info.clearfix').text(); 
        if(tempDate == '')
        {
          tempDate = $(this).find('div.page_news_info.clearfix').text(); 
          if(tempDate == '')
          {
            tempDate = $(this).find('div.page_video_info.clearfix').text(); 

            if(tempDate == '')
            {
              console.log("COULDN'T FIND ARTICLE PUB DATE");
              console.log(link);
              throw new Error();
            }
          }
        }
        tempDate = tempDate.substr(tempDateAll.length, 16);
        day = tempDate.substr(0, 2);
        month = tempDate.substr(3, 2);
        year = tempDate.substr(6, 4);
        hour = tempDate.substr(11, 2);
        minute = tempDate.substr(14, 2);
        date = year + month + day + hour + minute;

        //Grab author
        author = $(this).find('div.page_article_info.clearfix').text(); 
        if(author == '') 
        {
          author = $(this).find('div.page_news_info.clearfix').text(); 
        }
        if(author == '') 
        {
          author = 'No Author';
        } else {
          author = author.substr(28);
        } 

        //Set article views
        viewCount = 0;

        //Grab article header image or header video
        if(isVideo == true)
        {
          headMedia = 'https://www.igromania.ru' + ($(this).find('div.main_pic_container').find('iframe').attr('src'));
        } else {
          headMedia = $(this).find('div.main_pic_container').find('img').attr('src');
        }

        //Counter for check how many items are in the spirit box
        var spirit = $.html('div.similar_block', { decodeEntities: false });
        var spiritArray = spirit.split('div');
        for(var i = 0; i < spiritArray.length; i++)
        {
          if(spiritArray[i].includes('pic_container'))
          {
            spiritContents.push(spiritArray[i].split('src="').pop().split('" src2=').shift());
          }
          if(spiritArray[i].includes('pic_sign'))
          {
            spiritContents.push(spiritArray[i].split('target="_blank">').pop().split('</a></').shift()); 
            spiritContents.push(spiritArray[i].split('href="').pop().split('" target').shift()); 
          }
        }

        //Grab article content .split(/(\n\r){2,}/g);
        content = $.html('div.universal_content.clearfix > div', { decodeEntities: false });
        articleBody = content.split('<div>');
        articleBody.filter(String);
        articleBody = content.split('</div>');
        articleBody.filter(String);
        for(var i = 0; i < articleBody.length; i++)
        {
          if(articleBody[i].includes('video_block'))
          {
            var videoLink = (articleBody[i]).slice(0, -6).split('src=').pop().substr(1).split('">');
            if((articleBody[i]).includes('sign_container'))
            {
              var videoDesc = (articleBody[i]).split('<div class="sign_container">').pop();
              articleContainer.push(['youtube', videoDesc, videoLink[0].slice(30, -28)]); 
            }else {
              articleContainer.push(['youtube', '_', videoLink[0].slice(30, -28)]); 
            }
          } else if(articleBody[i].includes('similar_block'))
          {
            articleContainer.push(["spirit", spiritContents]);
          } else if(articleBody[i].includes('pic_container')) 
          {
            var picTemp = (articleBody[i].slice(71, -20)).split('src=').pop().split('src2=').shift();
            if((articleBody[i]).includes('sign_container'))
            {
              var picDesc = (articleBody[i+1]).split('<div class="sign_container">').pop();
              articleContainer.push(['img', picDesc, picTemp.slice(1,-2)] );
            } else if((articleBody[i+1]).includes('sign_container'))
            {
              var picDesc = (articleBody[i+1]).split('<div class="sign_container">').pop();
              articleContainer.push(['img', picDesc, picTemp.slice(1,-2)] );
              i = i + 1;
            } else {
              articleContainer.push(['img', '_',  picTemp.slice(1,-2)]);
            }
          } else if(articleBody[i].includes('opinion clearfix') )
          {
            var opinionAvatar = articleBody[i].split('src="').pop().split('" src2=').shift();
            var opinionText = articleBody[i+1].split('<div class="opinion_text">').pop() + "</div>";
            if((articleBody[i]).includes('opinion_by'))
            {
              var opinionBy = articleBody[i].split('<div class="opinion_by">').pop();
              i = i + 2;
            } else if((articleBody[i+1]).includes('opinion_by'))
            {
              var opinionBy = articleBody[i+1].split('<div class="opinion_by">').pop();
              i = i + 2;
            } else if((articleBody[i+2]).includes('opinion_by'))
            {
              var opinionBy = articleBody[i+2].split('<div class="opinion_by">').pop();
              i = i + 2;
            } else if((articleBody[i+3]).includes('opinion_by'))
            {
              var opinionBy = articleBody[i+3].split('<div class="opinion_by">').pop();
              i = i + 3;
            }
            articleContainer.push(["interview", opinionBy, opinionAvatar, opinionText]);
          } else if(articleBody[i].includes('opinion_v2 clearfix') )
          {
            var opinionAvatar = articleBody[i].split('src="').pop().split('" src2=').shift();
            var opinionText = articleBody[i+2];
            articleContainer.push(["interview", opinionAvatar, opinionText]);
          } else if(articleBody[i].includes('kugal'))
          {
            var carousel = articleBody[i].split('src');
            //console.log(carousel);
            //articleContainer.push(["carousel", articleBody[i]]);
          } else if(articleBody[i].includes('uninote console'))
          {
            articleContainer.push(["uninote", articleBody[i], articleBody[i+1]]);
            i = i + 1;
          } else if(articleBody[i].includes('endsep')) 
          {
            articleContainer.push(["endDiv"])
          } else if(articleBody[i].includes('<h2>')) 
          {
            articleContainer.push(["h2", articleBody[i]])
          } else if(articleBody[i].includes('plusminus_box good')) 
          {
            articleContainer.push(["liked", articleBody[i]])
            /*
            var imgUrl = articleBody[i].split('src="').pop().split('" src2').shift();
            var outputArray = ["liked", imgUrl];
            while(articleBody[i].includes('li')){
              var temp = articleBody[i].split('<li>').pop().split('</li>').shift();
              outputArray.push(temp);
              articleBody[i].replace(`<li>${temp}</li>`, '');
            }
            //articleContainer.push(outputArray);
            */  
          } else if(articleBody[i].includes('plusminus_box bad')) 
          {
            var imgUrl = articleBody[i].split('src="').pop().split('" src2').shift();
            var outputArray = ["disliked", imgUrl];
            while(articleBody[i].includes('li')){
              var temp = articleBody[i].split('<li>').pop().split('</li>').shift();
              outputArray.push(temp);
              articleBody[i].replace(`<li>${temp}</li>`, '');
            }
            articleContainer.push(outputArray);
          } else if(articleBody[i].includes('localiz')) 
          {
            i+=2;
            articleContainer.push(["localiz", articleBody[i]]);
          } else if(articleBody[i].includes('verdict')) 
          {
            var scoreImg = articleBody[i].split('src="').pop().split('" alt').shift();
            var scoreText = articleBody[i].split('<div class="ttl">Вердикт</div>').pop().split('</div>').shift();
            articleContainer.push(["verdict", scoreImg, scoreText]);
          } else
          {
            articleObject = (articleBody[i]);
            if(articleBody[i] == '' || articleBody[i] == '\n')
            {
              //console.log('Empty Paragraph');
            } else{
              if (articleObject) {
                articleObject = articleObject.substr(5)
                if(articleObject.charAt(0) == 'v' && articleObject.charAt(1) == '>')
                {
                  articleContainer.push(["p", articleObject.slice(2)]);
                } else {
                  articleContainer.push(["p", articleObject]);
                }
              }
            }
          }
        }
        articleContainer.shift();
        articleContainer.shift();
      });

      if(typeof title === 'undefined')
      {
        console.log('title is null');
        console.log(link);
      }
      if(typeof headMedia === 'undefined')
      {
        console.log('headMedia is null');
        console.log(link);
      }
      if(typeof author === 'undefined')
      {
        console.log('author is null');
        console.log(link);
      }
      if(typeof link === 'undefined')
      {
        console.log('link is null');
        console.log(link);
      }
      if(typeof viewCount === 'undefined')
      {
        console.log('viewCount is null, correcting to 0');
        viewCount = 0;
      }

      if(date == '')
      {
        console.log("CAN'T FIND DATE FOR: " + link)
      } else {
        db.collection("html").doc(date).set({
          title: title,
          headMedia: headMedia,
          sortBy: date,
          author: author,
          link: link,
          viewCount: viewCount,
          content: Object.assign({}, articleContainer)
        })
        .then(function(docRef) {
          console.log(date + " saved to the database.");
          links.remove(element);
        })
        .catch(function(error) {
          console.log(element);
          console.error('Error adding ' + date);
        });
      }
    })
    .catch(console.error);
  });  
  startTimer();
}