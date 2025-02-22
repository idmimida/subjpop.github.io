/*
Copyright(c)2008-2016 Internet Archive. Software license AGPL version 3.

This file is part of BookReader.

    BookReader is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    BookReader is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with BookReader.  If not, see <http://www.gnu.org/licenses/>.

    The BookReader source is hosted at http://github.com/internetarchive/bookreader/

*/

// BookReader()
//______________________________________________________________________________
// After you instantiate this object, you must supply the following
// book-specific functions, before calling init().  Some of these functions
// can just be stubs for simple books.
//  - getPageWidth()
//  - getPageHeight()
//  - getPageURI()
//  - getPageSide()
//  - canRotatePage()
//  - getPageNum()
//  - getSpreadIndices()
// You must also add a numLeafs property before calling init().

function BookReader() {

    // Mode constants
    this.constMode1up = 1;
    this.constMode2up = 2;
    this.constModeThumb = 3;

    this.reduce  = 4;
    this.padding = 10;          // Padding in 1up

    this.mode    = this.constMode1up;
    this.ui = 'full';           // UI mode
    this.uiAutoHide = false;    // Controls whether nav/toolbar will autohide

    // thumbnail mode
    this.thumbWidth = 100; // will be overridden during prepareThumbnailView
    this.thumbRowBuffer = 2; // number of rows to pre-cache out a view
    this.thumbColumns = 6; // default
    this.thumbMaxLoading = 4; // number of thumbnails to load at once
    this.thumbPadding = 10; // spacing between thumbnails
    this.displayedRows=[];

    this.displayedIndices = [];
    //this.indicesToDisplay = [];
    this.imgs = {};
    this.prefetchedImgs = {}; //an object with numeric keys cooresponding to page index

    this.animating = false;
    this.auto      = false;
    this.autoTimer = null;
    this.flipSpeed = 'fast';

    this.twoPagePopUp = null;
    this.leafEdgeTmp  = null;
    this.embedPopup = null;
    this.printPopup = null;

    this.searchTerm = '';
    this.searchResults = null;

    this.firstIndex = null;

    this.lastDisplayableIndex2up = null;

    // Should be overriden (before init) by custom implmentations.
    this.logoURL = 'http://subjpop.com';

    // Base URL for UI images - should be overriden (before init) by
    // custom implementations.
    // $$$ This is the same directory as the images referenced by relative
    //     path in the CSS.  Would be better to automagically find that path.
    this.imagesBaseURL = '/bookreader/images/';


    // Zoom levels
    // $$$ provide finer grained zooming
    /*
    this.reductionFactors = [ {reduce: 0.5, autofit: null},
                              {reduce: 1, autofit: null},
                              {reduce: 2, autofit: null},
                              {reduce: 4, autofit: null},
                              {reduce: 8, autofit: null},
                              {reduce: 16, autofit: null} ];
    */
    /* The autofit code ensures that fit to width and fit to height will be available */
    this.reductionFactors = [ {reduce: 0.5, autofit: null},
                          {reduce: 1, autofit: null},
                          {reduce: 2, autofit: null},
                          {reduce: 3, autofit: null},
                          {reduce: 4, autofit: null},
                          {reduce: 6, autofit: null} ];


    // Object to hold parameters related to 1up mode
    this.onePage = {
        autofit: 'height',       // valid values are height, width, none
        responsiveAutofit: true, // selects the value of autofit at init
    };

    // Object to hold parameters related to 2up mode
    this.twoPage = {
        coverInternalPadding: 0, // Width of cover
        coverExternalPadding: 0, // Padding outside of cover
        bookSpineDivWidth: 64,    // Width of book spine  $$$ consider sizing based on book length
        autofit: 'auto'
    };

    // This object/dictionary controls which optional features are enabled
    // XXXmang in progress
    this.features = {
        // search
        // read aloud
        // open library entry
        // table of contents
        // embed/share ui
        // info ui
    };

    // Text-to-Speech params
    this.ttsPlaying     = false;
    this.ttsIndex       = null;  //leaf index
    this.ttsPosition    = -1;    //chunk (paragraph) number
    this.ttsBuffering   = false;
    this.ttsPoller      = null;
    this.ttsFormat      = null;

    // Themes
    this.themes = {
        ol: null
    };
    this.default_theme = 'ol';
    this.theme = 'ol';

    this.bookUrl = null;
    this.bookUrlText = null;
    this.bookUrlTitle = null;

    // Fields used to populate the info window
    this.metadata = [];
    this.thumbnail = null;
    this.bookUrlMoreInfo = null;

    // Settings for mobile
    this.enableMobileNav = true;
    this.mobileNavTitle = 'Internet Archive';
    this.onePageMinBreakpoint = 800;

    // Keep track of what page you are on
    this.enablePageResume = false;

    // Add search to menus
    this.enableSearch = true;

    // Experimental Controls (eg b/w)
    this.enableExperimentalControls = false;

    return this;
}

(function ($) {
// init()
//______________________________________________________________________________
BookReader.prototype.init = function() {
    //-------------------------------------------------------------------------
    // Parse parameters from URL/Cookies/Defaults
    var startIndex = undefined;
    this.pageScale = this.reduce; // preserve current reduce

    // Find start index and mode if set in location hash
    var params = {};
    if (window.location.hash) {
        // params explicitly set in URL
        params = this.paramsFromFragment(window.location.hash);
    } else if ('defaults' in this) {
        // params not explicitly set, use defaults if we have them
        params = this.paramsFromFragment(this.defaults);
    }
    if ('undefined' != typeof(params.index)) {
        startIndex = params.index;
    } else if ('undefined' != typeof(params.page)) {
        startIndex = this.getPageIndex(params.page);
    }
    if ('undefined' == typeof(startIndex) && this.enablePageResume && this.numLeafs > 2) {
        // Check cookies
        var val = this.getResumeValue();
        if (val !== null) {
            startIndex = val;
        }
    }
    if ('undefined' == typeof(startIndex) && 'undefined' != typeof(this.titleLeaf) && this.numLeafs > 2) {
        // title leaf is known - but only use as default if book has a few pages
        startIndex = this.leafNumToIndex(this.titleLeaf);
    }
    if ('undefined' == typeof(startIndex)) {
        startIndex = 0;
    }
    this.firstIndex = startIndex;

    // Use params or browser width to set view mode
    var windowWidth = $(window).width();
    var nextMode;
    if ('undefined' != typeof(params.mode)) {
        nextMode = params.mode;
    } else if (this.ui == 'full' && windowWidth <= this.onePageMinBreakpoint) {
        // In full mode, we set the default based on width
        nextMode = this.constMode1up;
    } else {
        nextMode = this.constMode2up;
    }

    if (this.canSwitchToMode(nextMode)) {
        this.mode = nextMode;
    } else {
        this.mode = this.constMode1up;
    }

    if (this.onePage.responsiveAutofit && this.mode == this.constMode1up) {
        if (windowWidth <= this.onePageMinBreakpoint) {
            this.onePage.autofit = 'width';
        } else {
            this.onePage.autofit = 'height';
        }
    }

    //-------------------------------------------------------------------------
    // Setup Navbars and other UI

    this.isTouchDevice = !!('ontouchstart' in window) || !!('msmaxtouchpoints' in window.navigator);

    this.isSoundManagerSupported = false;
    if (typeof(soundManager) !== 'undefined') {
      this.isSoundManagerSupported = soundManager.supported();
    }

    // Calculate Max page num (used for pagination display)
    this.maxPageNum = 0;
    var pageNumVal;
    for (var i = 0; i < this.numLeafs; i++) {
        pageNumVal = this.getPageNum(i);
        if (!isNaN(pageNumVal) && pageNumVal > this.maxPageNum) {
            this.maxPageNum = pageNumVal;
        }
    }

    // Set document title -- may have already been set in enclosing html for
    // search engine visibility
    document.title = this.shortTitle(50);
    $("#BookReader").empty().removeClass().addClass("ui-" + this.ui);
    this.initToolbar(this.mode, this.ui); // Build inside of toolbar div
    $("#BookReader").append("<div id='BRcontainer' dir='ltr'></div>");
    $("#BRcontainer").append("<div id='BRpageview'></div>");

    // We init the nav bar after the params processing so that the nav slider
    // knows where it should start (doesn't jump after init)
    if (this.ui == "embed") {
        this.initEmbedNavbar();
    } else {
        this.initNavbar();
    }
    this.resizeBRcontainer();

    // Set strings in the UI
    this.initUIStrings();

    // $$$ refactor this so it's enough to set the first index and call preparePageView
    //     (get rid of mode-specific logic at this point)
    if (this.constMode1up == this.mode) {
        this.prepareOnePageView();
    } else if (this.constModeThumb == this.mode) {
        this.prepareThumbnailView();
    } else {
        this.displayedIndices = [this.firstIndex];
        this.prepareTwoPageView();
    }

    // Enact other parts of initial params
    this.updateFromParams(params);

    // Add a class if this is a touch enabled device
    if (this.isTouchDevice) {
      $("body").addClass("touch");
    } else {
      $("body").addClass("no-touch");
    }

    // Add class to body for mode. Responsiveness is disabled in embed.
    $("body").addClass("br-ui-" + this.ui);

    //-------------------------------------------------------------------------
    // Bind to events

    if (!this.isTouchDevice) this.setupTooltips();
    this.bindNavigationHandlers();
    this.setupKeyListeners();
    this.startLocationPolling();

    this.lastScroll = (new Date().getTime());
    $("#BRcontainer").bind('scroll', this, function(e) {
        // Note, this scroll event fires for both user, and js generated calls
        // It is functioning in some cases as the primary triggerer for rendering
        e.data.lastScroll = (new Date().getTime());
        if (e.data.constMode2up != e.data.mode) {
          e.data.drawLeafsThrottled();
        }
    });

    $(window).bind('resize', this, function(e) {
        e.data.resize();
    });
    $(window).bind("orientationchange", this, function(e) {
        e.data.resize();
    });

    if (this.protected) {
        $(document).on('contextmenu dragstart', '.BRpagediv1up', function(e) {
            return false;
        });
        $(document).on('contextmenu dragstart', '.BRpageimage', function(e) {
            return false;
        });
        $(document).on('contextmenu dragstart', '.BRpagedivthumb', function(e) {
            return false;
        });
        $('.BRicon.share').hide();
    }

    $('.BRpagediv1up').bind('mousedown', this, function(e) {
        // $$$ the purpose of this is to disable selection of the image (makes it turn blue)
        //     but this also interferes with right-click.  See https://bugs.edge.launchpad.net/gnubook/+bug/362626
        return false;
    });

    //-------------------------------------------------------------------------
    // Setup sound manager for read-aloud
    if (this.isSoundManagerSupported) this.setupSoundManager();


    $(document).trigger("BookReader:PostInit");

    this.init.initComplete = true;
}


//______________________________________________________________________________

/**
 * Throttle function
 * @see https://remysharp.com/2010/07/21/throttling-function-calls
 */
BookReader.prototype.throttle = function(fn, threshhold, delay) {
    threshhold || (threshhold = 250);
    var last,
        deferTimer;
    if (delay) last = +new Date;
    return function () {
      var context = this;
      var now = +new Date,
          args = arguments;
      if (last && now < last + threshhold) {
        // hold on to it
        clearTimeout(deferTimer);
        deferTimer = setTimeout(function () {
          last = now;
          fn.apply(context, args);
        }, threshhold);
      } else {
        last = now;
        fn.apply(context, args);
      }
    };
};

/**
 * Returns a function, that, as long as it continues to be invoked, will not
 * be triggered. The function will be called after it stops being called for
 * N milliseconds. If `immediate` is passed, trigger the function on the
 * leading edge, instead of the trailing.
 * @see https://davidwalsh.name/javascript-debounce-function
 */
BookReader.prototype.debounce = function(func, wait, immediate) {
    var timeout;
    return function() {
        var context = this, args = arguments;
        var later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
};


// resize
// Resizes the bookreader
//______________________________________________________________________________
BookReader.prototype.resize = function() {
  if (!this.init.initComplete) return;

  this.resizeBRcontainer();

  if (this.constMode1up == this.mode) {
      if (this.onePage.autofit != 'none') {
          this.resizePageView();
          this.centerPageView();
          this.updateSearchHilites(); //deletes hilights but does not call remove()
      } else {
          this.centerPageView();
          this.displayedIndices = [];
          this.updateSearchHilites(); //deletes hilights but does not call remove()
          this.drawLeafsThrottled();
      }
  } else if (this.constModeThumb == this.mode){
      this.prepareThumbnailView();
  } else {
      //console.log('drawing 2 page view');

      // We only need to prepare again in autofit (size of spread changes)
      if (this.twoPage.autofit) {
          this.prepareTwoPageView();
      } else {
          // Re-center if the scrollbars have disappeared
          var center = this.twoPageGetViewCenter();
          var doRecenter = false;
          if (this.twoPage.totalWidth < $('#BRcontainer').prop('clientWidth')) {
              center.percentageX = 0.5;
              doRecenter = true;
          }
          if (this.twoPage.totalHeight < $('#BRcontainer').prop('clientHeight')) {
              center.percentageY = 0.5;
              doRecenter = true;
          }
          if (doRecenter) {
              this.twoPageCenterView(center.percentageX, center.percentageY);
          }
      }
  }
};

BookReader.prototype.setupKeyListeners = function() {
    var self = this;

    var KEY_PGUP = 33;
    var KEY_PGDOWN = 34;
    var KEY_END = 35;
    var KEY_HOME = 36;

    var KEY_LEFT = 37;
    var KEY_UP = 38;
    var KEY_RIGHT = 39;
    var KEY_DOWN = 40;

    // We use document here instead of window to avoid a bug in jQuery on IE7
    $(document).keydown(function(e) {

        // Keyboard navigation
        if (!self.keyboardNavigationIsDisabled(e)) {
            switch(e.keyCode) {
                case KEY_PGUP:
                case KEY_UP:
                    // In 1up mode page scrolling is handled by browser
                    if (self.constMode2up == self.mode) {
                        e.preventDefault();
                        self.prev();
                    }
                    break;
                case KEY_DOWN:
                case KEY_PGDOWN:
                    if (self.constMode2up == self.mode) {
                        e.preventDefault();
                        self.next();
                    }
                    break;
                case KEY_END:
                    e.preventDefault();
                    self.last();
                    break;
                case KEY_HOME:
                    e.preventDefault();
                    self.first();
                    break;
                case KEY_LEFT:
                    if (self.constModeThumb != self.mode) {
                        e.preventDefault();
                        self.left();
                    }
                    break;
                case KEY_RIGHT:
                    if (self.constModeThumb != self.mode) {
                        e.preventDefault();
                        self.right();
                    }
                    break;
            }
        }
    });
};

// setupTooltips()
//______________________________________________________________________________
BookReader.prototype.setupTooltips = function() {
    $('.js-tooltip').bt(
      {
        positions: ['top', 'bottom'],
        shrinkToFit: true,
        spikeGirth: 5,
        spikeLength: 3,
        fill: '#4A90E2',
        cornerRadius: 0,
        strokeWidth: 0,
        cssStyles: {
          color: 'white',
          fontSize: '1.25em',
          whiteSpace: 'nowrap'
        },
      }
    )
    ;
}

// setupSoundManager()
//______________________________________________________________________________
BookReader.prototype.setupSoundManager = function() {
    soundManager.setup({
        debugMode: false,
        // Note, there's a bug in Chrome regarding range requests.
        // Flash is used as a workaround.
        // See https://bugs.chromium.org/p/chromium/issues/detail?id=505707
        preferFlash: true
    });
};

// drawLeafs()
//______________________________________________________________________________
BookReader.prototype.drawLeafs = function() {
    // console.log('drawLeafs', this.currentIndex());
    if (this.constMode1up == this.mode) {
        this.drawLeafsOnePage();
    } else if (this.constModeThumb == this.mode) {
        this.drawLeafsThumbnail();
    } else {
        this.drawLeafsTwoPage();
    }
};

// bindGestures(jElement)
//______________________________________________________________________________
BookReader.prototype.bindGestures = function(jElement) {
    // TODO support gesture change is only iOS. Support android.
    // HACK(2017-01-20) - Momentum scrolling is causing the scroll position
    // to jump after zooming in on mobile device. I am able to reproduce
    // when you move the book with one finger and then add another
    // finger to pinch. Gestures are aware of scroll state.

    var self = this;
    var numTouches = 1;

    jElement.unbind('touchmove').bind('touchmove', function(e) {
      if (e.originalEvent.cancelable) numTouches = e.originalEvent.touches.length;
      e.stopPropagation();
    });

    // jElement.unbind('gesturestart').bind('gesturestart', function(e) {});
    jElement.unbind('gesturechange').bind('gesturechange', function(e) {
        e.preventDefault();
        // These are two very important fixes to adjust for the scroll position
        // issues described below
        if (!(numTouches !== 2 || (new Date().getTime()) - self.lastScroll < 500)) {
          if (e.originalEvent.scale > 1.5) {
              self.zoom(1);
          } else if (e.originalEvent.scale < 0.6) {
              self.zoom(-1);
          }
        }
    });
    // jElement.unbind('gestureend').bind('gestureend', function(e) {});
};

BookReader.prototype.setClickHandler2UP = function( element, data, handler) {
    //console.log('setting handler');
    //console.log(element.tagName);

    $(element).unbind('click').bind('click', data, function(e) {
        handler(e);
    });
};

// drawLeafsOnePage()
//______________________________________________________________________________
BookReader.prototype.drawLeafsOnePage = function() {
    //console.log('drawLeafsOnePage', this.firstIndex, this.currentIndex());
    var containerHeight = $('#BRcontainer').height();
    var scrollTop = $('#BRcontainer').prop('scrollTop');
    var scrollBottom = scrollTop + containerHeight;
    // console.log('top=' + scrollTop + ' bottom='+scrollBottom);
    //var viewWidth = $('#BRpageview').width(); //includes scroll bar width
    var viewWidth = $('#BRcontainer').prop('scrollWidth');

    var indicesToDisplay = [];

    var i;
    var leafTop = 0;
    var leafBottom = 0;
    for (i=0; i<this.numLeafs; i++) {
        var height  = parseInt(this._getPageHeight(i)/this.reduce);

        leafBottom += height;
        //console.log('leafTop = '+leafTop+ ' pageH = ' + this._getPageHeight(i) + 'leafTop>=scrollTop=' + (leafTop>=scrollTop));
        var topInView    = (leafTop >= scrollTop) && (leafTop <= scrollBottom);
        var bottomInView = (leafBottom >= scrollTop) && (leafBottom <= scrollBottom);
        var middleInView = (leafTop <=scrollTop) && (leafBottom>=scrollBottom);
        if (topInView || bottomInView || middleInView) {
            //console.log('displayed: ' + this.displayedIndices);
            //console.log('to display: ' + i);
            indicesToDisplay.push(i);
        }
        leafTop += height +10;
        leafBottom += 10;
    }

    // Based of the pages displayed in the view we set the current index
    // $$$ we should consider the page in the center of the view to be the current one
    var firstIndexToDraw  = indicesToDisplay[0];
    this.firstIndex = firstIndexToDraw;

    // Update hash, but only if we're currently displaying a leaf
    // Hack that fixes #365790
    if (this.displayedIndices.length > 0) {
        this.updateLocationHash();
    }

    if ((0 != firstIndexToDraw) && (1 < this.reduce)) {
        firstIndexToDraw--;
        indicesToDisplay.unshift(firstIndexToDraw);
    }

    var lastIndexToDraw = indicesToDisplay[indicesToDisplay.length-1];
    if ( ((this.numLeafs-1) != lastIndexToDraw) && (1 < this.reduce) ) {
        indicesToDisplay.push(lastIndexToDraw+1);
    }

    var BRpageViewEl = document.getElementById('BRpageview');

    leafTop = 0;
    var i;
    for (i=0; i<firstIndexToDraw; i++) {
        leafTop += parseInt(this._getPageHeight(i)/this.reduce) +10;
    }

    for (i=0; i<indicesToDisplay.length; i++) {
        var index = indicesToDisplay[i];
        var height  = parseInt(this._getPageHeight(index)/this.reduce);

        if (BookReader.util.notInArray(indicesToDisplay[i], this.displayedIndices)) {
            var width   = parseInt(this._getPageWidth(index)/this.reduce);
            //console.log("displaying leaf " + indicesToDisplay[i] + ' leafTop=' +leafTop);
            var div = document.createElement('div');
            div.className = 'BRpagediv1up';
            div.id = 'pagediv'+index;
            div.style.position = "absolute";
            div.style.top = leafTop + 'px';
            var left = (viewWidth-width)>>1;
            if (left<0) left = 0;
            div.style.left = left + 'px';
            div.style.width = width + 'px';
            div.style.height = height + 'px';
            //$(div).text('loading...');

            BRpageViewEl.appendChild(div);

            var img = document.createElement('img');
            img.src = this._getPageURI(index, this.reduce, 0);
            img.className = 'BRnoselect BRonePageImage';
            img.style.width = width + 'px';
            img.style.height = height + 'px';
            div.appendChild(img);
        } else {
            //console.log("not displaying " + indicesToDisplay[i] + ' score=' + jQuery.inArray(indicesToDisplay[i], this.displayedIndices));
        }

        leafTop += height +10;

    }

    for (i=0; i<this.displayedIndices.length; i++) {
        if (BookReader.util.notInArray(this.displayedIndices[i], indicesToDisplay)) {
            var index = this.displayedIndices[i];
            //console.log('Removing leaf ' + index);
            //console.log('id='+'#pagediv'+index+ ' top = ' +$('#pagediv'+index).css('top'));
            $('#pagediv'+index).remove();
        } else {
            //console.log('NOT Removing leaf ' + this.displayedIndices[i]);
        }
    }

    this.displayedIndices = indicesToDisplay.slice();
    this.updateSearchHilites();

    if (null != this.getPageNum(firstIndexToDraw))  {
        $("#BRpagenum").val(this.getPageNum(this.currentIndex()));
    } else {
        $("#BRpagenum").val('');
    }

    this.updateToolbarZoom(this.reduce);

    // Update the slider
    this.updateNavIndexThrottled();
};

// drawLeafsThumbnail()
//______________________________________________________________________________
// If seekIndex is defined, the view will be drawn with that page visible (without any
// animated scrolling)
BookReader.prototype.drawLeafsThumbnail = function( seekIndex ) {
    //alert('drawing leafs!');

    var viewWidth = $('#BRcontainer').prop('scrollWidth') - 20; // width minus buffer

    //console.log('top=' + scrollTop + ' bottom='+scrollBottom);

    var i;
    var leafWidth;
    var leafHeight;
    var rightPos = 0;
    var bottomPos = 0;
    var maxRight = 0;
    var currentRow = 0;
    var leafIndex = 0;
    var leafMap = [];

    var self = this;

    // Will be set to top of requested seek index, if set
    var seekTop;

    // Calculate the position of every thumbnail.  $$$ cache instead of calculating on every draw
    for (i=0; i<this.numLeafs; i++) {
        leafWidth = this.thumbWidth;
        if (rightPos + (leafWidth + this.thumbPadding) > viewWidth){
            currentRow++;
            rightPos = 0;
            leafIndex = 0;
        }

        if (leafMap[currentRow]===undefined) { leafMap[currentRow] = {}; }
        if (leafMap[currentRow].leafs===undefined) {
            leafMap[currentRow].leafs = [];
            leafMap[currentRow].height = 0;
            leafMap[currentRow].top = 0;
        }
        leafMap[currentRow].leafs[leafIndex] = {};
        leafMap[currentRow].leafs[leafIndex].num = i;
        leafMap[currentRow].leafs[leafIndex].left = rightPos;

        leafHeight = parseInt((this.getPageHeight(leafMap[currentRow].leafs[leafIndex].num)*this.thumbWidth)/this.getPageWidth(leafMap[currentRow].leafs[leafIndex].num), 10);
        if (leafHeight > leafMap[currentRow].height) {
            leafMap[currentRow].height = leafHeight;
        }
        if (leafIndex===0) { bottomPos += this.thumbPadding + leafMap[currentRow].height; }
        rightPos += leafWidth + this.thumbPadding;
        if (rightPos > maxRight) { maxRight = rightPos; }
        leafIndex++;

        if (i == seekIndex) {
            seekTop = bottomPos - this.thumbPadding - leafMap[currentRow].height;
        }
    }

    // reset the bottom position based on thumbnails
    $('#BRpageview').height(bottomPos);

    var pageViewBuffer = Math.floor(($('#BRcontainer').prop('scrollWidth') - maxRight) / 2) - 14;

    // If seekTop is defined, seeking was requested and target found
    if (typeof(seekTop) != 'undefined') {
        $('#BRcontainer').scrollTop( seekTop );
    }

    var scrollTop = $('#BRcontainer').prop('scrollTop');
    var scrollBottom = scrollTop + $('#BRcontainer').height();

    var leafTop = 0;
    var leafBottom = 0;
    var rowsToDisplay = [];

    // Visible leafs with least/greatest index
    var leastVisible = this.numLeafs - 1;
    var mostVisible = 0;

    // Determine the thumbnails in view
    for (i=0; i<leafMap.length; i++) {
        leafBottom += this.thumbPadding + leafMap[i].height;
        var topInView    = (leafTop >= scrollTop) && (leafTop <= scrollBottom);
        var bottomInView = (leafBottom >= scrollTop) && (leafBottom <= scrollBottom);
        var middleInView = (leafTop <=scrollTop) && (leafBottom>=scrollBottom);
        if (topInView || bottomInView || middleInView) {
            //console.log('row to display: ' + j);
            rowsToDisplay.push(i);
            if (leafMap[i].leafs[0].num < leastVisible) {
                leastVisible = leafMap[i].leafs[0].num;
            }
            if (leafMap[i].leafs[leafMap[i].leafs.length - 1].num > mostVisible) {
                mostVisible = leafMap[i].leafs[leafMap[i].leafs.length - 1].num;
            }
        }
        if (leafTop > leafMap[i].top) { leafMap[i].top = leafTop; }
        leafTop = leafBottom;
    }

    // create a buffer of preloaded rows before and after the visible rows
    var firstRow = rowsToDisplay[0];
    var lastRow = rowsToDisplay[rowsToDisplay.length-1];
    for (i=1; i<this.thumbRowBuffer+1; i++) {
        if (lastRow+i < leafMap.length) { rowsToDisplay.push(lastRow+i); }
    }
    for (i=1; i<this.thumbRowBuffer+1; i++) {
        if (firstRow-i >= 0) { rowsToDisplay.push(firstRow-i); }
    }

    // Create the thumbnail divs and images (lazy loaded)
    var j;
    var row;
    var left;
    var index;
    var div;
    var link;
    var img;
    var page;
    for (i=0; i<rowsToDisplay.length; i++) {
        if (BookReader.util.notInArray(rowsToDisplay[i], this.displayedRows)) {
            row = rowsToDisplay[i];

            for (j=0; j<leafMap[row].leafs.length; j++) {
                index = j;
                leaf = leafMap[row].leafs[j].num;

                leafWidth = this.thumbWidth;
                leafHeight = parseInt((this.getPageHeight(leaf)*this.thumbWidth)/this.getPageWidth(leaf), 10);
                leafTop = leafMap[row].top;
                left = leafMap[row].leafs[index].left + pageViewBuffer;
                if ('rl' == this.pageProgression){
                    left = viewWidth - leafWidth - left;
                }

                div = document.createElement("div");
                div.id = 'pagediv'+leaf;
                div.style.position = "absolute";
                div.className = "BRpagedivthumb";

                left += this.thumbPadding;
                div.style.top = leafTop + 'px';
                div.style.left = left + 'px';
                div.style.width = leafWidth + 'px';
                div.style.height = leafHeight + 'px';
                //$(div).text('loading...');

                // link to page in single page mode
                link = document.createElement("a");
                $(link).data('leaf', leaf);
                link.addEventListener('mouseup', function(event) {
                  self.firstIndex = $(this).data('leaf');
                  if (self._prevReadMode !== undefined) {
                    self.switchMode(self._prevReadMode);
                  } else {
                    self.switchMode(self.constMode1up);
                  }
                  event.preventDefault();
                  event.stopPropagation();
                }, true);
                $(div).append(link);

                $('#BRpageview').append(div);

                img = document.createElement("img");
                var thumbReduce = Math.floor(this.getPageWidth(leaf) / this.thumbWidth);

                $(img).attr('src', this.imagesBaseURL + 'transparent.png')
                    .css({'width': leafWidth+'px', 'height': leafHeight+'px' })
                    .addClass('BRlazyload')
                    // Store the URL of the image that will replace this one
                    .data('srcURL',  this._getPageURI(leaf, thumbReduce));
                $(link).append(img);
                //console.log('displaying thumbnail: ' + leaf);
            }
        }
    }

    // Remove thumbnails that are not to be displayed
    var k;
    for (i=0; i<this.displayedRows.length; i++) {
        if (BookReader.util.notInArray(this.displayedRows[i], rowsToDisplay)) {
            row = this.displayedRows[i];

            // $$$ Safari doesn't like the comprehension
            //var rowLeafs =  [leaf.num for each (leaf in leafMap[row].leafs)];
            //console.log('Removing row ' + row + ' ' + rowLeafs);

            for (k=0; k<leafMap[row].leafs.length; k++) {
                index = leafMap[row].leafs[k].num;
                //console.log('Removing leaf ' + index);
                $('#pagediv'+index).remove();
            }
        } else {
            // var mRow = this.displayedRows[i];
            // var mLeafs = '[' +  [leaf.num for each (leaf in leafMap[mRow].leafs)] + ']';
            // console.log('NOT Removing row ' + mRow + ' ' + mLeafs);
        }
    }

    // Update which page is considered current to make sure a visible page is the current one
    var currentIndex = this.currentIndex();
    if (currentIndex < leastVisible) {
        this.setCurrentIndex(leastVisible);
    } else if (currentIndex > mostVisible) {
        this.setCurrentIndex(mostVisible);
    }
    this.updateNavIndexThrottled();

    this.displayedRows = rowsToDisplay.slice();

    // Update hash, but only if we're currently displaying a leaf
    // Hack that fixes #365790
    if (this.displayedRows.length > 0) {
        this.updateLocationHash();
    }

    // remove previous highlights
    $('.BRpagedivthumb_highlight').removeClass('BRpagedivthumb_highlight');

    // highlight current page
    $('#pagediv'+this.currentIndex()).addClass('BRpagedivthumb_highlight');

    this.lazyLoadThumbnails();

    // Update page number box.  $$$ refactor to function
    if (null !== this.getPageNum(this.currentIndex()))  {
        $("#BRpagenum").val(this.getPageNum(this.currentIndex()));
    } else {
        $("#BRpagenum").val('');
    }

    this.updateToolbarZoom(this.reduce);
};

BookReader.prototype.lazyLoadThumbnails = function() {

    // console.log('lazy load');

    // We check the complete property since load may not be fired if loading from the cache
    $('.BRlazyloading').filter('[complete=true]').removeClass('BRlazyloading');

    var loading = $('.BRlazyloading').length;
    var toLoad = this.thumbMaxLoading - loading;

    // console.log('  ' + loading + ' thumbnails loading');
    // console.log('  this.thumbMaxLoading ' + this.thumbMaxLoading);

    var self = this;

    if (toLoad > 0) {
        // $$$ TODO load those near top (but not beyond) page view first
        $('#BRpageview img.BRlazyload').filter(':lt(' + toLoad + ')').each( function() {
            self.lazyLoadImage(this);
        });
    }
};

BookReader.prototype.lazyLoadImage = function (dummyImage) {
    //console.log(' lazy load started for ' + $(dummyImage).data('srcURL').match('([0-9]{4}).jp2')[1] );

    var img = new Image();
    var self = this;

    $(img)
        .addClass('BRlazyloading')
        .one('load', function() {
            //if (console) { console.log(' onload ' + $(this).attr('src').match('([0-9]{4}).jp2')[1]); };

            $(this).removeClass('BRlazyloading');

            // $$$ Calling lazyLoadThumbnails here was causing stack overflow on IE so
            //     we call the function after a slight delay.  Also the img.complete property
            //     is not yet set in IE8 inside this onload handler
            setTimeout(function() { self.lazyLoadThumbnails(); }, 100);
        })
        .one('error', function() {
            // Remove class so we no longer count as loading
            $(this).removeClass('BRlazyloading');
        })

        //the width set with .attr is ignored by Internet Explorer, causing it to show the image at its original size
        //but with this one line of css, even IE shows the image at the proper size
        .css({
            'width': $(dummyImage).width()+'px',
            'height': $(dummyImage).height()+'px'
        })
        .attr({
            'width': $(dummyImage).width(),
            'height': $(dummyImage).height(),
            'src': $(dummyImage).data('srcURL')
        });

    // replace with the new img
    $(dummyImage).before(img).remove();

    img = null; // tidy up closure
};


// drawLeafsTwoPage()
//______________________________________________________________________________
BookReader.prototype.drawLeafsTwoPage = function() {
    var scrollTop = $('#BRtwopageview').prop('scrollTop');
    var scrollBottom = scrollTop + $('#BRtwopageview').height();

    // $$$ we should use calculated values in this.twoPage (recalc if necessary)

    var indexL = this.twoPage.currentIndexL;

    var heightL  = this._getPageHeight(indexL);
    var widthL   = this._getPageWidth(indexL);

    var leafEdgeWidthL = this.leafEdgeWidth(indexL);
    var leafEdgeWidthR = this.twoPage.edgeWidth - leafEdgeWidthL;
    //var bookCoverDivWidth = this.twoPage.width*2 + 20 + this.twoPage.edgeWidth; // $$$ hardcoded cover width
    var bookCoverDivWidth = this.twoPage.bookCoverDivWidth;
    //console.log(leafEdgeWidthL);

    var middle = this.twoPage.middle; // $$$ getter instead?
    var top = this.twoPageTop();
    var bookCoverDivLeft = this.twoPage.bookCoverDivLeft;

    this.twoPage.scaledWL = this.getPageWidth2UP(indexL);
    this.twoPage.gutter = this.twoPageGutter();

    this.prefetchImg(indexL);
    $(this.prefetchedImgs[indexL]).css({
        position: 'absolute',
        left: this.twoPage.gutter-this.twoPage.scaledWL+'px',
        right: '',
        top:    top+'px',
        height: this.twoPage.height +'px', // $$$ height forced the same for both pages
        width:  this.twoPage.scaledWL + 'px',
        zIndex: 2
    }).appendTo('#BRtwopageview');

    var indexR = this.twoPage.currentIndexR;
    var heightR  = this._getPageHeight(indexR);
    var widthR   = this._getPageWidth(indexR);

    // $$$ should use getwidth2up?
    //var scaledWR = this.twoPage.height*widthR/heightR;
    this.twoPage.scaledWR = this.getPageWidth2UP(indexR);
    this.prefetchImg(indexR);
    $(this.prefetchedImgs[indexR]).css({
        position: 'absolute',
        left:   this.twoPage.gutter+'px',
        right: '',
        top:    top+'px',
        height: this.twoPage.height + 'px', // $$$ height forced the same for both pages
        width:  this.twoPage.scaledWR + 'px',
        zIndex: 2
    }).appendTo('#BRtwopageview');


    this.displayedIndices = [this.twoPage.currentIndexL, this.twoPage.currentIndexR];
    this.setMouseHandlers2UP();
    this.twoPageSetCursor();

    this.updatePageNumBox2UP();
    this.updateToolbarZoom(this.reduce);

    // this.twoPagePlaceFlipAreas();  // No longer used

};

// updatePageNumBox2UP
//______________________________________________________________________________
BookReader.prototype.updatePageNumBox2UP = function() {
    if (null != this.getPageNum(this.twoPage.currentIndexL))  {
        $("#BRpagenum").val(this.getPageNum(this.currentIndex()));
    } else {
        $("#BRpagenum").val('');
    }
    this.updateLocationHash();
};

// drawLeafsThrottled()
// A throttled version of drawLeafs
//______________________________________________________________________________
BookReader.prototype.drawLeafsThrottled = BookReader.prototype.throttle(
    BookReader.prototype.drawLeafs,
    250 // 250 ms gives quick feedback, but doesn't eat cpu
);


// zoom(direction)
//
// Pass 1 to zoom in, anything else to zoom out
//______________________________________________________________________________
BookReader.prototype.zoom = function(direction) {
    switch (this.mode) {
        case this.constMode1up:
            if (direction == 1) {
                // XXX other cases
                this.zoom1up('in');
            } else {
                this.zoom1up('out');
            }
            break
        case this.constMode2up:
            if (direction == 1) {
                // XXX other cases
                this.zoom2up('in');
            } else {
                this.zoom2up('out');
            }
            break
        case this.constModeThumb:
            // XXX update zoomThumb for named directions
            this.zoomThumb(direction);
            break
    }
    return;
};

// zoom1up(dir)
//______________________________________________________________________________
BookReader.prototype.zoom1up = function(direction) {

    if (this.constMode2up == this.mode) {     //can only zoom in 1-page mode
        this.switchMode(this.constMode1up);
        return;
    }

    var reduceFactor = this.nextReduce(this.reduce, direction, this.onePage.reductionFactors);

    if (this.reduce == reduceFactor.reduce) {
        // Already at this level
        return;
    }

    this.reduce = reduceFactor.reduce; // $$$ incorporate into function
    this.onePage.autofit = reduceFactor.autofit;

    this.pageScale = this.reduce; // preserve current reduce

    this.resizePageView();
    this.updateToolbarZoom(this.reduce);

    // Recalculate search hilites
    this.removeSearchHilites();
    this.updateSearchHilites();

};

// Resizes the inner container to fit within the visible space to prevent
// the top toolbar and bottom navbar from clipping the visible book
BookReader.prototype.resizeBRcontainer = function() {
  $('#BRcontainer').css({
    top: this.getToolBarHeight(),
    bottom: this.getNavHeight(),
  });
}

// resizePageView()
//______________________________________________________________________________
BookReader.prototype.resizePageView = function() {
    // $$$ This code assumes 1up mode
    //     e.g. does not preserve position in thumbnail mode
    //     See http://bugs.launchpad.net/bookreader/+bug/552972
    switch (this.mode) {
        case this.constMode1up:
            this.resizePageView1up(); // $$$ necessary in non-1up mode?
            break;
        case this.constMode2up:
            break;
        case this.constModeThumb:
            this.prepareThumbnailView( this.currentIndex() );
            break;
        default:
            alert('Resize not implemented for this mode');
    }
};

// Resize the current one page view
// Note this calls drawLeafs
BookReader.prototype.resizePageView1up = function() {
    // console.log('resizePageView1up');
    var i;
    var viewHeight = 0;
    //var viewWidth  = $('#BRcontainer').width(); //includes scrollBar
    var viewWidth  = $('#BRcontainer').prop('clientWidth');

    var oldScrollTop  = $('#BRcontainer').prop('scrollTop');
    //var oldScrollLeft = $('#BRcontainer').prop('scrollLeft');

    var oldPageViewHeight = $('#BRpageview').height();
    var oldPageViewWidth = $('#BRpageview').width();

    // May have come here after preparing the view, in which case the scrollTop and view height are not set

    var scrollRatio = 0;
    if (oldScrollTop > 0) {
        // We have scrolled - implies view has been set up
        var oldCenterY = this.centerY1up();
        var oldCenterX = this.centerX1up();
        scrollRatio = oldCenterY / oldPageViewHeight;
    } else {
        // Have not scrolled, e.g. because in new container

        // We set the scroll ratio so that the current index will still be considered the
        // current index in drawLeafsOnePage after we create the new view container

        // Make sure this will count as current page after resize
        // console.log('fudging for index ' + this.currentIndex() + ' (page ' + this.getPageNum(this.currentIndex()) + ')');
        var fudgeFactor = (this.getPageHeight(this.currentIndex()) / this.reduce) * 0.6;
        var oldLeafTop = this.onePageGetPageTop(this.currentIndex()) + fudgeFactor;
        var oldViewDimensions = this.onePageCalculateViewDimensions(this.reduce, this.padding);
        scrollRatio = oldLeafTop / oldViewDimensions.height;
    }

    // Recalculate 1up reduction factors
    this.onePageCalculateReductionFactors();
    // Update current reduce (if in autofit)
    if (this.onePage.autofit) {
        var reductionFactor = this.nextReduce(this.reduce, this.onePage.autofit, this.onePage.reductionFactors);
        this.reduce = reductionFactor.reduce;
    }

    var viewDimensions = this.onePageCalculateViewDimensions(this.reduce, this.padding);

    $('#BRpageview').height(viewDimensions.height);
    $('#BRpageview').width(viewDimensions.width);


    var newCenterY = scrollRatio*viewDimensions.height;
    var newTop = Math.max(0, Math.floor( newCenterY - $('#BRcontainer').height()/2 ));
    $('#BRcontainer').prop('scrollTop', newTop);

    // We use clientWidth here to avoid miscalculating due to scroll bar
    var newCenterX = oldCenterX * (viewWidth / oldPageViewWidth);
    var newLeft = newCenterX - $('#BRcontainer').prop('clientWidth') / 2;
    newLeft = Math.max(newLeft, 0);
    $('#BRcontainer').prop('scrollLeft', newLeft);
    //console.log('oldCenterX ' + oldCenterX + ' newCenterX ' + newCenterX + ' newLeft ' + newLeft);

    $('#BRpageview').empty();
    this.displayedIndices = [];
    this.drawLeafs();

    this.removeSearchHilites();
    this.updateSearchHilites();
};

// Calculate the dimensions for a one page view with images at the given reduce and padding
BookReader.prototype.onePageCalculateViewDimensions = function(reduce, padding) {
    var viewWidth = 0;
    var viewHeight = 0;
    for (i=0; i<this.numLeafs; i++) {
        viewHeight += parseInt(this._getPageHeight(i)/reduce) + padding;
        var width = parseInt(this._getPageWidth(i)/reduce);
        if (width>viewWidth) viewWidth=width;
    }
    return { width: viewWidth, height: viewHeight }
};

// centerX1up()
//______________________________________________________________________________
// Returns the current offset of the viewport center in scaled document coordinates.
BookReader.prototype.centerX1up = function() {
    var centerX;
    if ($('#BRpageview').width() < $('#BRcontainer').prop('clientWidth')) { // fully shown
        centerX = $('#BRpageview').width();
    } else {
        centerX = $('#BRcontainer').prop('scrollLeft') + $('#BRcontainer').prop('clientWidth') / 2;
    }
    centerX = Math.floor(centerX);
    return centerX;
};

// centerY1up()
//______________________________________________________________________________
// Returns the current offset of the viewport center in scaled document coordinates.
BookReader.prototype.centerY1up = function() {
    var centerY = $('#BRcontainer').prop('scrollTop') + $('#BRcontainer').height() / 2;
    return Math.floor(centerY);
};

// centerPageView()
//______________________________________________________________________________
BookReader.prototype.centerPageView = function() {
    var scrollWidth  = $('#BRcontainer').prop('scrollWidth');
    var clientWidth  =  $('#BRcontainer').prop('clientWidth');
    if (scrollWidth > clientWidth) {
        $('#BRcontainer').prop('scrollLeft', (scrollWidth-clientWidth)/2);
    }
};

// zoom2up(direction)
//______________________________________________________________________________
BookReader.prototype.zoom2up = function(direction) {

    // Hard stop autoplay
    this.stopFlipAnimations();

    // Recalculate autofit factors
    this.twoPageCalculateReductionFactors();

    // Get new zoom state
    var reductionFactor = this.nextReduce(this.reduce, direction, this.twoPage.reductionFactors);
    if ((this.reduce == reductionFactor.reduce) && (this.twoPage.autofit == reductionFactor.autofit)) {
        // Same zoom
        return;
    }
    this.twoPage.autofit = reductionFactor.autofit;
    this.reduce = reductionFactor.reduce;
    this.pageScale = this.reduce; // preserve current reduce

    // Preserve view center position
    var oldCenter = this.twoPageGetViewCenter();

    // If zooming in, reload imgs.  DOM elements will be removed by prepareTwoPageView
    // $$$ An improvement would be to use the low res image until the larger one is loaded.
    if (1 == direction) {
        for (var img in this.prefetchedImgs) {
            delete this.prefetchedImgs[img];
        }
    }

    // Prepare view with new center to minimize visual glitches
    this.prepareTwoPageView(oldCenter.percentageX, oldCenter.percentageY);
};

BookReader.prototype.zoomThumb = function(direction) {
    var oldColumns = this.thumbColumns;
    switch (direction) {
        case -1:
            this.thumbColumns += 1;
            break;
        case 1:
            this.thumbColumns -= 1;
            break;
    }

    // clamp
    if (this.thumbColumns < 2) {
        this.thumbColumns = 2;
    } else if (this.thumbColumns > 8) {
        this.thumbColumns = 8;
    }

    if (this.thumbColumns != oldColumns) {
        this.prepareThumbnailView();
    }
};

// Returns the width per thumbnail to display the requested number of columns
// Note: #BRpageview must already exist since its width is used to calculate the
//       thumbnail width
BookReader.prototype.getThumbnailWidth = function(thumbnailColumns) {
    var padding = (thumbnailColumns + 1) * this.thumbPadding;
    var width = ($('#BRpageview').width() - padding) / (thumbnailColumns + 0.5); // extra 0.5 is for some space at sides
    return parseInt(width);
};

// quantizeReduce(reduce)
//______________________________________________________________________________
// Quantizes the given reduction factor to closest power of two from set from 12.5% to 200%
BookReader.prototype.quantizeReduce = function(reduce, reductionFactors) {
    var quantized = reductionFactors[0].reduce;
    var distance = Math.abs(reduce - quantized);
    for (var i = 1; i < reductionFactors.length; i++) {
        newDistance = Math.abs(reduce - reductionFactors[i].reduce);
        if (newDistance < distance) {
            distance = newDistance;
            quantized = reductionFactors[i].reduce;
        }
    }

    return quantized;
};

// reductionFactors should be array of sorted reduction factors
// e.g. [ {reduce: 0.25, autofit: null}, {reduce: 0.3, autofit: 'width'}, {reduce: 1, autofit: null} ]
BookReader.prototype.nextReduce = function( currentReduce, direction, reductionFactors ) {

    // XXX add 'closest', to replace quantize function

    if (direction == 'in') {
        var newReduceIndex = 0;

        for (var i = 1; i < reductionFactors.length; i++) {
            if (reductionFactors[i].reduce < currentReduce) {
                newReduceIndex = i;
            }
        }
        return reductionFactors[newReduceIndex];

    } else if (direction == 'out') { // zoom out
        var lastIndex = reductionFactors.length - 1;
        var newReduceIndex = lastIndex;

        for (var i = lastIndex; i >= 0; i--) {
            if (reductionFactors[i].reduce > currentReduce) {
                newReduceIndex = i;
            }
        }
        return reductionFactors[newReduceIndex];
    }

    // Asked for specific autofit mode
    for (var i = 0; i < reductionFactors.length; i++) {
        if (reductionFactors[i].autofit == direction) {
            return reductionFactors[i];
        }
    }

    alert('Could not find reduction factor for direction ' + direction);
    return reductionFactors[0];

};

BookReader.prototype._reduceSort = function(a, b) {
    return a.reduce - b.reduce;
};

// jumpToPage()
//______________________________________________________________________________
// Attempts to jump to page.  Returns true if page could be found, false otherwise.
BookReader.prototype.jumpToPage = function(pageNum) {

    var pageIndex;

    // Check for special "leaf"
    var re = new RegExp('^leaf(\\d+)');
    leafMatch = re.exec(pageNum);
    if (leafMatch) {
        pageIndex = this.leafNumToIndex(parseInt(leafMatch[1],10));
        if (pageIndex === null) {
            pageIndex = undefined; // to match return type of getPageIndex
        }

    } else {
        pageIndex = this.getPageIndex(pageNum);
    }

    if ('undefined' != typeof(pageIndex)) {
        this.jumpToIndex(pageIndex);
        return true;
    }

    // Page not found
    return false;
};

// jumpToIndex()
//______________________________________________________________________________
BookReader.prototype.jumpToIndex = function(index, pageX, pageY, noAnimate) {
    // console.log('jumpToIndex', index);
    var self = this;
    var prevCurrentIndex = this.currentIndex();

    // Not throttling is important to prevent race conditions with scroll
    this.updateNavIndexThrottled(index);
    this.ttsStop();

    if (this.constMode2up == this.mode) {
        this.autoStop();

        // By checking against min/max we do nothing if requested index
        // is current
        if (index < Math.min(this.twoPage.currentIndexL, this.twoPage.currentIndexR)) {
            this.flipBackToIndex(index);
        } else if (index > Math.max(this.twoPage.currentIndexL, this.twoPage.currentIndexR)) {
            this.flipFwdToIndex(index);
        }

    } else if (this.constModeThumb == this.mode) {
        var viewWidth = $('#BRcontainer').prop('scrollWidth') - 20; // width minus buffer
        var i;
        var leafWidth = 0;
        var leafHeight = 0;
        var rightPos = 0;
        var bottomPos = 0;
        var rowHeight = 0;
        var leafTop = 0;
        var leafIndex = 0;

        for (i=0; i<(index+1); i++) {
            leafWidth = this.thumbWidth;
            if (rightPos + (leafWidth + this.thumbPadding) > viewWidth){
                rightPos = 0;
                rowHeight = 0;
                leafIndex = 0;
            }

            leafHeight = parseInt((this.getPageHeight(leafIndex)*this.thumbWidth)/this.getPageWidth(leafIndex), 10);
            if (leafHeight > rowHeight) { rowHeight = leafHeight; }
            if (leafIndex==0) { leafTop = bottomPos; }
            if (leafIndex==0) { bottomPos += this.thumbPadding + rowHeight; }
            rightPos += leafWidth + this.thumbPadding;
            leafIndex++;
        }
        this.firstIndex=index;
        if ($('#BRcontainer').prop('scrollTop') == leafTop) {
            this.drawLeafs();
        } else {
            this.animating = true;
            $('#BRcontainer').stop(true).animate({
                scrollTop: leafTop,
            }, 'fast', function() {
                self.animating = false;
            });
        }
    } else {
        // 1up
        var leafTop = this.onePageGetPageTop(index);

        if (pageY) {
            //console.log('pageY ' + pageY);
            var offset = parseInt( (pageY) / this.reduce);
            offset -= $('#BRcontainer').prop('clientHeight') >> 1;
            //console.log( 'jumping to ' + leafTop + ' ' + offset);
            leafTop += offset;
        } else {
            // Show page just a little below the top
            leafTop -= this.padding / 2;
        }

        if (pageX) {
            var offset = parseInt( (pageX) / this.reduce);
            offset -= $('#BRcontainer').prop('clientWidth') >> 1;
            leafLeft += offset;
        } else {
            // Preserve left position
            leafLeft = $('#BRcontainer').scrollLeft();
        }

        // Only animate for small distances
        if (!noAnimate && Math.abs(prevCurrentIndex - index) <= 4) {
            this.animating = true;
            $('#BRcontainer').stop(true).animate({
                scrollTop: leafTop,
                scrollLeft: leafLeft,
            }, 'fast', function() {
                self.animating = false;
            });
        } else {
            $('#BRcontainer').stop(true).prop('scrollTop', leafTop);
        }
    }
};

// switchMode()
//______________________________________________________________________________
BookReader.prototype.switchMode = function(mode) {

    if (mode == this.mode) {
        return;
    }

    if (!this.canSwitchToMode(mode)) {
        return;
    }

    this.autoStop();
    this.ttsStop();
    this.removeSearchHilites();

    if (this.mode == this.constMode1up || this.mode == this.constMode2up) {
      this._prevReadMode = this.mode;
    }

    this.mode = mode;
    //this.switchToolbarMode(mode);

    // reinstate scale if moving from thumbnail view
    if (this.pageScale != this.reduce) {
        this.reduce = this.pageScale;
    }

    // $$$ TODO preserve center of view when switching between mode
    //     See https://bugs.edge.launchpad.net/gnubook/+bug/416682

    // XXX maybe better to preserve zoom in each mode
    if (this.constMode1up == mode) {
        this.onePageCalculateReductionFactors();
        this.reduce = this.quantizeReduce(this.reduce, this.onePage.reductionFactors);
        this.prepareOnePageView();
    } else if (this.constModeThumb == mode) {
        this.reduce = this.quantizeReduce(this.reduce, this.reductionFactors);
        this.prepareThumbnailView();
    } else {
        // $$$ why don't we save autofit?
        // this.twoPage.autofit = null; // Take zoom level from other mode
        this.twoPageCalculateReductionFactors();
        this.reduce = this.quantizeReduce(this.reduce, this.twoPage.reductionFactors);
        this.prepareTwoPageView();
        this.twoPageCenterView(0.5, 0.5); // $$$ TODO preserve center
    }

};

//prepareOnePageView()
// This is called when we switch to one page view
//______________________________________________________________________________
BookReader.prototype.prepareOnePageView = function() {
    var startLeaf = this.currentIndex();

    $('#BRcontainer').empty();
    $('#BRcontainer').css({
        overflowY: 'scroll',
        overflowX: 'auto'
    });

    $("#BRcontainer").append("<div id='BRpageview'></div>");

    // Attaches to first child - child must be present
    $('#BRcontainer').dragscrollable();
    this.bindGestures($('#BRcontainer'));

    // $$$ keep select enabled for now since disabling it breaks keyboard
    //     nav in FF 3.6 (https://bugs.edge.launchpad.net/bookreader/+bug/544666)
    // BookReader.util.disableSelect($('#BRpageview'));

    this.resizePageView();
    this.jumpToIndex(startLeaf);
};

//prepareThumbnailView()
//______________________________________________________________________________
BookReader.prototype.prepareThumbnailView = function() {

    $('#BRcontainer').empty();
    $('#BRcontainer').css({
        overflowY: 'scroll',
        overflowX: 'auto'
    });

    $("#BRcontainer").append("<div id='BRpageview'></div>");

    $('#BRcontainer').dragscrollable({preventDefault:true});

    this.bindGestures($('#BRcontainer'));

    // $$$ keep select enabled for now since disabling it breaks keyboard
    //     nav in FF 3.6 (https://bugs.edge.launchpad.net/bookreader/+bug/544666)
    // BookReader.util.disableSelect($('#BRpageview'));

    this.thumbWidth = this.getThumbnailWidth(this.thumbColumns);
    this.reduce = this.getPageWidth(0)/this.thumbWidth;

    this.displayedRows = [];

    // Draw leafs with current index directly in view (no animating to the index)
    this.drawLeafsThumbnail( this.currentIndex() );
};

// prepareTwoPageView()
//______________________________________________________________________________
// Some decisions about two page view:
//
// Both pages will be displayed at the same height, even if they were different physical/scanned
// sizes.  This simplifies the animation (from a design as well as technical standpoint).  We
// examine the page aspect ratios (in calculateSpreadSize) and use the page with the most "normal"
// aspect ratio to determine the height.
//
// The two page view div is resized to keep the middle of the book in the middle of the div
// even as the page sizes change.  To e.g. keep the middle of the book in the middle of the BRcontent
// div requires adjusting the offset of BRtwpageview and/or scrolling in BRcontent.
BookReader.prototype.prepareTwoPageView = function(centerPercentageX, centerPercentageY) {
    $('#BRcontainer').empty();
    $('#BRcontainer').css('overflow', 'auto');

    // We want to display two facing pages.  We may be missing
    // one side of the spread because it is the first/last leaf,
    // foldouts, missing pages, etc

    //var targetLeaf = this.displayedIndices[0];
    var targetLeaf = this.firstIndex;

    if (targetLeaf < this.firstDisplayableIndex()) {
        targetLeaf = this.firstDisplayableIndex();
    }

    if (targetLeaf > this.lastDisplayableIndex()) {
        targetLeaf = this.lastDisplayableIndex();
    }

    //this.twoPage.currentIndexL = null;
    //this.twoPage.currentIndexR = null;
    //this.pruneUnusedImgs();

    var currentSpreadIndices = this.getSpreadIndices(targetLeaf);
    this.twoPage.currentIndexL = currentSpreadIndices[0];
    this.twoPage.currentIndexR = currentSpreadIndices[1];
    this.firstIndex = this.twoPage.currentIndexL;

    this.calculateSpreadSize(); //sets twoPage.width, twoPage.height and others

    this.pruneUnusedImgs();
    this.prefetch(); // Preload images or reload if scaling has changed

    //console.dir(this.twoPage);

    // Add the two page view
    // $$$ Can we get everything set up and then append?
    $('#BRcontainer').append('<div id="BRtwopageview"></div>');

    // Attaches to first child, so must come after we add the page view
    $('#BRcontainer').dragscrollable({preventDefault:true});
    this.bindGestures($('#BRcontainer'));

    // $$$ calculate first then set
    $('#BRtwopageview').css( {
        height: this.twoPage.totalHeight + 'px',
        width: this.twoPage.totalWidth + 'px',
        position: 'absolute'
        });

    // If there will not be scrollbars (e.g. when zooming out) we center the book
    // since otherwise the book will be stuck off-center
    if (this.twoPage.totalWidth < $('#BRcontainer').prop('clientWidth')) {
        centerPercentageX = 0.5;
    }
    if (this.twoPage.totalHeight < $('#BRcontainer').prop('clientHeight')) {
        centerPercentageY = 0.5;
    }

    this.twoPageCenterView(centerPercentageX, centerPercentageY);

    this.twoPage.coverDiv = document.createElement('div');
    $(this.twoPage.coverDiv).attr('id', 'BRbookcover').css({
        width:  this.twoPage.bookCoverDivWidth + 'px',
        height: this.twoPage.bookCoverDivHeight+'px',
        visibility: 'visible'
    }).appendTo('#BRtwopageview');

    this.leafEdgeR = document.createElement('div');
    this.leafEdgeR.className = 'BRleafEdgeR';
    $(this.leafEdgeR).css({
        width: this.twoPage.leafEdgeWidthR + 'px',
        height: this.twoPage.height + 'px',
        left: this.twoPage.gutter+this.twoPage.scaledWR+'px',
        top: this.twoPage.bookCoverDivTop+this.twoPage.coverInternalPadding+'px'
    }).appendTo('#BRtwopageview');

    this.leafEdgeL = document.createElement('div');
    this.leafEdgeL.className = 'BRleafEdgeL';
    $(this.leafEdgeL).css({
        width: this.twoPage.leafEdgeWidthL + 'px',
        height: this.twoPage.height + 'px',
        left: this.twoPage.bookCoverDivLeft+this.twoPage.coverInternalPadding+'px',
        top: this.twoPage.bookCoverDivTop+this.twoPage.coverInternalPadding+'px'
    }).appendTo('#BRtwopageview');

    div = document.createElement('div');
    $(div).attr('id', 'BRgutter').css({
        width:           this.twoPage.bookSpineDivWidth+'px',
        height:          this.twoPage.bookSpineDivHeight+'px',
        left:            (this.twoPage.gutter - this.twoPage.bookSpineDivWidth*0.5)+'px',
        top:             this.twoPage.bookSpineDivTop+'px'
    }).appendTo('#BRtwopageview');

    var self = this; // for closure

    /* Flip areas no longer used
    this.twoPage.leftFlipArea = document.createElement('div');
    this.twoPage.leftFlipArea.className = 'BRfliparea';
    $(this.twoPage.leftFlipArea).attr('id', 'BRleftflip').css({
        border: '0',
        width:  this.twoPageFlipAreaWidth() + 'px',
        height: this.twoPageFlipAreaHeight() + 'px',
        position: 'absolute',
        left:   this.twoPageLeftFlipAreaLeft() + 'px',
        top:    this.twoPageFlipAreaTop() + 'px',
        cursor: 'w-resize',
        zIndex: 100
    }).click(function(e) {
        self.left();
    }).bind('mousedown', function(e) {
        e.preventDefault();
    }).appendTo('#BRtwopageview');

    this.twoPage.rightFlipArea = document.createElement('div');
    this.twoPage.rightFlipArea.className = 'BRfliparea';
    $(this.twoPage.rightFlipArea).attr('id', 'BRrightflip').css({
        border: '0',
        width:  this.twoPageFlipAreaWidth() + 'px',
        height: this.twoPageFlipAreaHeight() + 'px',
        position: 'absolute',
        left:   this.twoPageRightFlipAreaLeft() + 'px',
        top:    this.twoPageFlipAreaTop() + 'px',
        cursor: 'e-resize',
        zIndex: 100
    }).click(function(e) {
        self.right();
    }).bind('mousedown', function(e) {
        e.preventDefault();
    }).appendTo('#BRtwopageview');
    */

    this.prepareTwoPagePopUp();

    this.displayedIndices = [];

    //this.indicesToDisplay=[firstLeaf, firstLeaf+1];
    //console.log('indicesToDisplay: ' + this.indicesToDisplay[0] + ' ' + this.indicesToDisplay[1]);

    this.drawLeafsTwoPage();
    this.updateToolbarZoom(this.reduce);

    this.prefetch();

    this.removeSearchHilites();
    this.updateSearchHilites();

};

// prepareTwoPagePopUp()
//
// This function prepares the "View Page n" popup that shows while the mouse is
// over the left/right "stack of sheets" edges.  It also binds the mouse
// events for these divs.
//______________________________________________________________________________
BookReader.prototype.prepareTwoPagePopUp = function() {

    this.twoPagePopUp = document.createElement('div');
    this.twoPagePopUp.className = 'BRtwoPagePopUp';
    $(this.twoPagePopUp).css({
        zIndex: '1000'
    }).appendTo('#BRcontainer');
    $(this.twoPagePopUp).hide();

    $(this.leafEdgeL).add(this.leafEdgeR).bind('mouseenter', this, function(e) {
        $(e.data.twoPagePopUp).show();
    });

    $(this.leafEdgeL).add(this.leafEdgeR).bind('mouseleave', this, function(e) {
        $(e.data.twoPagePopUp).hide();
    });

    $(this.leafEdgeL).bind('click', this, function(e) {
        e.data.autoStop();
        e.data.ttsStop();
        var jumpIndex = e.data.jumpIndexForLeftEdgePageX(e.pageX);
        e.data.jumpToIndex(jumpIndex);
    });

    $(this.leafEdgeR).bind('click', this, function(e) {
        e.data.autoStop();
        e.data.ttsStop();
        var jumpIndex = e.data.jumpIndexForRightEdgePageX(e.pageX);
        e.data.jumpToIndex(jumpIndex);
    });

    $(this.leafEdgeR).bind('mousemove', this, function(e) {

        var jumpIndex = e.data.jumpIndexForRightEdgePageX(e.pageX);
        $(e.data.twoPagePopUp).text('View ' + e.data.getPageName(jumpIndex));

        // $$$ TODO: Make sure popup is positioned so that it is in view
        // (https://bugs.edge.launchpad.net/gnubook/+bug/327456)
        $(e.data.twoPagePopUp).css({
            left: e.pageX- $('#BRcontainer').offset().left + $('#BRcontainer').scrollLeft() - 100 + 'px',
            top: e.pageY - $('#BRcontainer').offset().top + $('#BRcontainer').scrollTop() + 'px'
        });
    });

    $(this.leafEdgeL).bind('mousemove', this, function(e) {

        var jumpIndex = e.data.jumpIndexForLeftEdgePageX(e.pageX);
        $(e.data.twoPagePopUp).text('View '+ e.data.getPageName(jumpIndex));

        // $$$ TODO: Make sure popup is positioned so that it is in view
        //           (https://bugs.edge.launchpad.net/gnubook/+bug/327456)
        $(e.data.twoPagePopUp).css({
            left: e.pageX - $('#BRcontainer').offset().left + $('#BRcontainer').scrollLeft() - $(e.data.twoPagePopUp).width() + 100 + 'px',
            top: e.pageY-$('#BRcontainer').offset().top + $('#BRcontainer').scrollTop() + 'px'
        });
    });
};

// calculateSpreadSize()
//______________________________________________________________________________
// Calculates 2-page spread dimensions based on this.twoPage.currentIndexL and
// this.twoPage.currentIndexR
// This function sets this.twoPage.height, twoPage.width

BookReader.prototype.calculateSpreadSize = function() {

    var firstIndex  = this.twoPage.currentIndexL;
    var secondIndex = this.twoPage.currentIndexR;
    //console.log('first page is ' + firstIndex);

    // Calculate page sizes and total leaf width
    var spreadSize;
    if ( this.twoPage.autofit) {
        spreadSize = this.getIdealSpreadSize(firstIndex, secondIndex);
    } else {
        // set based on reduction factor
        spreadSize = this.getSpreadSizeFromReduce(firstIndex, secondIndex, this.reduce);
    }

    // Both pages together
    this.twoPage.height = spreadSize.height;
    this.twoPage.width = spreadSize.width;

    // Individual pages
    this.twoPage.scaledWL = this.getPageWidth2UP(firstIndex);
    this.twoPage.scaledWR = this.getPageWidth2UP(secondIndex);

    // Leaf edges
    this.twoPage.edgeWidth = spreadSize.totalLeafEdgeWidth; // The combined width of both edges
    this.twoPage.leafEdgeWidthL = this.leafEdgeWidth(this.twoPage.currentIndexL);
    this.twoPage.leafEdgeWidthR = this.twoPage.edgeWidth - this.twoPage.leafEdgeWidthL;


    // Book cover
    // The width of the book cover div.  The combined width of both pages, twice the width
    // of the book cover internal padding (2*10) and the page edges
    this.twoPage.bookCoverDivWidth = this.twoPageCoverWidth(this.twoPage.scaledWL + this.twoPage.scaledWR);
    // The height of the book cover div
    this.twoPage.bookCoverDivHeight = this.twoPage.height + 2 * this.twoPage.coverInternalPadding;


    // We calculate the total width and height for the div so that we can make the book
    // spine centered
    var leftGutterOffset = this.gutterOffsetForIndex(firstIndex);
    var leftWidthFromCenter = this.twoPage.scaledWL - leftGutterOffset + this.twoPage.leafEdgeWidthL;
    var rightWidthFromCenter = this.twoPage.scaledWR + leftGutterOffset + this.twoPage.leafEdgeWidthR;
    var largestWidthFromCenter = Math.max( leftWidthFromCenter, rightWidthFromCenter );
    this.twoPage.totalWidth = 2 * (largestWidthFromCenter + this.twoPage.coverInternalPadding + this.twoPage.coverExternalPadding);
    this.twoPage.totalHeight = this.twoPage.height + 2 * (this.twoPage.coverInternalPadding + this.twoPage.coverExternalPadding);

    // We want to minimize the unused space in two-up mode (maximize the amount of page
    // shown).  We give width to the leaf edges and these widths change (though the sum
    // of the two remains constant) as we flip through the book.  With the book
    // cover centered and fixed in the BRcontainer div the page images will meet
    // at the "gutter" which is generally offset from the center.
    this.twoPage.middle = this.twoPage.totalWidth >> 1;
    this.twoPage.gutter = this.twoPage.middle + this.gutterOffsetForIndex(firstIndex);

    // The left edge of the book cover moves depending on the width of the pages
    // $$$ change to getter
    this.twoPage.bookCoverDivLeft = this.twoPage.gutter - this.twoPage.scaledWL - this.twoPage.leafEdgeWidthL - this.twoPage.coverInternalPadding;
    // The top edge of the book cover stays a fixed distance from the top
    this.twoPage.bookCoverDivTop = this.twoPage.coverExternalPadding;

    // Book spine
    this.twoPage.bookSpineDivHeight = this.twoPage.height + 2*this.twoPage.coverInternalPadding;
    this.twoPage.bookSpineDivLeft = this.twoPage.middle - (this.twoPage.bookSpineDivWidth >> 1);
    this.twoPage.bookSpineDivTop = this.twoPage.bookCoverDivTop;


    this.reduce = spreadSize.reduce; // $$$ really set this here?
};

BookReader.prototype.getIdealSpreadSize = function(firstIndex, secondIndex) {
    var ideal = {};

    // We check which page is closest to a "normal" page and use that to set the height
    // for both pages.  This means that foldouts and other odd size pages will be displayed
    // smaller than the nominal zoom amount.
    var canon5Dratio = 1.5;

    var first = {
        height: this._getPageHeight(firstIndex),
        width: this._getPageWidth(firstIndex)
    };

    var second = {
        height: this._getPageHeight(secondIndex),
        width: this._getPageWidth(secondIndex)
    };

    var firstIndexRatio  = first.height / first.width;
    var secondIndexRatio = second.height / second.width;
    //console.log('firstIndexRatio = ' + firstIndexRatio + ' secondIndexRatio = ' + secondIndexRatio);

    var ratio;
    if (Math.abs(firstIndexRatio - canon5Dratio) < Math.abs(secondIndexRatio - canon5Dratio)) {
        ratio = firstIndexRatio;
    } else {
        ratio = secondIndexRatio;
    }

    var totalLeafEdgeWidth = parseInt(this.numLeafs * 0.1);
    var maxLeafEdgeWidth   = parseInt($('#BRcontainer').prop('clientWidth') * 0.1);
    ideal.totalLeafEdgeWidth     = Math.min(totalLeafEdgeWidth, maxLeafEdgeWidth);

    var widthOutsidePages = 2 * (this.twoPage.coverInternalPadding + this.twoPage.coverExternalPadding) + ideal.totalLeafEdgeWidth;
    var heightOutsidePages = 2* (this.twoPage.coverInternalPadding + this.twoPage.coverExternalPadding);

    ideal.width = ($('#BRcontainer').width() - widthOutsidePages) >> 1;
    ideal.width -= 10; // $$$ fudge factor
    ideal.height = $('#BRcontainer').height() - heightOutsidePages;

    ideal.height -= 15; // fudge factor
    // console.log('init idealWidth='+ideal.width+' idealHeight='+ideal.height + ' ratio='+ratio);

    if (ideal.height/ratio <= ideal.width) {
        //use height
        ideal.width = parseInt(ideal.height/ratio);
    } else {
        //use width
        ideal.height = parseInt(ideal.width*ratio);
    }

    // $$$ check this logic with large spreads
    ideal.reduce = ((first.height + second.height) / 2) / ideal.height;

    return ideal;
};

// getSpreadSizeFromReduce()
//______________________________________________________________________________
// Returns the spread size calculated from the reduction factor for the given pages
BookReader.prototype.getSpreadSizeFromReduce = function(firstIndex, secondIndex, reduce) {
    var spreadSize = {};
    // $$$ Scale this based on reduce?
    var totalLeafEdgeWidth = parseInt(this.numLeafs * 0.1);
    var maxLeafEdgeWidth   = parseInt($('#BRcontainer').prop('clientWidth') * 0.1); // $$$ Assumes leaf edge width constant at all zoom levels
    spreadSize.totalLeafEdgeWidth     = Math.min(totalLeafEdgeWidth, maxLeafEdgeWidth);

    // $$$ Possibly incorrect -- we should make height "dominant"
    var nativeWidth = this._getPageWidth(firstIndex) + this._getPageWidth(secondIndex);
    var nativeHeight = this._getPageHeight(firstIndex) + this._getPageHeight(secondIndex);
    spreadSize.height = parseInt( (nativeHeight / 2) / this.reduce );
    spreadSize.width = parseInt( (nativeWidth / 2) / this.reduce );
    spreadSize.reduce = reduce;

    return spreadSize;
};

// twoPageGetAutofitReduce()
//______________________________________________________________________________
// Returns the current ideal reduction factor
BookReader.prototype.twoPageGetAutofitReduce = function() {
    var spreadSize = this.getIdealSpreadSize(this.twoPage.currentIndexL, this.twoPage.currentIndexR);
    return spreadSize.reduce;
};

// twoPageIsZoomedIn
//______________________________________________________________________________
// Returns true if the pages extend past the edge of the view
BookReader.prototype.twoPageIsZoomedIn = function() {
    var autofitReduce = this.twoPageGetAutofitReduce();
    var isZoomedIn = false;
    if (this.twoPage.autofit != 'auto') {
        if (this.reduce < this.twoPageGetAutofitReduce()) {
            isZoomedIn = true;
        }
    }
    return isZoomedIn;
};

BookReader.prototype.onePageGetAutofitWidth = function() {
    var widthPadding = 20;
    return (this.getMedianPageSize().width + 0.0) / ($('#BRcontainer').prop('clientWidth') - widthPadding * 2);
};

BookReader.prototype.onePageGetAutofitHeight = function() {
    var availableHeight = $('#BRcontainer').innerHeight();
    return (this.getMedianPageSize().height + 0.0) / (availableHeight - this.padding * 2); // make sure a little of adjacent pages show
};

// Returns where the top of the page with given index should be in one page view
BookReader.prototype.onePageGetPageTop = function(index)
{
    var i;
    var leafTop = 0;
    var leafLeft = 0;
    var h;
    for (i=0; i<index; i++) {
        h = parseInt(this._getPageHeight(i)/this.reduce);
        leafTop += h + this.padding;
    }
    return leafTop;
};

BookReader.prototype.getMedianPageSize = function() {
    if (this._medianPageSize) {
        return this._medianPageSize;
    }

    // A little expensive but we just do it once
    var widths = [];
    var heights = [];
    for (var i = 0; i < this.numLeafs; i++) {
        widths.push(this.getPageWidth(i));
        heights.push(this.getPageHeight(i));
    }

    widths.sort();
    heights.sort();

    this._medianPageSize = { width: widths[parseInt(widths.length / 2)], height: heights[parseInt(heights.length / 2)] };
    return this._medianPageSize;
};

// Update the reduction factors for 1up mode given the available width and height.  Recalculates
// the autofit reduction factors.
BookReader.prototype.onePageCalculateReductionFactors = function() {
    this.onePage.reductionFactors = this.reductionFactors.concat(
        [
            { reduce: this.onePageGetAutofitWidth(), autofit: 'width' },
            { reduce: this.onePageGetAutofitHeight(), autofit: 'height'}
        ]);
    this.onePage.reductionFactors.sort(this._reduceSort);
};

BookReader.prototype.twoPageCalculateReductionFactors = function() {
    this.twoPage.reductionFactors = this.reductionFactors.concat(
        [
            { reduce: this.getIdealSpreadSize( this.twoPage.currentIndexL, this.twoPage.currentIndexR ).reduce,
              autofit: 'auto' }
        ]);
    this.twoPage.reductionFactors.sort(this._reduceSort);
};

// twoPageSetCursor()
//______________________________________________________________________________
// Set the cursor for two page view
BookReader.prototype.twoPageSetCursor = function() {
    // console.log('setting cursor');
    if ( ($('#BRtwopageview').width() > $('#BRcontainer').prop('clientWidth')) ||
         ($('#BRtwopageview').height() > $('#BRcontainer').prop('clientHeight')) ) {
        if (this.prefetchedImgs[this.twoPage.currentIndexL])
          this.prefetchedImgs[this.twoPage.currentIndexL].style.cursor = 'move';
        if (this.prefetchedImgs[this.twoPage.currentIndexR])
          this.prefetchedImgs[this.twoPage.currentIndexR].style.cursor = 'move';
    } else {
      if (this.prefetchedImgs[this.twoPage.currentIndexL])
        this.prefetchedImgs[this.twoPage.currentIndexL].style.cursor = '';
      if (this.prefetchedImgs[this.twoPage.currentIndexR])
        this.prefetchedImgs[this.twoPage.currentIndexR].style.cursor = '';
    }
};

// currentIndex()
//______________________________________________________________________________
// Returns the currently active index.
BookReader.prototype.currentIndex = function() {
    // $$$ we should be cleaner with our idea of which index is active in 1up/2up
    if (this.mode == this.constMode1up || this.mode == this.constModeThumb) {
        return this.firstIndex; // $$$ TODO page in center of view would be better
    } else if (this.mode == this.constMode2up) {
        // Only allow indices that are actually present in book
        return BookReader.util.clamp(this.firstIndex, 0, this.numLeafs - 1);
    } else {
        throw 'currentIndex called for unimplemented mode ' + this.mode;
    }
};

// setCurrentIndex(index)
//______________________________________________________________________________
// Sets the idea of current index without triggering other actions such as animation.
// Compare to jumpToIndex which animates to that index
BookReader.prototype.setCurrentIndex = function(index) {
    this.firstIndex = index;
};


// right()
//______________________________________________________________________________
// Flip the right page over onto the left
BookReader.prototype.right = function() {
    if ('rl' != this.pageProgression) {
        // LTR
        this.next();
    } else {
        // RTL
        this.prev();
    }
};

// rightmost()
//______________________________________________________________________________
// Flip to the rightmost page
BookReader.prototype.rightmost = function() {
    if ('rl' != this.pageProgression) {
        this.last();
    } else {
        this.first();
    }
};

// left()
//______________________________________________________________________________
// Flip the left page over onto the right.
BookReader.prototype.left = function() {
    if ('rl' != this.pageProgression) {
        // LTR
        this.prev();
    } else {
        // RTL
        this.next();
    }
};

// leftmost()
//______________________________________________________________________________
// Flip to the leftmost page
BookReader.prototype.leftmost = function() {
    if ('rl' != this.pageProgression) {
        this.first();
    } else {
        this.last();
    }
};

// next()
//______________________________________________________________________________
BookReader.prototype.next = function() {
    if (this.constMode2up == this.mode) {
        this.autoStop();
        this.flipFwdToIndex(null);
    } else {
        if (this.firstIndex < this.lastDisplayableIndex()) {
            this.jumpToIndex(this.firstIndex+1);
        }
    }
};

// prev()
//______________________________________________________________________________
BookReader.prototype.prev = function() {
    if (this.constMode2up == this.mode) {
        this.autoStop();
        this.flipBackToIndex(null);
    } else {
        if (this.firstIndex >= 1) {
            this.jumpToIndex(this.firstIndex-1);
        }
    }
};

BookReader.prototype.first = function() {
    this.jumpToIndex(this.firstDisplayableIndex());
};

BookReader.prototype.last = function() {
    this.jumpToIndex(this.lastDisplayableIndex());
};

// scrollDown()
//______________________________________________________________________________
// Scrolls down one screen view
BookReader.prototype.scrollDown = function() {
    if ($.inArray(this.mode, [this.constMode1up, this.constModeThumb]) >= 0) {
        if ( this.mode == this.constMode1up && (this.reduce >= this.onePageGetAutofitHeight()) ) {
            // Whole pages are visible, scroll whole page only
            return this.next();
        }

        $('#BRcontainer').stop(true).animate(
            { scrollTop: '+=' + this._scrollAmount() + 'px'},
            400, 'easeInOutExpo'
        );
        return true;
    } else {
        return false;
    }
};

// scrollUp()
//______________________________________________________________________________
// Scrolls up one screen view
BookReader.prototype.scrollUp = function() {
    if ($.inArray(this.mode, [this.constMode1up, this.constModeThumb]) >= 0) {
        if ( this.mode == this.constMode1up && (this.reduce >= this.onePageGetAutofitHeight()) ) {
            // Whole pages are visible, scroll whole page only
            return this.prev();
        }

        $('#BRcontainer').stop(true).animate(
            { scrollTop: '-=' + this._scrollAmount() + 'px'},
            400, 'easeInOutExpo'
        );
        return true;
    } else {
        return false;
    }
};

// _scrollAmount()
//______________________________________________________________________________
// The amount to scroll vertically in integer pixels
BookReader.prototype._scrollAmount = function() {
    if (this.constMode1up == this.mode) {
        // Overlap by % of page size
        return parseInt($('#BRcontainer').prop('clientHeight') - this.getPageHeight(this.currentIndex()) / this.reduce * 0.03);
    }

    return parseInt(0.9 * $('#BRcontainer').prop('clientHeight'));
};


// flipBackToIndex()
//______________________________________________________________________________
// to flip back one spread, pass index=null
BookReader.prototype.flipBackToIndex = function(index) {

    if (this.constMode1up == this.mode) return;

    var leftIndex = this.twoPage.currentIndexL;

    if (this.animating) return;

    if (null != this.leafEdgeTmp) {
        alert('error: leafEdgeTmp should be null!');
        return;
    }

    if (null == index) {
        index = leftIndex-2;
    }
    //if (index<0) return;

    this.updateNavIndex(index);

    var previousIndices = this.getSpreadIndices(index);

    if (previousIndices[0] < this.firstDisplayableIndex() || previousIndices[1] < this.firstDisplayableIndex()) {
        return;
    }

    this.animating = true;

    if ('rl' != this.pageProgression) {
        // Assume LTR and we are going backward
        this.prepareFlipLeftToRight(previousIndices[0], previousIndices[1]);
        this.flipLeftToRight(previousIndices[0], previousIndices[1]);
    } else {
        // RTL and going backward
        var gutter = this.prepareFlipRightToLeft(previousIndices[0], previousIndices[1]);
        this.flipRightToLeft(previousIndices[0], previousIndices[1], gutter);
    }
};

// flipLeftToRight()
//______________________________________________________________________________
// Flips the page on the left towards the page on the right
BookReader.prototype.flipLeftToRight = function(newIndexL, newIndexR) {

    var leftLeaf = this.twoPage.currentIndexL;

    var oldLeafEdgeWidthL = this.leafEdgeWidth(this.twoPage.currentIndexL);
    var newLeafEdgeWidthL = this.leafEdgeWidth(newIndexL);
    var leafEdgeTmpW = oldLeafEdgeWidthL - newLeafEdgeWidthL;

    var currWidthL   = this.getPageWidth2UP(leftLeaf);
    var newWidthL    = this.getPageWidth2UP(newIndexL);
    var newWidthR    = this.getPageWidth2UP(newIndexR);

    var top  = this.twoPageTop();
    var gutter = this.twoPage.middle + this.gutterOffsetForIndex(newIndexL);

    //console.log('leftEdgeTmpW ' + leafEdgeTmpW);
    //console.log('  gutter ' + gutter + ', scaledWL ' + scaledWL + ', newLeafEdgeWL ' + newLeafEdgeWidthL);

    //animation strategy:
    // 0. remove search highlight, if any.
    // 1. create a new div, called leafEdgeTmp to represent the leaf edge between the leftmost edge
    //    of the left leaf and where the user clicked in the leaf edge.
    //    Note that if this function was triggered by left() and not a
    //    mouse click, the width of leafEdgeTmp is very small (zero px).
    // 2. animate both leafEdgeTmp to the gutter (without changing its width) and animate
    //    leftLeaf to width=0.
    // 3. When step 2 is finished, animate leafEdgeTmp to right-hand side of new right leaf
    //    (left=gutter+newWidthR) while also animating the new right leaf from width=0 to
    //    its new full width.
    // 4. After step 3 is finished, do the following:
    //      - remove leafEdgeTmp from the dom.
    //      - resize and move the right leaf edge (leafEdgeR) to left=gutter+newWidthR
    //          and width=twoPage.edgeWidth-newLeafEdgeWidthL.
    //      - resize and move the left leaf edge (leafEdgeL) to left=gutter-newWidthL-newLeafEdgeWidthL
    //          and width=newLeafEdgeWidthL.
    //      - resize the back cover (twoPage.coverDiv) to left=gutter-newWidthL-newLeafEdgeWidthL-10
    //          and width=newWidthL+newWidthR+twoPage.edgeWidth+20
    //      - move new left leaf (newIndexL) forward to zindex=2 so it can receive clicks.
    //      - remove old left and right leafs from the dom [pruneUnusedImgs()].
    //      - prefetch new adjacent leafs.
    //      - set up click handlers for both new left and right leafs.
    //      - redraw the search highlight.
    //      - update the pagenum box and the url.


    var leftEdgeTmpLeft = gutter - currWidthL - leafEdgeTmpW;

    this.leafEdgeTmp = document.createElement('div');
    this.leafEdgeTmp.className = 'BRleafEdgeTmp';
    $(this.leafEdgeTmp).css({
        width: leafEdgeTmpW + 'px',
        height: this.twoPage.height + 'px',
        left: leftEdgeTmpLeft + 'px',
        top: top+'px',
        zIndex:1000
    }).appendTo('#BRtwopageview');

    //$(this.leafEdgeL).css('width', newLeafEdgeWidthL+'px');
    $(this.leafEdgeL).css({
        width: newLeafEdgeWidthL+'px',
        left: gutter-currWidthL-newLeafEdgeWidthL+'px'
    });

    // Left gets the offset of the current left leaf from the document
    var left = $(this.prefetchedImgs[leftLeaf]).offset().left;
    // $$$ This seems very similar to the gutter.  May be able to consolidate the logic.
    var right = $('#BRtwopageview').prop('clientWidth')-left-$(this.prefetchedImgs[leftLeaf]).width()+$('#BRtwopageview').offset().left-2+'px';

    // We change the left leaf to right positioning
    // $$$ This causes animation glitches during resize.  See https://bugs.edge.launchpad.net/gnubook/+bug/328327
    $(this.prefetchedImgs[leftLeaf]).css({
        right: right,
        left: ''
    });

    $(this.leafEdgeTmp).animate({left: gutter}, this.flipSpeed, 'easeInSine');
    //$(this.prefetchedImgs[leftLeaf]).animate({width: '0px'}, 'slow', 'easeInSine');

    var self = this;

    this.removeSearchHilites();

    //console.log('animating leafLeaf ' + leftLeaf + ' to 0px');
    $(this.prefetchedImgs[leftLeaf]).animate({width: '0px'}, self.flipSpeed, 'easeInSine', function() {

        //console.log('     and now leafEdgeTmp to left: gutter+newWidthR ' + (gutter + newWidthR));
        $(self.leafEdgeTmp).animate({left: gutter+newWidthR+'px'}, self.flipSpeed, 'easeOutSine');

        $('#BRgutter').css({left: (gutter - self.twoPage.bookSpineDivWidth*0.5)+'px'});

        //console.log('  animating newIndexR ' + newIndexR + ' to ' + newWidthR + ' from ' + $(self.prefetchedImgs[newIndexR]).width());
        $(self.prefetchedImgs[newIndexR]).animate({width: newWidthR+'px'}, self.flipSpeed, 'easeOutSine', function() {
            $(self.prefetchedImgs[newIndexL]).css('zIndex', 2);

            //jquery adds display:block to the element style, which interferes with our print css
            $(self.prefetchedImgs[newIndexL]).css('display', '');
            $(self.prefetchedImgs[newIndexR]).css('display', '');

            $(self.leafEdgeR).css({
                // Moves the right leaf edge
                width: self.twoPage.edgeWidth-newLeafEdgeWidthL+'px',
                left:  gutter+newWidthR+'px'
            });

            $(self.leafEdgeL).css({
                // Moves and resizes the left leaf edge
                width: newLeafEdgeWidthL+'px',
                left:  gutter-newWidthL-newLeafEdgeWidthL+'px'
            });

            // Resizes the brown border div
            $(self.twoPage.coverDiv).css({
                width: self.twoPageCoverWidth(newWidthL+newWidthR)+'px',
                left: gutter-newWidthL-newLeafEdgeWidthL-self.twoPage.coverInternalPadding+'px'
            });

            $(self.leafEdgeTmp).remove();
            self.leafEdgeTmp = null;

            // $$$ TODO refactor with opposite direction flip

            self.twoPage.currentIndexL = newIndexL;
            self.twoPage.currentIndexR = newIndexR;
            self.twoPage.scaledWL = newWidthL;
            self.twoPage.scaledWR = newWidthR;
            self.twoPage.gutter = gutter;

            self.firstIndex = self.twoPage.currentIndexL;
            self.displayedIndices = [newIndexL, newIndexR];
            self.pruneUnusedImgs();
            self.prefetch();
            self.animating = false;

            self.updateSearchHilites2UP();
            self.updatePageNumBox2UP();

            // self.twoPagePlaceFlipAreas(); // No longer used
            self.setMouseHandlers2UP();
            self.twoPageSetCursor();

            if (self.animationFinishedCallback) {
                self.animationFinishedCallback();
                self.animationFinishedCallback = null;
            }
        });
    });

};

// flipFwdToIndex()
//______________________________________________________________________________
// Whether we flip left or right is dependent on the page progression
// to flip forward one spread, pass index=null
BookReader.prototype.flipFwdToIndex = function(index) {

    if (this.animating) return;

    if (null != this.leafEdgeTmp) {
        alert('error: leafEdgeTmp should be null!');
        return;
    }

    if (null == index) {
        index = this.twoPage.currentIndexR+2; // $$$ assumes indices are continuous
    }
    if (index > this.lastDisplayableIndex()) return;

    this.updateNavIndex(index);

    this.animating = true;

    var nextIndices = this.getSpreadIndices(index);

    //console.log('flipfwd to indices ' + nextIndices[0] + ',' + nextIndices[1]);

    if ('rl' != this.pageProgression) {
        // We did not specify RTL
        var gutter = this.prepareFlipRightToLeft(nextIndices[0], nextIndices[1]);
        this.flipRightToLeft(nextIndices[0], nextIndices[1], gutter);
    } else {
        // RTL
        var gutter = this.prepareFlipLeftToRight(nextIndices[0], nextIndices[1]);
        this.flipLeftToRight(nextIndices[0], nextIndices[1]);
    }
};

// flipRightToLeft(nextL, nextR, gutter)
// $$$ better not to have to pass gutter in
//______________________________________________________________________________
// Flip from left to right and show the nextL and nextR indices on those sides
BookReader.prototype.flipRightToLeft = function(newIndexL, newIndexR) {
    var oldLeafEdgeWidthL = this.leafEdgeWidth(this.twoPage.currentIndexL);
    var oldLeafEdgeWidthR = this.twoPage.edgeWidth-oldLeafEdgeWidthL;
    var newLeafEdgeWidthL = this.leafEdgeWidth(newIndexL);
    var newLeafEdgeWidthR = this.twoPage.edgeWidth-newLeafEdgeWidthL;

    var leafEdgeTmpW = oldLeafEdgeWidthR - newLeafEdgeWidthR;

    var top = this.twoPageTop();
    var scaledW = this.getPageWidth2UP(this.twoPage.currentIndexR);

    var middle = this.twoPage.middle;
    var gutter = middle + this.gutterOffsetForIndex(newIndexL);

    this.leafEdgeTmp = document.createElement('div');
    this.leafEdgeTmp.className = 'BRleafEdgeTmp';
    $(this.leafEdgeTmp).css({
        width: leafEdgeTmpW + 'px',
        height: this.twoPage.height + 'px',
        left: gutter+scaledW+'px',
        top: top+'px',
        zIndex:1000
    }).appendTo('#BRtwopageview');

    //var scaledWR = this.getPageWidth2UP(newIndexR); // $$$ should be current instead?
    //var scaledWL = this.getPageWidth2UP(newIndexL); // $$$ should be current instead?

    var currWidthL = this.getPageWidth2UP(this.twoPage.currentIndexL);
    var currWidthR = this.getPageWidth2UP(this.twoPage.currentIndexR);
    var newWidthL = this.getPageWidth2UP(newIndexL);
    var newWidthR = this.getPageWidth2UP(newIndexR);

    $(this.leafEdgeR).css({width: newLeafEdgeWidthR+'px', left: gutter+newWidthR+'px' });

    var self = this; // closure-tastic!

    var speed = this.flipSpeed;

    this.removeSearchHilites();

    $(this.leafEdgeTmp).animate({left: gutter}, speed, 'easeInSine');
    $(this.prefetchedImgs[this.twoPage.currentIndexR]).animate({width: '0px'}, speed, 'easeInSine', function() {
        $('#BRgutter').css({left: (gutter - self.twoPage.bookSpineDivWidth*0.5)+'px'});
        $(self.leafEdgeTmp).animate({left: gutter-newWidthL-leafEdgeTmpW+'px'}, speed, 'easeOutSine');
        $(self.prefetchedImgs[newIndexL]).animate({width: newWidthL+'px'}, speed, 'easeOutSine', function() {
            $(self.prefetchedImgs[newIndexR]).css('zIndex', 2);

            //jquery adds display:block to the element style, which interferes with our print css
            $(self.prefetchedImgs[newIndexL]).css('display', '');
            $(self.prefetchedImgs[newIndexR]).css('display', '');

            $(self.leafEdgeL).css({
                width: newLeafEdgeWidthL+'px',
                left: gutter-newWidthL-newLeafEdgeWidthL+'px'
            });

            // Resizes the book cover
            $(self.twoPage.coverDiv).css({
                width: self.twoPageCoverWidth(newWidthL+newWidthR)+'px',
                left: gutter - newWidthL - newLeafEdgeWidthL - self.twoPage.coverInternalPadding + 'px'
            });

            $(self.leafEdgeTmp).remove();
            self.leafEdgeTmp = null;

            self.twoPage.currentIndexL = newIndexL;
            self.twoPage.currentIndexR = newIndexR;
            self.twoPage.scaledWL = newWidthL;
            self.twoPage.scaledWR = newWidthR;
            self.twoPage.gutter = gutter;

            self.firstIndex = self.twoPage.currentIndexL;
            self.displayedIndices = [newIndexL, newIndexR];
            self.pruneUnusedImgs();
            self.prefetch();
            self.animating = false;


            self.updateSearchHilites2UP();
            self.updatePageNumBox2UP();

            // self.twoPagePlaceFlipAreas(); // No longer used
            self.setMouseHandlers2UP();
            self.twoPageSetCursor();

            if (self.animationFinishedCallback) {
                self.animationFinishedCallback();
                self.animationFinishedCallback = null;
            }
        });
    });
};

// setMouseHandlers2UP
//______________________________________________________________________________
BookReader.prototype.setMouseHandlers2UP = function() {
    this.setClickHandler2UP( this.prefetchedImgs[this.twoPage.currentIndexL],
        { self: this },
        function(e) {
            if (e.which == 3) {
                // right click
                if (e.data.self.protected) {
                    return false;
                }
                return true;
            }

             if (! e.data.self.twoPageIsZoomedIn()) {
                e.data.self.ttsStop();
                e.data.self.left();
            }
            e.preventDefault();
        }
    );

    this.setClickHandler2UP( this.prefetchedImgs[this.twoPage.currentIndexR],
        { self: this },
        function(e) {
            if (e.which == 3) {
                // right click
                return !e.data.self.protected;

            }

            if (! e.data.self.twoPageIsZoomedIn()) {
                e.data.self.ttsStop();
                e.data.self.right();
            }
            e.preventDefault();
        }
    );
};

// prefetchImg()
//______________________________________________________________________________
BookReader.prototype.prefetchImg = function(index) {
    var pageURI = this._getPageURI(index);

    // Load image if not loaded or URI has changed (e.g. due to scaling)
    var loadImage = false;
    if (undefined == this.prefetchedImgs[index]) {
        //console.log('no image for ' + index);
        loadImage = true;
    } else if (pageURI != this.prefetchedImgs[index].uri) {
        //console.log('uri changed for ' + index);
        loadImage = true;
    }

    if (loadImage) {
        //console.log('prefetching ' + index);
        var img = document.createElement("img");
        $(img).addClass('BRpageimage').addClass('BRnoselect');
        if (index < 0 || index > (this.numLeafs - 1) ) {
            // Facing page at beginning or end, or beyond
            $(img).addClass('BRemptypage');
        }
        img.src = pageURI;
        img.uri = pageURI; // browser may rewrite src so we stash raw URI here
        this.prefetchedImgs[index] = img;
    }
};


// prepareFlipLeftToRight()
//
//______________________________________________________________________________
//
// Prepare to flip the left page towards the right.  This corresponds to moving
// backward when the page progression is left to right.
BookReader.prototype.prepareFlipLeftToRight = function(prevL, prevR) {

    //console.log('  preparing left->right for ' + prevL + ',' + prevR);

    this.prefetchImg(prevL);
    this.prefetchImg(prevR);

    var height  = this._getPageHeight(prevL);
    var width   = this._getPageWidth(prevL);
    var middle = this.twoPage.middle;
    var top  = this.twoPageTop();
    var scaledW = this.twoPage.height*width/height; // $$$ assumes height of page is dominant

    // The gutter is the dividing line between the left and right pages.
    // It is offset from the middle to create the illusion of thickness to the pages
    var gutter = middle + this.gutterOffsetForIndex(prevL);

    //console.log('    gutter for ' + prevL + ' is ' + gutter);
    //console.log('    prevL.left: ' + (gutter - scaledW) + 'px');
    //console.log('    changing prevL ' + prevL + ' to left: ' + (gutter-scaledW) + ' width: ' + scaledW);

    var leftCSS = {
        position: 'absolute',
        left: gutter-scaledW+'px',
        right: '', // clear right property
        top:    top+'px',
        height: this.twoPage.height,
        width:  scaledW+'px',
        zIndex: 1
    };

    $(this.prefetchedImgs[prevL]).css(leftCSS);

    $('#BRtwopageview').append(this.prefetchedImgs[prevL]);

    //console.log('    changing prevR ' + prevR + ' to left: ' + gutter + ' width: 0');

    var rightCSS = {
        position: 'absolute',
        left:   gutter+'px',
        right: '',
        top:    top+'px',
        height: this.twoPage.height,
        width:  '0',
        zIndex: 2
    };

    $(this.prefetchedImgs[prevR]).css(rightCSS);

    $('#BRtwopageview').append(this.prefetchedImgs[prevR]);

};

// $$$ mang we're adding an extra pixel in the middle.  See https://bugs.edge.launchpad.net/gnubook/+bug/411667
// prepareFlipRightToLeft()
//______________________________________________________________________________
BookReader.prototype.prepareFlipRightToLeft = function(nextL, nextR) {

    //console.log('  preparing left<-right for ' + nextL + ',' + nextR);

    // Prefetch images
    this.prefetchImg(nextL);
    this.prefetchImg(nextR);

    var height  = this._getPageHeight(nextR);
    var width   = this._getPageWidth(nextR);
    var middle = this.twoPage.middle;
    var top  = this.twoPageTop();
    var scaledW = this.twoPage.height*width/height;

    var gutter = middle + this.gutterOffsetForIndex(nextL);

    //console.log(' prepareRTL changing nextR ' + nextR + ' to left: ' + gutter);
    $(this.prefetchedImgs[nextR]).css({
        position: 'absolute',
        left:   gutter+'px',
        top:    top+'px',
        height: this.twoPage.height,
        width:  scaledW+'px',
        zIndex: 1
    });

    $('#BRtwopageview').append(this.prefetchedImgs[nextR]);

    height  = this._getPageHeight(nextL);
    width   = this._getPageWidth(nextL);
    scaledW = this.twoPage.height*width/height;

    //console.log(' prepareRTL changing nextL ' + nextL + ' to right: ' + $('#BRcontainer').width()-gutter);
    $(this.prefetchedImgs[nextL]).css({
        position: 'absolute',
        right:   $('#BRtwopageview').prop('clientWidth')-gutter+'px',
        top:    top+'px',
        height: this.twoPage.height,
        width:  0+'px', // Start at 0 width, then grow to the left
        zIndex: 2
    });

    $('#BRtwopageview').append(this.prefetchedImgs[nextL]);

};

// getNextLeafs() -- NOT RTL AWARE
//______________________________________________________________________________
// BookReader.prototype.getNextLeafs = function(o) {
//     //TODO: we might have two left or two right leafs in a row (damaged book)
//     //For now, assume that leafs are contiguous.
//
//     //return [this.twoPage.currentIndexL+2, this.twoPage.currentIndexL+3];
//     o.L = this.twoPage.currentIndexL+2;
//     o.R = this.twoPage.currentIndexL+3;
// }

// getprevLeafs() -- NOT RTL AWARE
//______________________________________________________________________________
// BookReader.prototype.getPrevLeafs = function(o) {
//     //TODO: we might have two left or two right leafs in a row (damaged book)
//     //For now, assume that leafs are contiguous.
//
//     //return [this.twoPage.currentIndexL-2, this.twoPage.currentIndexL-1];
//     o.L = this.twoPage.currentIndexL-2;
//     o.R = this.twoPage.currentIndexL-1;
// }

// pruneUnusedImgs()
//______________________________________________________________________________
BookReader.prototype.pruneUnusedImgs = function() {
    //console.log('current: ' + this.twoPage.currentIndexL + ' ' + this.twoPage.currentIndexR);
    for (var key in this.prefetchedImgs) {
        //console.log('key is ' + key);
        if ((key != this.twoPage.currentIndexL) && (key != this.twoPage.currentIndexR)) {
            //console.log('removing key '+ key);
            $(this.prefetchedImgs[key]).remove();
        }
        if ((key < this.twoPage.currentIndexL-4) || (key > this.twoPage.currentIndexR+4)) {
            //console.log('deleting key '+ key);
            delete this.prefetchedImgs[key];
        }
    }
};

// prefetch()
//______________________________________________________________________________
BookReader.prototype.prefetch = function() {

    // $$$ We should check here if the current indices have finished
    //     loading (with some timeout) before loading more page images
    //     See https://bugs.edge.launchpad.net/bookreader/+bug/511391

    // prefetch visible pages first
    this.prefetchImg(this.twoPage.currentIndexL);
    this.prefetchImg(this.twoPage.currentIndexR);

    var adjacentPagesToLoad = 3;

    var lowCurrent = Math.min(this.twoPage.currentIndexL, this.twoPage.currentIndexR);
    var highCurrent = Math.max(this.twoPage.currentIndexL, this.twoPage.currentIndexR);

    var start = Math.max(lowCurrent - adjacentPagesToLoad, 0);
    var end = Math.min(highCurrent + adjacentPagesToLoad, this.numLeafs - 1);

    // Load images spreading out from current
    for (var i = 1; i <= adjacentPagesToLoad; i++) {
        var goingDown = lowCurrent - i;
        if (goingDown >= start) {
            this.prefetchImg(goingDown);
        }
        var goingUp = highCurrent + i;
        if (goingUp <= end) {
            this.prefetchImg(goingUp);
        }
    }

    /*
    var lim = this.twoPage.currentIndexL-4;
    var i;
    lim = Math.max(lim, 0);
    for (i = lim; i < this.twoPage.currentIndexL; i++) {
        this.prefetchImg(i);
    }

    if (this.numLeafs > (this.twoPage.currentIndexR+1)) {
        lim = Math.min(this.twoPage.currentIndexR+4, this.numLeafs-1);
        for (i=this.twoPage.currentIndexR+1; i<=lim; i++) {
            this.prefetchImg(i);
        }
    }
    */
};

// getPageWidth2UP()
//______________________________________________________________________________
BookReader.prototype.getPageWidth2UP = function(index) {
    // We return the width based on the dominant height
    var height  = this._getPageHeight(index);
    var width   = this._getPageWidth(index);
    return Math.floor(this.twoPage.height*width/height); // $$$ we assume width is relative to current spread
};

// search()
// @param {string} term
// @param {object} options
//______________________________________________________________________________
BookReader.prototype.search = function(term, options) {
    options = options !== undefined ? options : {};
    var defaultOptions = {
        // {bool} (default=false) goToFirstResult - jump to the first result
        goToFirstResult: false,
        // {bool} (default=false) disablePopup - don't show the modal progress
        disablePopup: false,
        error: br.BRSearchCallbackErrorDesktop,
        success: br.BRSearchCallback,
    };
    options = jQuery.extend({}, defaultOptions, options);

    $('.textSrch').blur(); //cause mobile safari to hide the keyboard

    this.removeSearchResults();

    this.searchTerm = term;
    this.searchTerm = this.searchTerm.replace(/\//g, ' '); // strip slashes, since this goes in the url
    this.updateLocationHash(true);

    // Add quotes to the term. This is to compenstate for the backends default OR query
    term = term.replace(/['"]+/g, '');
    term = '"' + term + '"';

    var url = 'https://'+this.server.replace(/:.+/, ''); //remove the port and userdir
    //url    += '/fulltext/inside.php?item_id='+this.bookId;
    url    += '/fulltext/new_inside.php?item_id='+this.bookId;
    url    += '&doc='+this.subPrefix;   //TODO: test with subitem
    url    += '&path='+this.bookPath.replace(new RegExp('/'+this.subPrefix+'$'), ''); //remove subPrefix from end of path
    url    += '&q='+escape(term);

    if (!options.disablePopup) {
        this.showProgressPopup('<img id="searchmarker" src="'+this.imagesBaseURL + 'marker_srch-on.png'+'"> Search results will appear below...');
    }
    $.ajax({
        url:url,
        dataType:'jsonp',
        success: function(data) {
            if (data.error || 0 == data.matches.length) {
                options.error.call(br, data, options);
            } else {
                options.success.call(br, data, options);
            }
        },
    });
};

// BRSearchCallback()
//______________________________________________________________________________
BookReader.prototype.BRSearchCallback = function(results, options) {
    br.searchResults = results;
    $('#BRnavpos .search').remove();
    $('#mobileSearchResultWrapper').empty(); // Empty mobile results

    // Update Mobile count
    var mobileResultsText = results.matches.length == 1 ? "1 match" : results.matches.length + " matches";
    $('#mobileSearchResultWrapper').append("<div class='mobileNumResults'>"+mobileResultsText+" for &quot;"+this.searchTerm+"&quot;</div>");

    var i, firstResultIndex = null;
    for (i=0; i < results.matches.length; i++) {
        br.addSearchResult(results.matches[i].text, br.leafNumToIndex(results.matches[i].par[0].page));
        if (i === 0 && options.goToFirstResult === true) {
          firstResultIndex = br.leafNumToIndex(results.matches[i].par[0].page);
        }
    }
    br.updateSearchHilites();
    br.removeProgressPopup();
    if (firstResultIndex !== null) {
        br.jumpToIndex(firstResultIndex);
    }
}

// BRSearchCallbackErrorDesktop()
//______________________________________________________________________________
BookReader.prototype.BRSearchCallbackErrorDesktop = function(results, options) {
    var $el = $(br.popup);
    this._BRSearchCallbackError(results, $el, true);
};

// BRSearchCallbackErrorMobile()
//______________________________________________________________________________
BookReader.prototype.BRSearchCallbackErrorMobile = function(results, options) {
    var $el = $('#mobileSearchResultWrapper');
    this._BRSearchCallbackError(results, $el);
};
BookReader.prototype._BRSearchCallbackError = function(results, $el, fade, options) {
    $('#BRnavpos .search').remove();
    $('#mobileSearchResultWrapper').empty(); // Empty mobile results

    br.searchResults = results;
    var timeout = 2000;
    if (results.error) {
        if (/debug/.test(window.location.href)) {
            $el.html(results.error);
        } else {
            timeout = 4000;
            $el.html('Sorry, there was an error with your search.<br />The text may still be processing.');

        }
    } else if (0 == results.matches.length) {
        var errStr  = 'No matches were found.';
        timeout = 2000;
        if (false === results.indexed) {
            errStr  = "<p>This book hasn't been indexed for searching yet. We've just started indexing it, so search should be available soon. Please try again later. Thanks!</p>";
            timeout = 5000;
        }
        $el.html(errStr);
    }
    if (fade) {
        setTimeout(function(){
            $el.fadeOut('slow', function() {
                br.removeProgressPopup();
            })
        }, timeout);
    }
};


// updateSearchHilites()
//______________________________________________________________________________
BookReader.prototype.updateSearchHilites = function() {
    if (this.constMode2up == this.mode) {
        this.updateSearchHilites2UP();
    } else {
        this.updateSearchHilites1UP();
    }
};

// showSearchHilites1UP()
//______________________________________________________________________________
BookReader.prototype.updateSearchHilites1UP = function() {
    var results = this.searchResults;
    if (null == results) return;
    var i, j;
    for (i=0; i<results.matches.length; i++) {
        //console.log(results.matches[i].par[0]);
        for (j=0; j<results.matches[i].par[0].boxes.length; j++) {
            var box = results.matches[i].par[0].boxes[j];
            var pageIndex = this.leafNumToIndex(box.page);
            if (jQuery.inArray(pageIndex, this.displayedIndices) >= 0) {
                if (null == box.div) {
                    //create a div for the search highlight, and stash it in the box object
                    box.div = document.createElement('div');
                    $(box.div).prop('className', 'BookReaderSearchHilite').appendTo('#pagediv'+pageIndex);
                }
                $(box.div).css({
                    width:  (box.r-box.l)/this.reduce + 'px',
                    height: (box.b-box.t)/this.reduce + 'px',
                    left:   (box.l)/this.reduce + 'px',
                    top:    (box.t)/this.reduce +'px'
                });
            } else {
                if (null != box.div) {
                    //console.log('removing search highlight div');
                    $(box.div).remove();
                    box.div=null;
                }
            }
        }
    }

};


// twoPageGutter()
//______________________________________________________________________________
// Returns the position of the gutter (line between the page images)
BookReader.prototype.twoPageGutter = function() {
    return this.twoPage.middle + this.gutterOffsetForIndex(this.twoPage.currentIndexL);
};

// twoPageTop()
//______________________________________________________________________________
// Returns the offset for the top of the page images
BookReader.prototype.twoPageTop = function() {
    return this.twoPage.coverExternalPadding + this.twoPage.coverInternalPadding; // $$$ + border?
};

// twoPageCoverWidth()
//______________________________________________________________________________
// Returns the width of the cover div given the total page width
BookReader.prototype.twoPageCoverWidth = function(totalPageWidth) {
    return totalPageWidth + this.twoPage.edgeWidth + 2*this.twoPage.coverInternalPadding;
};

// twoPageGetViewCenter()
//______________________________________________________________________________
// Returns the percentage offset into twopageview div at the center of container div
// { percentageX: float, percentageY: float }
BookReader.prototype.twoPageGetViewCenter = function() {
    var center = {};

    var containerOffset = $('#BRcontainer').offset();
    var viewOffset = $('#BRtwopageview').offset();
    center.percentageX = (containerOffset.left - viewOffset.left + ($('#BRcontainer').prop('clientWidth') >> 1)) / this.twoPage.totalWidth;
    center.percentageY = (containerOffset.top - viewOffset.top + ($('#BRcontainer').prop('clientHeight') >> 1)) / this.twoPage.totalHeight;

    return center;
};

// twoPageCenterView(percentageX, percentageY)
//______________________________________________________________________________
// Centers the point given by percentage from left,top of twopageview
BookReader.prototype.twoPageCenterView = function(percentageX, percentageY) {
    if ('undefined' == typeof(percentageX)) {
        percentageX = 0.5;
    }
    if ('undefined' == typeof(percentageY)) {
        percentageY = 0.5;
    }

    var viewWidth = $('#BRtwopageview').width();
    var containerClientWidth = $('#BRcontainer').prop('clientWidth');
    var intoViewX = percentageX * viewWidth;

    var viewHeight = $('#BRtwopageview').height();
    var containerClientHeight = $('#BRcontainer').prop('clientHeight');
    var intoViewY = percentageY * viewHeight;

    if (viewWidth < containerClientWidth) {
        // Can fit width without scrollbars - center by adjusting offset
        $('#BRtwopageview').css('left', (containerClientWidth >> 1) - intoViewX + 'px');
    } else {
        // Need to scroll to center
        $('#BRtwopageview').css('left', 0);
        $('#BRcontainer').scrollLeft(intoViewX - (containerClientWidth >> 1));
    }

    if (viewHeight < containerClientHeight) {
        // Fits with scrollbars - add offset
        $('#BRtwopageview').css('top', (containerClientHeight >> 1) - intoViewY + 'px');
    } else {
        $('#BRtwopageview').css('top', 0);
        $('#BRcontainer').scrollTop(intoViewY - (containerClientHeight >> 1));
    }
};

// twoPageFlipAreaHeight
//______________________________________________________________________________
// Returns the integer height of the click-to-flip areas at the edges of the book
BookReader.prototype.twoPageFlipAreaHeight = function() {
    return parseInt(this.twoPage.height);
};

// twoPageFlipAreaWidth
//______________________________________________________________________________
// Returns the integer width of the flip areas
BookReader.prototype.twoPageFlipAreaWidth = function() {
    var max = 100; // $$$ TODO base on view width?
    var min = 10;

    var width = this.twoPage.width * 0.15;
    return parseInt(BookReader.util.clamp(width, min, max));
};

// twoPageFlipAreaTop
//______________________________________________________________________________
// Returns integer top offset for flip areas
BookReader.prototype.twoPageFlipAreaTop = function() {
    return parseInt(this.twoPage.bookCoverDivTop + this.twoPage.coverInternalPadding);
};

// twoPageLeftFlipAreaLeft
//______________________________________________________________________________
// Left offset for left flip area
BookReader.prototype.twoPageLeftFlipAreaLeft = function() {
    return parseInt(this.twoPage.gutter - this.twoPage.scaledWL);
};

// twoPageRightFlipAreaLeft
//______________________________________________________________________________
// Left offset for right flip area
BookReader.prototype.twoPageRightFlipAreaLeft = function() {
    return parseInt(this.twoPage.gutter + this.twoPage.scaledWR - this.twoPageFlipAreaWidth());
};

// twoPagePlaceFlipAreas
//______________________________________________________________________________
// Readjusts position of flip areas based on current layout
BookReader.prototype.twoPagePlaceFlipAreas = function() {
    // We don't set top since it shouldn't change relative to view
    $(this.twoPage.leftFlipArea).css({
        left: this.twoPageLeftFlipAreaLeft() + 'px',
        width: this.twoPageFlipAreaWidth() + 'px'
    });
    $(this.twoPage.rightFlipArea).css({
        left: this.twoPageRightFlipAreaLeft() + 'px',
        width: this.twoPageFlipAreaWidth() + 'px'
    });
};

// showSearchHilites2UPNew()
//______________________________________________________________________________
BookReader.prototype.updateSearchHilites2UP = function() {
    //console.log('updateSearchHilites2UP results = ' + this.searchResults);
    var results = this.searchResults;
    if (null == results) return;
    var i, j;
    for (i=0; i<results.matches.length; i++) {
        //console.log(results.matches[i].par[0]);
        //TODO: loop over all par objects
        var pageIndex = this.leafNumToIndex(results.matches[i].par[0].page);
        for (j=0; j<results.matches[i].par[0].boxes.length; j++) {
            var box = results.matches[i].par[0].boxes[j];
            if (jQuery.inArray(pageIndex, this.displayedIndices) >= 0) {
                if (null == box.div) {
                    //create a div for the search highlight, and stash it in the box object
                    box.div = document.createElement('div');
                    $(box.div).prop('className', 'BookReaderSearchHilite').css('zIndex', 3).appendTo('#BRtwopageview');
                    //console.log('appending new div');
                }
                this.setHilightCss2UP(box.div, pageIndex, box.l, box.r, box.t, box.b);
            } else {
                if (null != box.div) {
                    //console.log('removing search highlight div');
                    $(box.div).remove();
                    box.div=null;
                }
            }
        }
    }

};

// setHilightCss2UP()
//______________________________________________________________________________
//position calculation shared between search and text-to-speech functions
BookReader.prototype.setHilightCss2UP = function(div, index, left, right, top, bottom) {

    // We calculate the reduction factor for the specific page because it can be different
    // for each page in the spread
    var height = this._getPageHeight(index);
    var width  = this._getPageWidth(index);
    var reduce = this.twoPage.height/height;
    var scaledW = parseInt(width*reduce);

    var gutter = this.twoPageGutter();
    var pageL;
    if ('L' == this.getPageSide(index)) {
        pageL = gutter-scaledW;
    } else {
        pageL = gutter;
    }
    var pageT  = this.twoPageTop();

    $(div).css({
        width:  (right-left)*reduce + 'px',
        height: (bottom-top)*reduce + 'px',
        left:   pageL+left*reduce + 'px',
        top:    pageT+top*reduce +'px'
    });
};

// removeSearchHilites()
//______________________________________________________________________________
BookReader.prototype.removeSearchHilites = function() {
    var results = this.searchResults;
    if (null == results) return;
    var i, j;
    for (i=0; i<results.matches.length; i++) {
        for (j=0; j<results.matches[i].par[0].boxes.length; j++) {
            var box = results.matches[i].par[0].boxes[j];
            if (null != box.div) {
                $(box.div).remove();
                box.div=null;
            }
        }
    }
};


// printPage
//______________________________________________________________________________
BookReader.prototype.printPage = function() {
    window.open(this.getPrintURI(), 'printpage', 'width=400, height=500, resizable=yes, scrollbars=no, toolbar=no, location=no');
};

// Get print URI from current indices and mode
BookReader.prototype.getPrintURI = function() {
    var indexToPrint;
    if (this.constMode2up == this.mode) {
        indexToPrint = this.twoPage.currentIndexL;
    } else {
        indexToPrint = this.firstIndex; // $$$ the index in the middle of the viewport would make more sense
    }

    var options = 'id=' + this.subPrefix + '&server=' + this.server + '&zip=' + this.zip
        + '&format=' + this.imageFormat + '&file=' + this._getPageFile(indexToPrint)
        + '&width=' + this._getPageWidth(indexToPrint) + '&height=' + this._getPageHeight(indexToPrint);

    if (this.constMode2up == this.mode) {
        options += '&file2=' + this._getPageFile(this.twoPage.currentIndexR) + '&width2=' + this._getPageWidth(this.twoPage.currentIndexR);
        options += '&height2=' + this._getPageHeight(this.twoPage.currentIndexR);
        options += '&title=' + encodeURIComponent(this.shortTitle(50) + ' - Pages ' + this.getPageNum(this.twoPage.currentIndexL) + ', ' + this.getPageNum(this.twoPage.currentIndexR));
    } else {
        options += '&title=' + encodeURIComponent(this.shortTitle(50) + ' - Page ' + this.getPageNum(indexToPrint));
    }

    return '/bookreader/print.php?' + options;
};

// showEmbedCode()
//
// Note: Has been replaced by the share dialog
//______________________________________________________________________________
BookReader.prototype.showEmbedCode = function() {
    if (null != this.embedPopup) { // check if already showing
        return;
    }
    this.autoStop();
    this.ttsStop();

    this.embedPopup = document.createElement("div");
    $(this.embedPopup).css({
        position: 'absolute',
        top:      ($('#BRcontainer').prop('clientHeight')-250)/2 + 'px',
        left:     ($('#BRcontainer').prop('clientWidth')-400)/2 + 'px',
        width:    '400px',
        height:    '250px',
        padding:  '0',
        fontSize: '12px',
        color:    '#333',
        zIndex:   300,
        border: '10px solid #615132',
        backgroundColor: "#fff",
        MozBorderRadius: '8px',
        MozBoxShadow: '0 0 6px #000',
        WebkitBorderRadius: '8px',
        WebkitBoxShadow: '0 0 6px #000'
    }).appendTo('#BookReader');

    htmlStr =  '<h3 style="background:#615132;padding:10px;margin:0 0 10px;color:#fff;">Embed Bookreader</h3>';
    htmlStr += '<textarea rows="2" cols="40" style="margin-left:10px;width:368px;height:40px;color:#333;font-size:12px;border:2px inset #ccc;background:#efefef;padding:2px;-webkit-border-radius:4px;-moz-border-radius:4px;border-radius:4px;">' + this.getEmbedCode() + '</textarea>';
    htmlStr += '<a href="javascript:;" class="popOff" onclick="$(this.parentNode).remove();$(\'.coverUp\').hide();return false" style="color:#999;"><span>Close</span></a>';

    this.embedPopup.innerHTML = htmlStr;
    $('#BookReader').append('<div class="coverUp" style="position:absolute;z-index:299;width:100%;height:100%;background:#000;opacity:.4;filter:alpha(opacity=40);" onclick="$(\'.popped\').hide();$(this).hide();"></div>');
    $(this.embedPopup).find('textarea').click(function() {
        this.select();
    });
    $(this.embedPopup).addClass("popped");
};

// showBookmarkCode()
//______________________________________________________________________________
BookReader.prototype.showBookmarkCode = function() {
    this.bookmarkPopup = document.createElement("div");
    $(this.bookmarkPopup).css({
        position: 'absolute',
        top:      ($('#BRcontainer').prop('clientHeight')-250)/2 + 'px',
        left:     ($('#BRcontainer').prop('clientWidth')-400)/2 + 'px',
        width:    '400px',
        height:    '250px',
        padding:  '0',
        fontSize: '12px',
        color:    '#333',
        zIndex:   300,
        border: '10px solid #615132',
        backgroundColor: "#fff",
        MozBorderRadius: '8px',
        MozBoxShadow: '0 0 6px #000',
        WebkitBorderRadius: '8px',
        WebkitBoxShadow: '0 0 6px #000'
    }).appendTo('#BookReader');

    htmlStr =  '<h3 style="background:#615132;padding:10px;margin:0 0 10px;color:#fff;">Add a bookmark</h3>';
    htmlStr += '<p style="padding:10px;line-height:18px;">You can add a bookmark to any page in any book. If you elect to make your bookmark public, other readers will be able to see it. <em>You must be logged in to your <a href="">Open Library account</a> to add bookmarks.</em></p>';
    htmlStr += '<form name="bookmark" id="bookmark" style="line-height:20px;margin-left:10px;"><label style="padding-bottom"10px;><input type="radio" name="privacy" id="p2" disabled="disabled" checked="checked"/> Make this bookmark public.</label><br/><label style="padding-bottom:10px;"><input type="radio" name="privacy" id="p1" disabled="disabled"/> Keep this bookmark private.</label><br/><br/><button type="submit" style="font-size:20px;" disabled="disabled">Add a bookmark</button></form>';
    htmlStr += '<a href="javascript:;" class="popOff" onclick="$(this.parentNode).remove();$(\'.coverUp\').hide();return false;" style="color:#999;"><span>Close</span></a>';

    this.bookmarkPopup.innerHTML = htmlStr;
    $('#BookReader').append('<div class="coverUp" style="position:absolute;z-index:299;width:100%;height:100%;background:#000;opacity:.4;filter:alpha(opacity=40);" onclick="$(\'.popped\').hide();$(this).hide();"></div>');
    $(this.bookmarkPopup).find('textarea').click(function() {
        this.select();
    });
    $(this.bookmarkPopup).addClass("popped");
};


// autoToggle()
//______________________________________________________________________________
BookReader.prototype.autoToggle = function() {

    this.ttsStop();

    var bComingFrom1up = false;
    if (2 != this.mode) {
        bComingFrom1up = true;
        this.switchMode(this.constMode2up);
    }

    // Change to autofit if book is too large
    if (this.reduce < this.twoPageGetAutofitReduce()) {
        this.zoom2up('auto');
    }

    var self = this;
    if (null == this.autoTimer) {
        this.flipSpeed = 2000;

        // $$$ Draw events currently cause layout problems when they occur during animation.
        //     There is a specific problem when changing from 1-up immediately to autoplay in RTL so
        //     we workaround for now by not triggering immediate animation in that case.
        //     See https://bugs.launchpad.net/gnubook/+bug/328327
        if (('rl' == this.pageProgression) && bComingFrom1up) {
            // don't flip immediately -- wait until timer fires
        } else {
            // flip immediately
            this.flipFwdToIndex();
        }

        $('#BRtoolbar .play').hide();
        $('#BRtoolbar .pause').show();
        this.autoTimer=setInterval(function(){
            if (self.animating) {return;}

            if (Math.max(self.twoPage.currentIndexL, self.twoPage.currentIndexR) >= self.lastDisplayableIndex()) {
                self.flipBackToIndex(1); // $$$ really what we want?
            } else {
                self.flipFwdToIndex();
            }
        },5000);
    } else {
        this.autoStop();
    }
};

// autoStop()
//______________________________________________________________________________
// Stop autoplay mode, allowing animations to finish
BookReader.prototype.autoStop = function() {
    if (null != this.autoTimer) {
        clearInterval(this.autoTimer);
        this.flipSpeed = 'fast';
        $('#BRtoolbar .pause').hide();
        $('#BRtoolbar .play').show();
        this.autoTimer = null;
    }
};

// stopFlipAnimations
//______________________________________________________________________________
// Immediately stop flip animations.  Callbacks are triggered.
BookReader.prototype.stopFlipAnimations = function() {

    this.autoStop(); // Clear timers

    // Stop animation, clear queue, trigger callbacks
    if (this.leafEdgeTmp) {
        $(this.leafEdgeTmp).stop(false, true);
    }
    jQuery.each(this.prefetchedImgs, function() {
        $(this).stop(false, true);
        });

    // And again since animations also queued in callbacks
    if (this.leafEdgeTmp) {
        $(this.leafEdgeTmp).stop(false, true);
    }
    jQuery.each(this.prefetchedImgs, function() {
        $(this).stop(false, true);
        });

};

// keyboardNavigationIsDisabled(event)
//   - returns true if keyboard navigation should be disabled for the event
//______________________________________________________________________________
BookReader.prototype.keyboardNavigationIsDisabled = function(event) {
    return event.target.tagName == "INPUT";
};

// gutterOffsetForIndex
//______________________________________________________________________________
//
// Returns the gutter offset for the spread containing the given index.
// This function supports RTL
BookReader.prototype.gutterOffsetForIndex = function(pindex) {

    // To find the offset of the gutter from the middle we calculate our percentage distance
    // through the book (0..1), remap to (-0.5..0.5) and multiply by the total page edge width
    var offset = parseInt(((pindex / this.numLeafs) - 0.5) * this.twoPage.edgeWidth);

    // But then again for RTL it's the opposite
    if ('rl' == this.pageProgression) {
        offset = -offset;
    }

    return offset;
};

// leafEdgeWidth
//______________________________________________________________________________
// Returns the width of the leaf edge div for the page with index given
BookReader.prototype.leafEdgeWidth = function(pindex) {
    // $$$ could there be single pixel rounding errors for L vs R?
    if ((this.getPageSide(pindex) == 'L') && (this.pageProgression != 'rl')) {
        return parseInt( (pindex/this.numLeafs) * this.twoPage.edgeWidth + 0.5);
    } else {
        return parseInt( (1 - pindex/this.numLeafs) * this.twoPage.edgeWidth + 0.5);
    }
};

// jumpIndexForLeftEdgePageX
//______________________________________________________________________________
// Returns the target jump leaf given a page coordinate (inside the left page edge div)
BookReader.prototype.jumpIndexForLeftEdgePageX = function(pageX) {
    if ('rl' != this.pageProgression) {
        // LTR - flipping backward
        var jumpIndex = this.twoPage.currentIndexL - ($(this.leafEdgeL).offset().left + $(this.leafEdgeL).width() - pageX) * 10;

        // browser may have resized the div due to font size change -- see https://bugs.launchpad.net/gnubook/+bug/333570
        jumpIndex = BookReader.util.clamp(Math.round(jumpIndex), this.firstDisplayableIndex(), this.twoPage.currentIndexL - 2);
        return jumpIndex;

    } else {
        var jumpIndex = this.twoPage.currentIndexL + ($(this.leafEdgeL).offset().left + $(this.leafEdgeL).width() - pageX) * 10;
        jumpIndex = BookReader.util.clamp(Math.round(jumpIndex), this.twoPage.currentIndexL + 2, this.lastDisplayableIndex());
        return jumpIndex;
    }
};

// jumpIndexForRightEdgePageX
//______________________________________________________________________________
// Returns the target jump leaf given a page coordinate (inside the right page edge div)
BookReader.prototype.jumpIndexForRightEdgePageX = function(pageX) {
    if ('rl' != this.pageProgression) {
        // LTR
        var jumpIndex = this.twoPage.currentIndexR + (pageX - $(this.leafEdgeR).offset().left) * 10;
        jumpIndex = BookReader.util.clamp(Math.round(jumpIndex), this.twoPage.currentIndexR + 2, this.lastDisplayableIndex());
        return jumpIndex;
    } else {
        var jumpIndex = this.twoPage.currentIndexR - (pageX - $(this.leafEdgeR).offset().left) * 10;
        jumpIndex = BookReader.util.clamp(Math.round(jumpIndex), this.firstDisplayableIndex(), this.twoPage.currentIndexR - 2);
        return jumpIndex;
    }
};


// initNavbar
//______________________________________________________________________________
// Initialize the navigation bar.
// $$$ this could also add the base elements to the DOM, so disabling the nav bar
//     could be as simple as not calling this function
BookReader.prototype.initNavbar = function() {
    // Setup nav / chapter / search results bar
    $('#BookReader').append(
      "<div id=\"BRnav\" class=\"BRnavDesktop\">"
      +"  <div id=\"BRcurrentpageWrapper\"><span class='currentpage'></span></div>"
      +"  <div id=\"BRpage\">"
      // Note, it's important for there to not be whitespace
      +     "<button class=\"BRicon book_left\"></button>"
      +     "<button class=\"BRicon book_right\"></button>"
      +     "<span class=\"desktop-only\">&nbsp;&nbsp;</span>"
      +     "<button class=\"BRicon onepg desktop-only\"></button>"
      +     "<button class=\"BRicon twopg desktop-only\"></button>"
      +     "<button class=\"BRicon thumb desktop-only\"></button>"
      +"  </div>"
      +"  <div id=\"BRnavpos\">"
      +"    <div id=\"BRpager\"></div>"
      +"    <div id=\"BRnavline\">"
      +"      <div class=\"BRnavend\" id=\"BRnavleft\"></div>"
      +"      <div class=\"BRnavend\" id=\"BRnavright\"></div>"
      +"    </div>"
      +"  </div>"
      +"  <div id=\"BRnavCntlBtm\" class=\"BRnavCntl BRdn\"></div>"
      +"</div>"
    );

    var self = this;
    $('#BRpager').slider({
        animate: true,
        min: 0,
        max: this.numLeafs - 1,
        value: this.currentIndex(),
        range: "min"
    })
    .bind('slide', function(event, ui) {
        self.updateNavPageNum(ui.value);
        return true;
    })
    .bind('slidechange', function(event, ui) {
        self.updateNavPageNum(ui.value);
        // recursion prevention for jumpToIndex
        if ( $(this).data('swallowchange') ) {
            $(this).data('swallowchange', false);
        } else {
            self.jumpToIndex(ui.value);
        }
        return true;
    });

    this.updateNavPageNum(this.currentIndex());

    $("#BRzoombtn").draggable({axis:'y',containment:'parent'});

    /* Initial hiding
        $('#BRtoolbar').delay(3000).animate({top:-40});
        $('#BRnav').delay(3000).animate({bottom:-53});
        changeArrow();
        $('.BRnavCntl').delay(3000).animate({height:'43px'}).delay(1000).animate({opacity:.25},1000);
    */
};

// initEmbedNavbar
//______________________________________________________________________________
// Initialize the navigation bar when embedded
BookReader.prototype.initEmbedNavbar = function() {
    var thisLink = (window.location + '').replace('?ui=embed',''); // IA-specific

    $('#BookReader').append(
        '<div id="BRnav" class="BRnavEmbed">'
        +   "<span id='BRtoolbarbuttons'>"
        +         '<button class="BRicon full"></button>'
        +         '<button class="BRicon book_left"></button>'
        +         '<button class="BRicon book_right"></button>'
        +   "</span>"
        +   "<a class='logo' href='" + this.logoURL + "' 'target='_blank' ></a>"
        +   "<span id='BRembedreturn'><a href='" + thisLink + "' target='_blank' ></a></span>"
        + '</div>'
    );
    $('#BRembedreturn a').text(this.bookTitle);
};


BookReader.prototype.getNavPageNumString = function(index, excludePrefix) {
    excludePrefix = excludePrefix === undefined ? false : true;
    var pageNum = this.getPageNum(index);
    var pageStr;
    if (pageNum[0] == 'n') { // funny index
        pageStr = index + 1 + ' / ' + this.numLeafs; // Accessible index starts at 0 (alas) so we add 1 to make human
    } else {
        pageStr = pageNum + ' of ' + this.maxPageNum;
        if (!excludePrefix) pageStr = 'Page ' + pageStr;
    }
    return pageStr;
}
BookReader.prototype.updateNavPageNum = function(index) {
    $('.currentpage').text(this.getNavPageNumString(index));
};

/*
 * Update the nav bar display - does not cause navigation.
 */
BookReader.prototype.updateNavIndex = function(index) {
    // We want to update the value, but normally moving the slider
    // triggers jumpToIndex which triggers this method
    index = index !== undefined ? index : this.currentIndex();
    $('#BRpager').data('swallowchange', true).slider('value', index);
};

BookReader.prototype.updateNavIndexDebounced = BookReader.prototype.debounce(BookReader.prototype.updateNavIndex, 500);

BookReader.prototype.updateNavIndexThrottled = BookReader.prototype.throttle(BookReader.prototype.updateNavIndex, 500, false);


BookReader.prototype.addSearchResult = function(queryString, pageIndex) {
    var pageNumber = this.getPageNum(pageIndex);
    var uiStringSearch = "Search result"; // i18n
    var uiStringPage = "Page"; // i18n

    var percentThrough = BookReader.util.cssPercentage(pageIndex, this.numLeafs - 1);
    var pageDisplayString = uiStringPage + ' ' + this.getNavPageNumString(pageIndex, true);

    var searchBtSettings = {
        contentSelector: '$(this).find(".query")',
        trigger: 'hover',
        closeWhenOthersOpen: true,
        cssStyles: {
            padding: '12px 14px',
            backgroundColor: '#fff',
            border: '4px solid rgb(216,216,216)',
            fontSize: '13px',
            color: 'rgb(52,52,52)'
        },
        shrinkToFit: false,
        width: '230px',
        padding: 0,
        spikeGirth: 0,
        spikeLength: 0,
        overlap: '22px',
        overlay: false,
        killTitle: false,
        textzIndex: 9999,
        boxzIndex: 9998,
        wrapperzIndex: 9997,
        offsetParent: null,
        positions: ['top'],
        fill: 'white',
        windowMargin: 10,
        strokeWidth: 0,
        cornerRadius: 0,
        centerPointX: 0,
        centerPointY: 0,
        shadow: false
    };

    var re = new RegExp('{{{(.+?)}}}', 'g');
    var queryStringWithA = queryString.replace(re,
        '<a href="#" onclick="br.jumpToIndex('+pageIndex+'); return false;">$1</a>')

    var queryStringWithB = queryString;
    // This regex truncates words by num chars

    if (queryStringWithB.length > 100) {
        queryStringWithB = queryStringWithB.replace(/^(.{100}[^\s]*).*/, "$1");
        queryStringWithB = queryStringWithB.replace(re, '<b>$1</b>');
        queryStringWithB = queryStringWithB + '...';
    } else {
        queryStringWithB = queryStringWithB.replace(re, '<b>$1</b>');
    }
    queryStringWithB = queryStringWithB;

    var marker = $(
        '<div class="search" style="top:'+(-$('#BRcontainer').height())+'px; left:' + percentThrough + ';" title="' + uiStringSearch + '"><div class="query">'
        + queryStringWithA + '<span>' + uiStringPage + ' ' + pageNumber + '</span></div>'
    )
    .data({'self': this, 'pageIndex': pageIndex})
    .appendTo('#BRnavline')
    .bt(searchBtSettings)
    .hover(function() {
            // remove from other markers then turn on just for this
            // XXX should be done when nav slider moves
            $('.search,.chapter').removeClass('front');
            $(this).addClass('front');
        }, function() {
            $(this).removeClass('front');
        }
    )
    .bind('click', function() {
        $(this).data('self').jumpToIndex($(this).data('pageIndex'));
    });

    $(marker).animate({top:'-25px'}, 'slow');

    // Add Mobile Search Results
    var self = this;
    var imgPreviewUrl = this.getPageURI(pageIndex, 16, 0); // scale 16 is small
    var $mobileSearchResultWrapper = $('#mobileSearchResultWrapper');
    if ($mobileSearchResultWrapper.length) {
        $('<a class="mobileSearchResult">'
            +"<table>"
            +"  <tr>"
            +"     <span class='pageDisplay'>"+pageDisplayString+"</span>"
            +"  </tr>"
            +"  <tr>"
            +"    <td>"
            +"      <img class='searchImgPreview' src=\""+imgPreviewUrl+"\" />"
            +"    </td>"
            +"    <td>"
            +"      <span>"+queryStringWithB+"</span>"
            +"    </td>"
            +"  </tr>"
            +"</table>"
        +'</a>')
        .attr('href', '#search/' + this.searchTerm)
        .click(function(e){
            e.preventDefault();
            self.switchMode(self.constMode1up);
            self.jumpToIndex(pageIndex);
            self.mmenu.data('mmenu').close();
        })
        .appendTo($mobileSearchResultWrapper)
        ;
    }
};

BookReader.prototype.removeSearchResults = function() {
    this.removeSearchHilites(); //be sure to set all box.divs to null
    this.searchTerm = null;
    this.searchResults = null;
    this.updateLocationHash(true);
    $('#BRnavpos .search').remove();
    $('#mobileSearchResultWrapper').empty(); // Empty mobile results
};

BookReader.prototype.addChapter = function(chapterTitle, pageNumber, pageIndex) {
    var uiStringPage = 'Page'; // i18n

    var percentThrough = BookReader.util.cssPercentage(pageIndex, this.numLeafs - 1);

    $('<div class="chapter" style="left:' + percentThrough + ';"><div class="title">'
        + chapterTitle + '<span>|</span> ' + uiStringPage + ' ' + pageNumber + '</div></div>')
    .appendTo('#BRnavline')
    .data({'self': this, 'pageIndex': pageIndex })
    .bt({
        contentSelector: '$(this).find(".title")',
        trigger: 'hover',
        closeWhenOthersOpen: true,
        cssStyles: {
            padding: '12px 14px',
            backgroundColor: '#fff',
            border: '4px solid rgb(216,216,216)',
            fontSize: '13px',
            color: 'rgb(52,52,52)'
        },
        shrinkToFit: true,
        width: '200px',
        padding: 0,
        spikeGirth: 0,
        spikeLength: 0,
        overlap: '21px',
        overlay: false,
        killTitle: true,
        textzIndex: 9999,
        boxzIndex: 9998,
        wrapperzIndex: 9997,
        offsetParent: null,
        positions: ['top'],
        fill: 'white',
        windowMargin: 10,
        strokeWidth: 0,
        cornerRadius: 0,
        centerPointX: 0,
        centerPointY: 0,
        shadow: false
    })
    .hover( function() {
            // remove hover effect from other markers then turn on just for this
            $('.search,.chapter').removeClass('front');
                $(this).addClass('front');
            }, function() {
                $(this).removeClass('front');
            }
    )
    .bind('click', function() {
        $(this).data('self').jumpToIndex($(this).data('pageIndex'));
    });
};

/*
 * Remove all chapters.
 */
BookReader.prototype.removeChapters = function() {
    $('#BRnavpos .chapter').remove();
};

/*
 * Update the table of contents based on array of TOC entries.
 */
BookReader.prototype.updateTOC = function(tocEntries) {
    this.removeChapters();
    for (var i = 0; i < tocEntries.length; i++) {
        this.addChapterFromEntry(tocEntries[i]);
    }
};

/*
 *   Example table of contents entry - this format is defined by Open Library
 *   {
 *       "pagenum": "17",
 *       "level": 1,
 *       "label": "CHAPTER I",
 *       "type": {"key": "/type/toc_item"},
 *       "title": "THE COUNTRY AND THE MISSION"
 *   }
 */
BookReader.prototype.addChapterFromEntry = function(tocEntryObject) {
    var pageIndex = this.getPageIndex(tocEntryObject['pagenum']);
    // Only add if we know where it is
    if (pageIndex) {
        this.addChapter(tocEntryObject['title'], tocEntryObject['pagenum'], pageIndex);
    }
    $('.chapter').each(function(){
        $(this).hover(function(){
            $(this).addClass('front');
        },function(){
            $(this).removeClass('front');
        });
    });
    $('.search').each(function(){
        $(this).hover(function(){
            $(this).addClass('front');
        },function(){
            $(this).removeClass('front');
        });
    });
    $('.searchChap').each(function(){
        $(this).hover(function(){
            $(this).addClass('front');
        },function(){
            $(this).removeClass('front');
        });
    });
};

/**
 * This method builds the html for the toolbar. It can be decorated to extend
 * the toolbar.
 * @return {jqueryElement}
 */
BookReader.prototype.buildToolbarElement = function() {
  // $$$mang should be contained within the BookReader div instead of body
  var readIcon = '';
  if (this.isSoundManagerSupported) {
      readIcon = "<button class='BRicon read modal js-tooltip'></button>";
  }

  var escapedTitle = BookReader.util.escapeHTML(this.bookTitle);

  var mobileClass = '';
  if (this.enableMobileNav) {
    mobileClass = 'responsive';
  }

  var desktopSearchHtml = '';
  if (this.enableSearch) {
      desktopSearchHtml = "<span class='BRtoolbarSection BRtoolbarSectionSearch tc ph20 last'>"
      +         "<form class='booksearch desktop'>"
      +           "<input type='search' class='textSrch form-control' name='textSrch' val='' placeholder='Search inside this book'/>"
      +           "<button type='submit' id='btnSrch' name='btnSrch'>"
      +              "<img src=\""+this.imagesBaseURL+"icon_search_button.svg\" />"
      +           "</button>"
      +         "</form>"
      +       "</span>";
  }

  // Add large screen navigation
  return $(
    "<div id='BRtoolbar' class='header fixed "+mobileClass+"'>"
    +   "<span class='BRmobileHamburgerWrapper'>"
    +     "<span class=\"hamburger\"><a href=\"#BRmobileMenu\"></a></span>"
    +     "<span class=\"BRtoolbarMobileTitle\" title=\""+escapedTitle+"\">" + this.bookTitle + "</span>"
    +   "</span>"
    +   "<span id='BRtoolbarbuttons' >"
    +     "<span class='BRtoolbarLeft'>"
    +       "<span class='BRtoolbarSection BRtoolbarSectionLogo tc'>"
    +         "<a class='logo' href='" + this.logoURL + "'></a>"
    +       "</span>"

    +       "<span class='BRtoolbarSection BRtoolbarSectionTitle title tl ph10 last'>"
    +           "<span id='BRreturn'><a></a></span>"
    +           "<div id='BRnavCntlTop' class='BRnabrbuvCntl'></div>"
    +       "</span>"
    +    "</span>"

    +     "<span class='BRtoolbarRight'>"

    +       "<span class='BRtoolbarSection BRtoolbarSectionInfo tc ph10'>"
    +         "<button class='BRicon info js-tooltip'></button>"
    +         "<button class='BRicon share js-tooltip'></button>"
    +         readIcon
    +       "</span>"

    // zoom
    +       "<span class='BRtoolbarSection BRtoolbarSectionZoom tc ph10'>"
    +         "<button class='BRicon zoom_out js-tooltip'></button>"
    +         "<button class='BRicon zoom_in js-tooltip'></button>"
    +       "</span>"

    // Search
    + desktopSearchHtml

    //+     "<button class='BRicon full'></button>"

    +     "</span>" // end BRtoolbarRight

    +   "</span>" // end desktop-only

    + "</div>"
    /*
    + "<div id='BRzoomer'>"
    +   "<div id='BRzoompos'>"
    +     "<button class='BRicon zoom_out'></button>"
    +     "<div id='BRzoomcontrol'>"
    +       "<div id='BRzoomstrip'></div>"
    +       "<div id='BRzoombtn'></div>"
    +     "</div>"
    +     "<button class='BRicon zoom_in'></button>"
    +   "</div>"
    + "</div>"
    */
    );
}


/**
 * This method builds the html for the mobile drawer. It can be decorated to
 * extend the default drawer.
 * @return {jqueryElement}
 */
BookReader.prototype.buildMobileDrawerElement = function() {
    var experimentalHtml = '';
    if (this.enableExperimentalControls) {
      experimentalHtml += "<div class=\"DrawerSettingsTitle\">Experimental (may not work)</div>"
        +"        <button class='action high-contrast-button'>Toggle high contrast</button>";
    }

    var readAloud = '';
    if (this.isSoundManagerSupported) {
        readAloud = "    <li>"
        +"      <span>"
        +"        <span class=\"DrawerIconWrapper \"><img class=\"DrawerIcon\" src=\""+this.imagesBaseURL+"icon_speaker_open.svg\" alt=\"info-speaker\"/></span>"
        +"        Read Aloud"
        +"      </span>"
        +"      <div>"
        +"        <span class='larger'>Press to toggle read aloud</span> <br/>"
        +"        <button class='BRicon read modal'></button>"
        +"      </div>"
        +"    </li>";
    }

    var mobileSearchHtml = '';
    if (this.enableSearch) {
        mobileSearchHtml = "<li>"
        +"      <span>"
        +"        <span class=\"DrawerIconWrapper \"><img class=\"DrawerIcon\" src=\""+this.imagesBaseURL+"icon_search_button_blue.svg\" alt=\"info-speaker\"/></span>"
        +"        Search"
        +"      </span>"
        +"      <div>"
        +         "<form class='booksearch mobile'>"
        +           "<input type='search' class='textSrch form-control' name='textSrch' val='' placeholder='Search inside'/>"
        +           "<button type='submit' id='btnSrch' name='btnSrch'>"
        +              "<img src=\""+this.imagesBaseURL+"icon_search_button.svg\" />"
        +           "</button>"
        +         "</form>"
        +         "<div id='mobileSearchResultWrapper'>Enter your search above.</div>"
        +"      </div>"
        +"    </li>";
    }


    return $(
      "<nav id=\"BRmobileMenu\" class=\"BRmobileMenu\">"
      +"  <ul>"
      +"    <li>"
      +"      <span>"
      +"        <span class=\"DrawerIconWrapper \"><img class=\"DrawerIcon\" src=\""+this.imagesBaseURL+"icon_gear.svg\" alt=\"settings-icon\"/></span>"
      +"        Settings"
      +"      </span>"
      +"      <div class=\"DrawerSettingsWrapper\">"
      +"        <div class=\"DrawerSettingsTitle\">Page Layout</div>"
      +"        <div class=\"DrawerSettingsLayoutWrapper\">"
      +"          <button class=\"DrawerLayoutButton one_page_mode\"><img class=\"\" src=\""+this.imagesBaseURL+"icon_one_page.svg\" alt=\"Single Page\"/><br>One Page</button>"
      +"          <button class=\"DrawerLayoutButton two_page_mode TwoPagesButton\"><img class=\"\" src=\""+this.imagesBaseURL+"icon_two_pages.svg\" alt=\"Two Pages\"/><br>Two Pages</button>"
      +"          <button class=\"DrawerLayoutButton thumbnail_mode\"><img class=\"\" src=\""+this.imagesBaseURL+"icon_thumbnails.svg\" alt=\"Thumbnails\"/><br>Thumbnails</button>"
      +"        </div>"
      +"        <br>"
      +"        <div class=\"DrawerSettingsTitle\">Zoom</div>"
      +"        <button class='BRicon zoom_out'></button>"
      +"        <button class='BRicon zoom_in'></button>"
      +"        <br style='clear:both'><br><br>"
      +         experimentalHtml
      +"      </div>"
      +"    </li>"
      +"    <li>"
      +"      <span>"
      +"        <span class=\"DrawerIconWrapper \"><img class=\"DrawerIcon\" src=\""+this.imagesBaseURL+"icon_info.svg\" alt=\"info-icon\"/></span>"
      +"        About This Book"
      +"      </span>"
      +"      <div id=\"mobileInfo\"></div>"
      +"    </li>"
      + mobileSearchHtml
      + readAloud
      +"    <li>"
      +"      <span>"
      +"        <span class=\"DrawerIconWrapper \"><img class=\"DrawerIcon\" src=\""+this.imagesBaseURL+"icon_share.svg\" alt=\"info-share\"/></span>"
      +"        Share This Book"
      +"      </span>"
      +"      <div id=\"mobileShare\"></div>"
      +"    </li>"
      +"  </ul>"
      +"</nav>"
    );
}

BookReader.prototype.initToolbar = function(mode, ui) {
    if (ui == "embed") {
        return; // No toolbar at top in embed mode
    }
    var self = this;

    $("#BookReader").append(this.buildToolbarElement());

    // Add Mobile navigation
    // ------------------------------------------------------
    if (this.enableMobileNav) {
      $("body").append(this.buildMobileDrawerElement());

      // Render info into mobile info before mmenu
      this.buildInfoDiv($('#mobileInfo'));
      this.buildShareDiv($('#mobileShare'));

      var $mmenuEl = $('nav#BRmobileMenu');
      $mmenuEl.mmenu({
          navbars: [
             { "position": "top" },
          ],
          navbar: {
            add: true,
            title: this.mobileNavTitle,
            titleLink: 'panel'
          },
          extensions: [ "panelshadow" ],
       }, {
          offCanvas: {
            wrapPageIfNeeded: false,
            zposition: 'next',
            pageSelector: '#BookReader',
          }
      });

      var $BRpageviewField = $mmenuEl.find('.BRpageviewValue');
      $mmenuEl.data('mmenu').bind('opened', function() {
          // Update "Link to this page view" link
          if ($BRpageviewField.length) $BRpageviewField.val(window.location.href);
      });
      this.mmenu = $mmenuEl;
    }

    //--------------------------------------------------------


    $('#BRreturn a')
      .addClass('BRTitleLink')
      .attr({'href': self.bookUrl, 'title': self.bookTitle})
      .html('<span class="BRreturnTitle">' + this.bookTitle + '</span>')
      ;

    if (self.bookUrl && self.bookUrlTitle && self.bookUrlText) {
      $('#BRreturn a').append('<br>' + self.bookUrlText)
    }


    $('#BRtoolbar .BRnavCntl').addClass('BRup');
    $('#BRtoolbar .pause').hide();

    this.updateToolbarZoom(this.reduce); // Pretty format

    if (ui == "embed") {
        $("#BookReader a.logo").attr("target","_blank");
    }

    // $$$ turn this into a member variable
    var jToolbar = $('#BRtoolbar'); // j prefix indicates jQuery object

    // We build in mode 2
    jToolbar.append();

    // Hide mode buttons and autoplay if 2up is not available
    // $$$ if we end up with more than two modes we should show the applicable buttons
    if ( !this.canSwitchToMode(this.constMode2up) ) {
        jToolbar.find('.two_page_mode, .play, .pause').hide();
    }
    if ( !this.canSwitchToMode(this.constModeThumb) ) {
        jToolbar.find('.thumbnail_mode').hide();
    }

    // Hide one page button if it is the only mode available
    if ( ! (this.canSwitchToMode(this.constMode2up) || this.canSwitchToMode(this.constModeThumb)) ) {
        jToolbar.find('.one_page_mode').hide();
    }

    // $$$ Don't hardcode ids
    jToolbar.find('.share').colorbox({
        inline: true,
        opacity: "0.5",
        href: "#BRshare",
        onLoad: function() {
            self.autoStop();
            self.ttsStop();
            $('.BRpageviewValue').val(window.location.href);
        }
    });
    jToolbar.find('.info').colorbox({inline: true, opacity: "0.5", href: "#BRinfo", onLoad: function() { self.autoStop(); self.ttsStop(); } });

    $('<div style="display: none;"></div>').append(
      this.blankShareDiv()
    ).append(
      this.blankInfoDiv()
    ).appendTo($('body'));

    $('#BRinfo .BRfloatTitle a').attr( {'href': this.bookUrl} ).text(this.bookTitle).addClass('title');

    // These functions can be overridden
    this.buildInfoDiv($('#BRinfo'));
    this.buildShareDiv($('#BRshare'));

    // High contrast button
    $('.high-contrast-button').click(function() {
      $('body').toggleClass('high-contrast');
    });

    // Bind mobile switch buttons
    $('.DrawerLayoutButton.one_page_mode').click(function() {
      self.switchMode(self.constMode1up);
    });
    $('.DrawerLayoutButton.two_page_mode').click(function() {
      self.switchMode(self.constMode2up);
    });
    $('.DrawerLayoutButton.thumbnail_mode').click(function() {
      self.switchMode(self.constModeThumb);
    });


    // Bind search form
    if (this.enableSearch) {
        $('.booksearch.desktop').submit(function(e) {
            e.preventDefault();
            var val = $(this).find('.textSrch').val();
            if (!val.length) return false;
            br.search(val);
            return false;
        });
        $('.booksearch.mobile').submit(function(e) {
            e.preventDefault();
            var val = $(this).find('.textSrch').val();
            if (!val.length) return false;
            br.search(val, {
                disablePopup:true,
                error: br.BRSearchCallbackErrorMobile,
            });
            $('#mobileSearchResultWrapper').append(
                '<div class="">Your search results will appear below.</div>'
                + '<div class="loader tc mt20"></div>'
            );
            return false;
        });
        // Handle clearing the search results
        $(".textSrch").bind('input propertychange', function() {
            if (this.value == "") br.removeSearchResults();
        });
    }
};

BookReader.prototype.blankInfoDiv = function() {
    return $([
        '<div class="BRfloat" id="BRinfo">',
            '<div class="BRfloatHead">About this book',
                '<button class="floatShut" href="javascript:;" onclick="$.fn.colorbox.close();"><span class="shift">Close</span></a>',
            '</div>',
            '<div class="BRfloatBody">',
                '<div class="BRfloatCover">',
                '</div>',
                '<div class="BRfloatMeta">',
                    '<div class="BRfloatTitle">',
                        '<h2><a/></h2>',
                    '</div>',
                '</div>',
            '</div>',
            '<div class="BRfloatFoot">',
                '<a href="https://openlibrary.org/dev/docs/bookreader">About the BookReader</a>',
            '</div>',
        '</div>'].join('\n')
    );
};

BookReader.prototype.blankShareDiv = function() {
    return $([
        '<div class="BRfloat" id="BRshare">',
            '<div class="BRfloatHead">',
                'Share',
                '<button class="floatShut" href="javascript:;" onclick="$.fn.colorbox.close();"><span class="shift">Close</span></a>',
            '</div>',
        '</div>'].join('\n')
    );
};


// switchToolbarMode
//______________________________________________________________________________
// Update the toolbar for the given mode (changes navigation buttons)
// $$$ we should soon split the toolbar out into its own module
BookReader.prototype.switchToolbarMode = function(mode) {
    if (1 == mode) {
        // 1-up
        $('#BRtoolbar .BRtoolbarzoom').show().css('display', 'inline');
        $('#BRtoolbar .BRtoolbarmode2').hide();
        $('#BRtoolbar .BRtoolbarmode3').hide();
        $('#BRtoolbar .BRtoolbarmode1').show().css('display', 'inline');
    } else if (2 == mode) {
        // 2-up
        $('#BRtoolbar .BRtoolbarzoom').show().css('display', 'inline');
        $('#BRtoolbar .BRtoolbarmode1').hide();
        $('#BRtoolbar .BRtoolbarmode3').hide();
        $('#BRtoolbar .BRtoolbarmode2').show().css('display', 'inline');
    } else {
        // 3-up
        $('#BRtoolbar .BRtoolbarzoom').hide();
        $('#BRtoolbar .BRtoolbarmode2').hide();
        $('#BRtoolbar .BRtoolbarmode1').hide();
        $('#BRtoolbar .BRtoolbarmode3').show().css('display', 'inline');
    }
};

// updateToolbarZoom(reduce)
//______________________________________________________________________________
// Update the displayed zoom factor based on reduction factor
BookReader.prototype.updateToolbarZoom = function(reduce) {
    var value;
    var autofit = null;

    // $$$ TODO preserve zoom/fit for each mode
    if (this.mode == this.constMode2up) {
        autofit = this.twoPage.autofit;
    } else {
        autofit = this.onePage.autofit;
    }

    if (autofit) {
        value = autofit.slice(0,1).toUpperCase() + autofit.slice(1);
    } else {
        value = (100 / reduce).toFixed(2);
        // Strip trailing zeroes and decimal if all zeroes
        value = value.replace(/0+$/,'');
        value = value.replace(/\.$/,'');
        value += '%';
    }
    $('#BRzoom').text(value);
};

// bindNavigationHandlers
//______________________________________________________________________________
// Bind navigation handlers
BookReader.prototype.bindNavigationHandlers = function() {

    var self = this; // closure
    jIcons = $('.BRicon');

    jIcons.filter('.onepg').bind('click', function(e) {
        self.switchMode(self.constMode1up);
    });

    jIcons.filter('.twopg').bind('click', function(e) {
        self.switchMode(self.constMode2up);
    });

    jIcons.filter('.thumb').bind('click', function(e) {
        self.switchMode(self.constModeThumb);
    });

    jIcons.filter('.fit').bind('fit', function(e) {
        // XXXmang implement autofit zoom
    });

    jIcons.filter('.book_left').click(function(e) {
        self.ttsStop();
        self.left();
        return false;
    });

    jIcons.filter('.book_right').click(function(e) {
        self.ttsStop();
        self.right();
        return false;
    });

    jIcons.filter('.book_up').bind('click', function(e) {
        if ($.inArray(self.mode, [self.constMode1up, self.constModeThumb]) >= 0) {
            self.scrollUp();
        } else {
            self.prev();
        }
        return false;
    });

    jIcons.filter('.book_down').bind('click', function(e) {
        if ($.inArray(self.mode, [self.constMode1up, self.constModeThumb]) >= 0) {
            self.scrollDown();
        } else {
            self.next();
        }
        return false;
    });

    jIcons.filter('.print').click(function(e) {
        self.printPage();
        return false;
    });

    // Note: Functionality has been replaced by .share
    jIcons.filter('.embed').click(function(e) {
        self.showEmbedCode();
        return false;
    });

    jIcons.filter('.bookmark').click(function(e) {
        self.showBookmarkCode();
        return false;
    });

    jIcons.filter('.play').click(function(e) {
        self.autoToggle();
        return false;
    });

    jIcons.filter('.pause').click(function(e) {
        self.autoToggle();
        return false;
    });

    jIcons.filter('.book_top').click(function(e) {
        self.first();
        return false;
    });

    jIcons.filter('.book_bottom').click(function(e) {
        self.last();
        return false;
    });

    jIcons.filter('.book_leftmost').click(function(e) {
        self.leftmost();
        return false;
    });

    jIcons.filter('.book_rightmost').click(function(e) {
        self.rightmost();
        return false;
    });

    jIcons.filter('.read').click(function(e) {
        self.ttsToggle();
        return false;
    });

    jIcons.filter('.zoom_in').bind('click', function() {
        self.ttsStop();
        self.zoom(1);
        return false;
    });

    jIcons.filter('.zoom_out').bind('click', function() {
        self.ttsStop();
        self.zoom(-1);
        return false;
    });

    jIcons.filter('.full').bind('click', function() {
        if (self.ui == 'embed') {
            // $$$ bit of a hack, IA-specific
            var url = (window.location + '').replace("?ui=embed","");
            window.open(url);
        }

        // Not implemented
    });

    $('.BRnavCntl').click(
        function(){
            var promises = [];
            // TODO don't use magic constants
            if ($('#BRnavCntlBtm').hasClass('BRdn')) {
                promises.push($('#BRtoolbar').animate({top: $('#BRtoolbar').height() * -1}).promise());
                promises.push($('#BRnav').animate({bottom:-55}).promise());
                $('#BRnavCntlBtm').addClass('BRup').removeClass('BRdn');
                $('#BRnavCntlTop').addClass('BRdn').removeClass('BRup');
                $('#BRnavCntlBtm.BRnavCntl').animate({height:'45px'});
                $('.BRnavCntl').delay(1000).animate({opacity:.25}, 1000);
            } else {
                promises.push($('#BRtoolbar').animate({top:0}).promise());
                promises.push($('#BRnav').animate({bottom:0}).promise());
                $('#BRnavCntlBtm').addClass('BRdn').removeClass('BRup');
                $('#BRnavCntlTop').addClass('BRup').removeClass('BRdn');
                $('#BRnavCntlBtm.BRnavCntl').animate({height:'30px'});
                $('.BRvavCntl').animate({opacity:1})
            };
            $.when.apply($, promises).done(function() {
              // Only do full resize in auto mode and need to recalc. size
              if (self.mode == self.constMode2up && self.twoPage.autofit != null && self.twoPage.autofit != 'none') {
                self.resize();
              } else if (self.mode == self.constMode1up && self.onePage.autofit != null && self.onePage.autofit != 'none') {
                self.resize();
              } else {
                // Don't do a full resize to avoid redrawing images
                self.resizeBRcontainer();
              }
            });
        }
    );
    $('#BRnavCntlBtm').mouseover(function(){
        if ($(this).hasClass('BRup')) {
            $('.BRnavCntl').animate({opacity:1},250);
        }
    });
    $('#BRnavCntlBtm').mouseleave(function(){
        if ($(this).hasClass('BRup')) {
            $('.BRnavCntl').animate({opacity:.25},250);
        }
    });
    $('#BRnavCntlTop').mouseover(function(){
        if ($(this).hasClass('BRdn')) {
            $('.BRnavCntl').animate({opacity:1},250);
        }
    });
    $('#BRnavCntlTop').mouseleave(function(){
        if ($(this).hasClass('BRdn')) {
            $('.BRnavCntl').animate({opacity:.25},250);
        }
    });

    this.initSwipeData();

    $(document).off('mousemove.navigation', '#BookReader');
    $(document).on(
      'mousemove.navigation',
      '#BookReader',
      { 'br': this },
      this.navigationMousemoveHandler
    );

    $(document).off('mousedown.swipe', '.BRpageimage');
    $(document).on(
      'mousedown.swipe',
      '.BRpageimage',
      { 'br': this },
      this.swipeMousedownHandler
    );

    this.bindMozTouchHandlers();
};

// unbindNavigationHandlers
//______________________________________________________________________________
// Unbind navigation handlers
BookReader.prototype.unbindNavigationHandlers = function() {
    $(document).off('mousemove.navigation', '#BookReader');
};

// navigationMousemoveHandler
//______________________________________________________________________________
// Handle mousemove related to navigation.  Bind at #BookReader level to allow autohide.
BookReader.prototype.navigationMousemoveHandler = function(event) {
    // $$$ possibly not great to be calling this for every mousemove

    if (event.data['br'].uiAutoHide) {
        var navkey = $(document).height() - 75;
        if ((event.pageY < 76) || (event.pageY > navkey)) {
            // inside or near navigation elements
            event.data['br'].hideNavigation();
        } else {
            event.data['br'].showNavigation();
        }
    }
};

BookReader.prototype.initSwipeData = function(clientX, clientY) {
    /*
     * Based on the really quite awesome "Today's Guardian" at http://guardian.gyford.com/
     */
    this._swipe = {
        mightBeSwiping: false,
        didSwipe: false,
        mightBeDraggin: false,
        didDrag: false,
        startTime: (new Date).getTime(),
        startX: clientX,
        startY: clientY,
        lastX: clientX,
        lastY: clientY,
        deltaX: 0,
        deltaY: 0,
        deltaT: 0
    }
};

BookReader.prototype.swipeMousedownHandler = function(event) {
    // console.log('swipe mousedown');
    //console.log(event);

    var self = event.data['br'];

    // We should be the last bubble point for the page images
    // Disable image drag and select, but keep right-click
    if (event.which == 3) {
        return !self.protected;
    }

    $(event.target).bind('mouseout.swipe',
        { 'br': self},
        self.swipeMouseupHandler
    ).bind('mouseup.swipe',
        { 'br': self},
        self.swipeMouseupHandler
    ).bind('mousemove.swipe',
        { 'br': self },
        self.swipeMousemoveHandler
    );

    self.initSwipeData(event.clientX, event.clientY);
    self._swipe.mightBeSwiping = true;
    self._swipe.mightBeDragging = true;

    event.preventDefault();
    event.returnValue  = false;
    event.cancelBubble = true;
    return false;
};

BookReader.prototype.swipeMousemoveHandler = function(event) {
    //console.log('swipe move ' + event.clientX + ',' + event.clientY);

    var _swipe = event.data['br']._swipe;
    if (! _swipe.mightBeSwiping) {
        return;
    }

    // Update swipe data
    _swipe.deltaX = event.clientX - _swipe.startX;
    _swipe.deltaY = event.clientY - _swipe.startY;
    _swipe.deltaT = (new Date).getTime() - _swipe.startTime;

    var absX = Math.abs(_swipe.deltaX);
    var absY = Math.abs(_swipe.deltaY);

    // Minimum distance in the amount of tim to trigger the swipe
    var minSwipeLength = Math.min($('#BookReader').width() / 5, 80);
    var maxSwipeTime = 400;

    // Check for horizontal swipe
    if (absX > absY && (absX > minSwipeLength) && _swipe.deltaT < maxSwipeTime) {
        //console.log('swipe! ' + _swipe.deltaX + ',' + _swipe.deltaY + ' ' + _swipe.deltaT + 'ms');

        _swipe.mightBeSwiping = false; // only trigger once
        _swipe.didSwipe = true;
        if (event.data['br'].mode == event.data['br'].constMode2up) {
            if (_swipe.deltaX < 0) {
                event.data['br'].right();
            } else {
                event.data['br'].left();
            }
        }
    }

    if ( _swipe.deltaT > maxSwipeTime && !_swipe.didSwipe) {
        if (_swipe.mightBeDragging) {
            // Dragging
            _swipe.didDrag = true;
            $('#BRcontainer')
            .scrollTop($('#BRcontainer').scrollTop() - event.clientY + _swipe.lastY)
            .scrollLeft($('#BRcontainer').scrollLeft() - event.clientX + _swipe.lastX);
        }
    }
    _swipe.lastX = event.clientX;
    _swipe.lastY = event.clientY;

    event.preventDefault();
    event.returnValue  = false;
    event.cancelBubble = true;
    return false;
};
BookReader.prototype.swipeMouseupHandler = function(event) {
    var _swipe = event.data['br']._swipe;
    //console.log('swipe mouseup - did swipe ' + _swipe.didSwipe);
    _swipe.mightBeSwiping = false;
    _swipe.mightBeDragging = false;

    $(event.target).unbind('mouseout.swipe').unbind('mouseup.swipe').unbind('mousemove.swipe');

    if (_swipe.didSwipe || _swipe.didDrag) {
        // Swallow event if completed swipe gesture
        event.preventDefault();
        event.returnValue  = false;
        event.cancelBubble = true;
        return false;
    }
    return true;
};
BookReader.prototype.bindMozTouchHandlers = function() {
    var self = this;

    // Currently only want touch handlers in 2up
    $('#BookReader').bind('MozTouchDown', function(event) {
        //console.log('MozTouchDown ' + event.originalEvent.streamId + ' ' + event.target + ' ' + event.clientX + ',' + event.clientY);
        if (this.mode == self.constMode2up) {
            event.preventDefault();
        }
    })
    .bind('MozTouchMove', function(event) {
        //console.log('MozTouchMove - ' + event.originalEvent.streamId + ' ' + event.target + ' ' + event.clientX + ',' + event.clientY)
        if (this.mode == self.constMode2up) {
            event.preventDefault();
        }
    })
    .bind('MozTouchUp', function(event) {
        //console.log('MozTouchUp - ' + event.originalEvent.streamId + ' ' + event.target + ' ' + event.clientX + ',' + event.clientY);
        if (this.mode == self.constMode2up) {
            event.preventDefault();
        }
    });
};

// navigationIsVisible
//______________________________________________________________________________
// Returns true if the navigation elements are currently visible
BookReader.prototype.navigationIsVisible = function() {
    // $$$ doesn't account for transitioning states, nav must be fully visible to return true
    var toolpos = $('#BRtoolbar').offset();
    var tooltop = toolpos.top;
    return tooltop == 0;
};

// hideNavigation
//______________________________________________________________________________
// Hide navigation elements, if visible
BookReader.prototype.hideNavigation = function() {
    // Check if navigation is showing
    if (this.navigationIsVisible()) {
        // $$$ don't hardcode height
        $('#BRtoolbar').animate({top:-60});
        $('#BRnav').animate({bottom:-60});
        //$('#BRzoomer').animate({right:-26});
    }
};

// showNavigation
//______________________________________________________________________________
// Show navigation elements
BookReader.prototype.showNavigation = function() {
    // Check if navigation is hidden
    if (!this.navigationIsVisible()) {
        $('#BRtoolbar').animate({top:0});
        $('#BRnav').animate({bottom:0});
        //$('#BRzoomer').animate({right:0});
    }
};

// changeArrow
//______________________________________________________________________________
// Change the nav bar arrow
function changeArrow(){
    setTimeout(function(){
        $('#BRnavCntlBtm').removeClass('BRdn').addClass('BRup');
    },3000);
}
// firstDisplayableIndex
//______________________________________________________________________________
// Returns the index of the first visible page, dependent on the mode.
// $$$ Currently we cannot display the front/back cover in 2-up and will need to update
// this function when we can as part of https://bugs.launchpad.net/gnubook/+bug/296788
BookReader.prototype.firstDisplayableIndex = function() {
    if (this.mode != this.constMode2up) {
        return 0;
    }

    if ('rl' != this.pageProgression) {
        // LTR
        if (this.getPageSide(0) == 'L') {
            return 0;
        } else {
            return -1;
        }
    } else {
        // RTL
        if (this.getPageSide(0) == 'R') {
            return 0;
        } else {
            return -1;
        }
    }
};

// lastDisplayableIndex
//______________________________________________________________________________
// Returns the index of the last visible page, dependent on the mode.
// $$$ Currently we cannot display the front/back cover in 2-up and will need to update
// this function when we can as pa  rt of https://bugs.launchpad.net/gnubook/+bug/296788
BookReader.prototype.lastDisplayableIndex = function() {

    var lastIndex = this.numLeafs - 1;

    if (this.mode != this.constMode2up) {
        return lastIndex;
    }

    if ('rl' != this.pageProgression) {
        // LTR
        if (this.getPageSide(lastIndex) == 'R') {
            return lastIndex;
        } else {
            return lastIndex + 1;
        }
    } else {
        // RTL
        if (this.getPageSide(lastIndex) == 'L') {
            return lastIndex;
        } else {
            return lastIndex + 1;
        }
    }
};


// updateTheme
//______________________________________________________________________________
BookReader.prototype.updateTheme = function(theme) {
    if (!(theme in this.themes)) return;
    var main_style = $('#BRCSS');
    if (main_style.length == 0) return;
    if (theme == this.theme) return;
    this.theme = theme;

    if (theme == this.default_theme) {
        $('#BRCSSTheme').attr('disabled', true);
        return;
    }

    var stylesheet = $('#BRCSSTheme');
    if (stylesheet.length == 0) {
        stylesheet = $('<link rel="stylesheet" type="text/css">').attr('id', 'BRCSSTheme');
        $('head').append(stylesheet);
    }

    var main_href = $('#BRCSS').attr('href');
    var index = main_href.indexOf('BookReader.css');
    var css_prefix = main_href.substr(0, index);
    var theme_href = css_prefix + this.themes[theme];

    stylesheet.attr({disabled: false, href: theme_href});
};


// shortTitle(maximumCharacters)
//________
// Returns a shortened version of the title with the maximum number of characters
BookReader.prototype.shortTitle = function(maximumCharacters) {
    if (this.bookTitle.length < maximumCharacters) {
        return this.bookTitle;
    }

    var title = this.bookTitle.substr(0, maximumCharacters - 3);
    title += '...';
    return title;
};

// Parameter related functions

// updateFromParams(params)
//________
// Update ourselves from the params object.
//
// e.g. this.updateFromParams(this.paramsFromFragment(window.location.hash))
BookReader.prototype.updateFromParams = function(params) {
    if ('undefined' != typeof(params.mode)) {
        this.switchMode(params.mode);
    }

    // $$$ process /zoom
    var pageFound = false;
    // We only respect page if index is not set
    if ('undefined' != typeof(params.index)) {
        pageFound = true;
        if (params.index != this.currentIndex()) {
            this.jumpToIndex(params.index);
        }
    } else if ('undefined' != typeof(params.page)) {
        pageFound = true;
        // $$$ this assumes page numbers are unique
        if (params.page != this.getPageNum(this.currentIndex())) {
            this.jumpToPage(params.page);
        }
    }

    // process /search
    if ('undefined' != typeof(params.searchTerm) && this.enableSearch) {
        if (this.searchTerm != params.searchTerm) {
            this.search(params.searchTerm, {goToFirstResult: !pageFound});
            // Update the search fields
            $('.textSrch').val(params.searchTerm); // TODO fix issues with placeholder
        }
    }

    // $$$ process /region
    // $$$ process /highlight

    // $$$ process /theme
    if ('undefined' != typeof(params.theme)) {
        this.updateTheme(params.theme);
    }
};

// paramsFromFragment(urlFragment)
//________
// Returns a object with configuration parametes from a URL fragment.
//
// E.g paramsFromFragment(window.location.hash)
BookReader.prototype.paramsFromFragment = function(urlFragment) {
    // URL fragment syntax specification: http://openlibrary.org/dev/docs/bookurls

    var params = {};

    // For convenience we allow an initial # character (as from window.location.hash)
    // but don't require it
    if (urlFragment.substr(0,1) == '#') {
        urlFragment = urlFragment.substr(1);
    }

    // Simple #nn syntax
    var oldStyleLeafNum = parseInt( /^\d+$/.exec(urlFragment) );
    if ( !isNaN(oldStyleLeafNum) ) {
        params.index = oldStyleLeafNum;

        // Done processing if using old-style syntax
        return params;
    }

    // Split into key-value pairs
    var urlArray = urlFragment.split('/');
    var urlHash = {};
    for (var i = 0; i < urlArray.length; i += 2) {
        urlHash[urlArray[i]] = urlArray[i+1];
    }

    // Mode
    if ('1up' == urlHash['mode']) {
        params.mode = this.constMode1up;
    } else if ('2up' == urlHash['mode']) {
        params.mode = this.constMode2up;
    } else if ('thumb' == urlHash['mode']) {
        params.mode = this.constModeThumb;
    }

    // Index and page
    if ('undefined' != typeof(urlHash['page'])) {
        // page was set -- may not be int
        params.page = urlHash['page'];
    }

    // $$$ process /region
    // $$$ process /search

    if (urlHash['search'] != undefined) {
        params.searchTerm = BookReader.util.decodeURIComponentPlus(urlHash['search']);
    }

    // $$$ process /highlight

    // $$$ process /theme
    if (urlHash['theme'] != undefined) {
        params.theme = urlHash['theme']
    }
    return params;
};

// paramsFromCurrent()
//________
// Create a params object from the current parameters.
BookReader.prototype.paramsFromCurrent = function() {

    var params = {};

    var index = this.currentIndex();
    var pageNum = this.getPageNum(index);
    if ((pageNum === 0) || pageNum) {
        params.page = pageNum;
    }

    params.index = index;
    params.mode = this.mode;

    // $$$ highlight
    // $$$ region

    // search
    if (this.enableSearch) {
        params.searchTerm = this.searchTerm;
    }

    return params;
};

// fragmentFromParams(params)
//________
// Create a fragment string from the params object.
// See http://openlibrary.org/dev/docs/bookurls for an explanation of the fragment syntax.
BookReader.prototype.fragmentFromParams = function(params) {
    var separator = '/';

    var fragments = [];

    if ('undefined' != typeof(params.page)) {
        fragments.push('page', params.page);
    } else {
        if ('undefined' != typeof(params.index)) {
            // Don't have page numbering but we do have the index
            fragments.push('page', 'n' + params.index);
        }
    }

    // $$$ highlight
    // $$$ region

    // mode
    if ('undefined' != typeof(params.mode)) {
        if (params.mode == this.constMode1up) {
            fragments.push('mode', '1up');
        } else if (params.mode == this.constMode2up) {
            fragments.push('mode', '2up');
        } else if (params.mode == this.constModeThumb) {
            fragments.push('mode', 'thumb');
        } else {
            throw 'fragmentFromParams called with unknown mode ' + params.mode;
        }
    }

    // search
    if (params.searchTerm) {
        fragments.push('search', params.searchTerm);
    }

    return BookReader.util.encodeURIComponentPlus(fragments.join(separator)).replace(/%2F/g, '/');
};

// getPageIndex(pageNum)
//________
// Returns the *highest* index the given page number, or undefined
BookReader.prototype.getPageIndex = function(pageNum) {
    var pageIndices = this.getPageIndices(pageNum);

    if (pageIndices.length > 0) {
        return pageIndices[pageIndices.length - 1];
    }

    return undefined;
};

// getPageIndices(pageNum)
//________
// Returns an array (possibly empty) of the indices with the given page number
BookReader.prototype.getPageIndices = function(pageNum) {
    var indices = [];

    // Check for special "nXX" page number
    if (pageNum.slice(0,1) == 'n') {
        try {
            var pageIntStr = pageNum.slice(1, pageNum.length);
            var pageIndex = parseInt(pageIntStr);
            indices.push(pageIndex);
            return indices;
        } catch(err) {
            // Do nothing... will run through page names and see if one matches
        }
    }

    var i;
    for (i=0; i<this.numLeafs; i++) {
        if (this.getPageNum(i) == pageNum) {
            indices.push(i);
        }
    }

    return indices;
};

// getPageName(index)
//________
// Returns the name of the page as it should be displayed in the user interface
BookReader.prototype.getPageName = function(index) {
    return 'Page ' + this.getPageNum(index);
};

// updateLocationHash
//________
// Update the location hash from the current parameters.  Call this instead of manually
// using window.location.replace
BookReader.prototype.updateLocationHash = function(skipAnalytics) {
    skipAnalytics = skipAnalytics || false;
    var params = this.paramsFromCurrent();
    var newHash = '#' + this.fragmentFromParams(params);
    if (window.location.hash != newHash) {
        window.location.replace(newHash);
    }

    // Send an analytics event if the location hash is changed (page flip or mode change),
    // which indicates that the user is actively reading the book. This will cause the
    // archive.org download count for this book to increment.
    // Note that users with Adblock Plus will not send data to analytics.archive.org
    if (!skipAnalytics && typeof(archive_analytics) != 'undefined') {
        if (this.oldLocationHash != newHash) {
            var values = {
                'bookreader': 'user_changed_view',
                'itemid': this.bookId,
                'cache_bust': Math.random()
            };
            // EEK!  offsite embedding and /details/ page books look the same in analytics, otherwise!
            values.offsite=1;
            values.details=0;
            try{
              values.offsite=(                     window.top.location.hostname.match(/\.archive.org$/) ? 0 : 1);
              values.details=(!values.offsite  &&  window.top.location.pathname.match(/^\/details\//)   ? 1 : 0);
            } catch (e){} //avoids embed cross site exceptions -- but on (+) side, means it is and keeps marked offite!

            archive_analytics.send_ping(values, null, 'augment_for_ao_site');
        }
    }

    // This is the variable checked in the timer.  Only user-generated changes
    // to the URL will trigger the event.
    this.oldLocationHash = newHash;

    if (this.enablePageResume) {
        this.updateResumeValue(params.index);
    }
};


// startLocationPolling
//________
// Starts polling of window.location to see hash fragment changes
BookReader.prototype.startLocationPolling = function() {
    var self = this; // remember who I am
    self.oldLocationHash = window.location.hash;

    if (this.locationPollId) {
        clearInterval(this.locationPollID);
        this.locationPollId = null;
    }

    this.locationPollId = setInterval(function() {
        var newHash = window.location.hash;
        if (newHash != self.oldLocationHash && newHash != self.oldUserHash) {
            // Only process new user hash once
            //console.log('url change detected ' + self.oldLocationHash + " -> " + newHash);
            self.ttsStop();

            // Queue change if animating
            if (self.animating) {
                self.autoStop();
                self.animationFinishedCallback = function() {
                    self.updateFromParams(self.paramsFromFragment(newHash));
                }
            } else { // update immediately
                self.updateFromParams(self.paramsFromFragment(newHash));
            }
            self.oldUserHash = newHash;
        }
    }, 500);
};

// canSwitchToMode
//________
// Returns true if we can switch to the requested mode
BookReader.prototype.canSwitchToMode = function(mode) {
    if (mode == this.constMode2up || mode == this.constModeThumb) {
        // check there are enough pages to display
        // $$$ this is a workaround for the mis-feature that we can't display
        //     short books in 2up mode
        if (this.numLeafs < 2) {
            return false;
        }
    }

    return true;
};

// searchHighlightVisible
//________
// Returns true if a search highlight is currently being displayed
BookReader.prototype.searchHighlightVisible = function() {
    var results = this.searchResults;
    if (null == results) return false;

    if (this.constMode2up == this.mode) {
        var visiblePages = Array(this.twoPage.currentIndexL, this.twoPage.currentIndexR);
    } else if (this.constMode1up == this.mode) {
        var visiblePages = Array();
        visiblePages[0] = this.currentIndex();
    } else {
        return false;
    }

    var i, j;
    for (i=0; i<results.matches.length; i++) {
        //console.log(results.matches[i].par[0]);
        for (j=0; j<results.matches[i].par[0].boxes.length; j++) {
            var box = results.matches[i].par[0].boxes[j];
            var pageIndex = this.leafNumToIndex(box.page);
            if (jQuery.inArray(pageIndex, visiblePages) >= 0) {
                return true;
            }
        }
    }

    return false;
};

// _getPageWidth
//--------
// Returns the page width for the given index, or first or last page if out of range
BookReader.prototype._getPageWidth = function(index) {
    // Synthesize a page width for pages not actually present in book.
    // May or may not be the best approach.
    // If index is out of range we return the width of first or last page
    index = BookReader.util.clamp(index, 0, this.numLeafs - 1);
    return this.getPageWidth(index);
};

// _getPageHeight
//--------
// Returns the page height for the given index, or first or last page if out of range
BookReader.prototype._getPageHeight= function(index) {
    index = BookReader.util.clamp(index, 0, this.numLeafs - 1);
    return this.getPageHeight(index);
};

// _getPageURI
//--------
// Returns the page URI or transparent image if out of range
BookReader.prototype._getPageURI = function(index, reduce, rotate) {
    if (index < 0 || index >= this.numLeafs) { // Synthesize page
        return this.imagesBaseURL + "transparent.png";
    }

    if ('undefined' == typeof(reduce)) {
        // reduce not passed in
        // $$$ this probably won't work for thumbnail mode
        var ratio = this.getPageHeight(index) / this.twoPage.height;
        var scale;
        // $$$ we make an assumption here that the scales are available pow2 (like kakadu)
        if (ratio < 2) {
            scale = 1;
        } else if (ratio < 4) {
            scale = 2;
        } else if (ratio < 8) {
            scale = 4;
        } else if (ratio < 16) {
            scale = 8;
        } else  if (ratio < 32) {
            scale = 16;
        } else {
            scale = 32;
        }
        reduce = scale;
    }

    return this.getPageURI(index, reduce, rotate);
};

// Stub Method. Original removed from Book Reader source
BookReader.prototype.gotOpenLibraryRecord = function(self, olObject) {};

// Library functions
BookReader.util = {
    disableSelect: function(jObject) {
        // Bind mouse handlers
        // Disable mouse click to avoid selected/highlighted page images - bug 354239
        jObject.bind('mousedown', function(e) {
            // $$$ check here for right-click and don't disable.  Also use jQuery style
            //     for stopping propagation. See https://bugs.edge.launchpad.net/gnubook/+bug/362626
            return false;
        });
        // Special hack for IE7
        jObject[0].onselectstart = function(e) { return false; };
    },

    clamp: function(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },

    // Given value and maximum, calculate a percentage suitable for CSS
    cssPercentage: function(value, max) {
        return (((value + 0.0) / max) * 100) + '%';
    },

    notInArray: function(value, array) {
        // inArray returns -1 or undefined if value not in array
        return ! (jQuery.inArray(value, array) >= 0);
    },

    getIFrameDocument: function(iframe) {
        // Adapted from http://xkr.us/articles/dom/iframe-document/
        var outer = (iframe.contentWindow || iframe.contentDocument);
        return (outer.document || outer);
    },

    escapeHTML: function (str) {
        return(
            str.replace(/&/g,'&amp;').
                replace(/>/g,'&gt;').
                replace(/</g,'&lt;').
                replace(/"/g,'&quot;')
        );
    },

    decodeURIComponentPlus: function(value) {
        // Decodes a URI component and converts '+' to ' '
        return decodeURIComponent(value).replace(/\+/g, ' ');
    },

    encodeURIComponentPlus: function(value) {
        // Encodes a URI component and converts ' ' to '+'
        return encodeURIComponent(value).replace(/%20/g, '+');
    }
    // The final property here must NOT have a comma after it - IE7
};


// ttsToggle()
//______________________________________________________________________________
BookReader.prototype.ttsToggle = function () {
    this.autoStop();
    if (false == this.ttsPlaying) {
        this.ttsPlaying = true;
        this.showProgressPopup('Loading audio...');
        this.ttsStart();
    } else {
        this.ttsStop();
    }
};

// ttsStart(
//______________________________________________________________________________
BookReader.prototype.ttsStart = function () {
    if (soundManager.debugMode) console.log('starting readAloud');
    if (this.constModeThumb == this.mode) this.switchMode(this.constMode1up);
    $('.BRicon.read').addClass('unread');

    //this.ttsPlaying = true; //set this in ttsToggle()
    this.ttsIndex = this.currentIndex();
    this.ttsFormat = 'mp3';
    if ($.browser.mozilla) {
        this.ttsFormat = 'ogg';
    }
    this.ttsGetText(this.ttsIndex, this.ttsStartCB);
    if (navigator.userAgent.match(/mobile/i)) {
        // HACK for iOS. Security restrictions require playback to be triggered
        // by a user click/touch. This intention gets lost in the ajax callback
        // above, but for some reason, if we start the audio here, it works
        soundManager.createSound({url: this.getSoundUrl(' ')}).play();
    }
};

// ttsStop()
//______________________________________________________________________________
BookReader.prototype.ttsStop = function () {
    if (false == this.ttsPlaying) return;
    $('.BRicon.read').removeClass('unread');

    if (soundManager.debugMode) console.log('stopping readaloud');
    soundManager.stopAll();
    soundManager.destroySound('chunk'+this.ttsIndex+'-'+this.ttsPosition);
    this.ttsRemoveHilites();
    this.removeProgressPopup();

    this.ttsPlaying     = false;
    this.ttsIndex       = null;  //leaf index
    this.ttsPosition    = -1;    //chunk (paragraph) number
    this.ttsBuffering   = false;
    this.ttsPoller      = null;
};

// ttsGetText()
//______________________________________________________________________________
BookReader.prototype.ttsGetText = function(index, callback) {
    var url = 'https://'+this.server+'/BookReader/BookReaderGetTextWrapper.php?path='+this.bookPath+'_djvu.xml&page='+index;
    var self = this;
    this.ttsAjax = $.ajax({
      url: url,
      dataType:'jsonp',
      success: function(data) {
        callback.call(self, data);
      }
    });
}

BookReader.prototype.getSoundUrl = function(dataString) {
    return 'https://'+this.server+'/BookReader/BookReaderGetTTS.php?string='
                  + dataString
                  + '&format=.'+this.ttsFormat;
};

// ttsStartCB(): text-to-speech callback
//______________________________________________________________________________
BookReader.prototype.ttsStartCB = function(data) {
    if (soundManager.debugMode)  console.log('ttsStartCB got data: ' + data);
    this.ttsChunks = data;
    this.ttsHilites = [];

    //deal with the page being blank
    if (0 == data.length) {
        if (soundManager.debugMode) console.log('first page is blank!');
        if(this.ttsAdvance(true)) {
            this.ttsGetText(this.ttsIndex, this.ttsStartCB);
        }
        return;
    }

    this.showProgressPopup('Loading audio...');

    ///// Many soundManger2 callbacks are broken when using HTML5 audio.
    ///// whileloading: broken on safari, worked in FF4, but broken on FireFox 5
    ///// onload: fires on safari, but *after* the sound starts playing, and does not fire in FF or IE9
    ///// onbufferchange: fires in FF5 using HTML5 audio, but not in safari using flash audio
    ///// whileplaying: fires everywhere

    var dataString = data[0][0];
    dataString = encodeURIComponent(dataString);

    //the .ogg is to trick SoundManager2 to use the HTML5 audio player;
    var soundUrl = this.getSoundUrl(dataString);

    this.ttsPosition = -1;
    var snd = soundManager.createSound({
     id: 'chunk'+this.ttsIndex+'-0',
     url: soundUrl,
     onload: function(){
       this.br.removeProgressPopup();
     }, //fires in safari...
     onbufferchange: function(){
       if (false == this.isBuffering) {
         this.br.removeProgressPopup();
       }
     }, //fires in FF and IE9
     onready: function() {
       this.br.removeProgressPopup();
     }
    });
    snd.br = this;
    snd.load();

    this.ttsNextChunk();
};

// showProgressPopup
//______________________________________________________________________________
BookReader.prototype.showProgressPopup = function(msg) {
    //if (soundManager.debugMode) console.log('showProgressPopup index='+this.ttsIndex+' pos='+this.ttsPosition);
    if (this.popup) return;

    this.popup = document.createElement("div");
    $(this.popup).css({
        top:      ($('#BookReader').height()*0.5-100) + 'px',
        left:     ($('#BookReader').width()-300)*0.5 + 'px'
    }).prop('className', 'BRprogresspopup');

    var bar = document.createElement("div");
    $(bar).css({
        height:   '20px'
    }).prop('className', 'BRprogressbar');
    $(this.popup).append(bar);

    if (msg) {
        var msgdiv = document.createElement("div");
        msgdiv.innerHTML = msg;
        $(this.popup).append(msgdiv);
    }

    $(this.popup).appendTo('#BookReader');
};

// removeProgressPopup
//______________________________________________________________________________
BookReader.prototype.removeProgressPopup = function() {
    $(this.popup).remove();
    $('.BRprogresspopup').remove();
    this.popup=null;
};

// ttsNextPageCB
//______________________________________________________________________________
BookReader.prototype.ttsNextPageCB = function (data) {
    this.ttsNextChunks = data;
    if (soundManager.debugMode) console.log('preloaded next chunks.. data is ' + data);

    if (true == this.ttsBuffering) {
        if (soundManager.debugMode) console.log('ttsNextPageCB: ttsBuffering is true');
        this.ttsBuffering = false;
    }
};

// ttsLoadChunk
//______________________________________________________________________________
BookReader.prototype.ttsLoadChunk = function (page, pos, string) {
    var snd = soundManager.createSound({
     id: 'chunk'+page+'-'+pos,
     url: 'https://'+this.server+'/BookReader/BookReaderGetTTS.php?string=' + encodeURIComponent(string) + '&format=.'+this.ttsFormat //the .ogg is to trick SoundManager2 to use the HTML5 audio player
    });
    snd.br = this;
    snd.load()
};


// ttsNextChunk()
//______________________________________________________________________________
// This function into two parts: ttsNextChunk gets run before page flip animation
// and ttsNextChunkPhase2 get run after page flip animation.
// If a page flip is necessary, ttsAdvance() will return false so Phase2 isn't
// called. Instead, this.animationFinishedCallback is set, so that Phase2
// continues after animation is finished.

BookReader.prototype.ttsNextChunk = function () {
    if (soundManager.debugMode) console.log('nextchunk pos=' + this.ttsPosition);

    if (-1 != this.ttsPosition) {
        soundManager.destroySound('chunk'+this.ttsIndex+'-'+this.ttsPosition);
    }

    this.ttsRemoveHilites(); //remove old hilights

    var moreToPlay = this.ttsAdvance();

    if (moreToPlay) {
        this.ttsNextChunkPhase2();
    }

    //This function is called again when ttsPlay() has finished playback.
    //If the next chunk of text has not yet finished loading, ttsPlay()
    //will start polling until the next chunk is ready.
};

// ttsNextChunkPhase2()
//______________________________________________________________________________
// page flip animation has now completed
BookReader.prototype.ttsNextChunkPhase2 = function () {
    if (null == this.ttsChunks) {
        alert('error: ttsChunks is null?'); //TODO
        return;
    }

    if (0 == this.ttsChunks.length) {
        if (soundManager.debugMode) console.log('ttsNextChunk2: ttsChunks.length is zero.. hacking...');
        this.ttsStartCB(this.ttsChunks);
        return;
    }

    if (soundManager.debugMode) console.log('next chunk is ' + this.ttsPosition);

    //prefetch next page of text
    if (0 == this.ttsPosition) {
        if (this.ttsIndex<(this.numLeafs-1)) {
            this.ttsGetText(this.ttsIndex+1, this.ttsNextPageCB);
        }
    }

    this.ttsPrefetchAudio();

    this.ttsPlay();
};

// ttsAdvance()
//______________________________________________________________________________
// 1. advance ttsPosition
// 2. if necessary, advance ttsIndex, and copy ttsNextChunks to ttsChunks
// 3. if necessary, flip to current page, or scroll so chunk is visible
// 4. do something smart is ttsNextChunks has not yet finished preloading (TODO)
// 5. stop playing at end of book

BookReader.prototype.ttsAdvance = function (starting) {
    this.ttsPosition++;

    if (this.ttsPosition >= this.ttsChunks.length) {

        if (this.ttsIndex == (this.numLeafs-1)) {
            if (soundManager.debugMode) console.log('tts stop');
            return false;
        } else {
            if ((null != this.ttsNextChunks) || (starting)) {
                if (soundManager.debugMode) console.log('moving to next page!');
                this.ttsIndex++;
                this.ttsPosition = 0;
                this.ttsChunks = this.ttsNextChunks;
                this.ttsNextChunks = null;

                //A page flip might be necessary. This code is confusing since
                //ttsNextChunks might be null if we are starting on a blank page.
                if (this.constMode2up == this.mode) {
                    if ((this.ttsIndex != this.twoPage.currentIndexL) && (this.ttsIndex != this.twoPage.currentIndexR)) {
                        if (!starting) {
                            this.animationFinishedCallback = this.ttsNextChunkPhase2;
                            this.next();
                            return false;
                        } else {
                            this.next();
                            return true;
                        }
                    } else {
                        return true;
                    }
                }
            } else {
                if (soundManager.debugMode) console.log('ttsAdvance: ttsNextChunks is null');
                return false;
            }
        }
    }

    return true;
};

// ttsPrefetchAudio()
//______________________________________________________________________________
BookReader.prototype.ttsPrefetchAudio = function () {

    if(false != this.ttsBuffering) {
        alert('TTS Error: prefetch() called while content still buffering!');
        return;
    }

    //preload next chunk
    var nextPos = this.ttsPosition+1;
    if (nextPos < this.ttsChunks.length) {
        this.ttsLoadChunk(this.ttsIndex, nextPos, this.ttsChunks[nextPos][0]);
    } else {
        //for a short page, preload might nt have yet returned..
        if (soundManager.debugMode) console.log('preloading chunk 0 from next page, index='+(this.ttsIndex+1));
        if (null != this.ttsNextChunks) {
            if (0 != this.ttsNextChunks.length) {
                this.ttsLoadChunk(this.ttsIndex+1, 0, this.ttsNextChunks[0][0]);
            } else {
                if (soundManager.debugMode) console.log('prefetchAudio(): ttsNextChunks is zero length!');
            }
        } else {
            if (soundManager.debugMode) console.log('ttsNextChunks is null, not preloading next page');
            this.ttsBuffering = true;
        }
    }

};

// ttsPlay()
//______________________________________________________________________________
BookReader.prototype.ttsPlay = function () {

    var chunk = this.ttsChunks[this.ttsPosition];
    if (soundManager.debugMode) {
        console.log('ttsPlay position = ' + this.ttsPosition);
        console.log('chunk = ' + chunk);
        console.log(this.ttsChunks);
    }

    //add new hilights
    if (this.constMode2up == this.mode) {
        this.ttsHilite2UP(chunk);
    } else {
        this.ttsHilite1UP(chunk);
    }

    this.ttsScrollToChunk(chunk);

    //play current chunk
    if (false == this.ttsBuffering) {
        soundManager.play('chunk'+this.ttsIndex+'-'+this.ttsPosition,{onfinish:function(){br.ttsNextChunk();}});
    } else {
        soundManager.play('chunk'+this.ttsIndex+'-'+this.ttsPosition,{onfinish:function(){br.ttsStartPolling();}});
    }
};

// scrollToChunk()
//______________________________________________________________________________
BookReader.prototype.ttsScrollToChunk = function(chunk) {
    if (this.constMode1up != this.mode) return;

    var leafTop = 0;
    var h;
    var i;
    for (i=0; i<this.ttsIndex; i++) {
        h = parseInt(this._getPageHeight(i)/this.reduce);
        leafTop += h + this.padding;
    }

    var chunkTop = chunk[1][3]; //coords are in l,b,r,t order
    var chunkBot = chunk[chunk.length-1][1];

    var topOfFirstChunk = leafTop + chunkTop/this.reduce;
    var botOfLastChunk  = leafTop + chunkBot/this.reduce;

    if (soundManager.debugMode) console.log('leafTop = ' + leafTop + ' topOfFirstChunk = ' + topOfFirstChunk + ' botOfLastChunk = ' + botOfLastChunk);

    var containerTop = $('#BRcontainer').prop('scrollTop');
    var containerBot = containerTop + $('#BRcontainer').height();
    if (soundManager.debugMode) console.log('containerTop = ' + containerTop + ' containerBot = ' + containerBot);

    if ((topOfFirstChunk < containerTop) || (botOfLastChunk > containerBot)) {
        //jumpToIndex scrolls so that chunkTop is centered.. we want chunkTop at the top
        //this.jumpToIndex(this.ttsIndex, null, chunkTop);
        $('#BRcontainer').stop(true).animate({scrollTop: topOfFirstChunk},'fast');
    }
};

// ttsHilite1UP()
//______________________________________________________________________________
BookReader.prototype.ttsHilite1UP = function(chunk) {
    var i;
    for (i=1; i<chunk.length; i++) {
        //each rect is an array of l,b,r,t coords (djvu.xml ordering...)
        var l = chunk[i][0];
        var b = chunk[i][1];
        var r = chunk[i][2];
        var t = chunk[i][3];

        var div = document.createElement('div');
        this.ttsHilites.push(div);
        $(div).prop('className', 'BookReaderSearchHilite').appendTo('#pagediv'+this.ttsIndex);

        $(div).css({
            width:  (r-l)/this.reduce + 'px',
            height: (b-t)/this.reduce + 'px',
            left:   l/this.reduce + 'px',
            top:    t/this.reduce +'px'
        });
    }

};

// ttsHilite2UP()
//______________________________________________________________________________
BookReader.prototype.ttsHilite2UP = function (chunk) {
    var i;
    for (i=1; i<chunk.length; i++) {
        //each rect is an array of l,b,r,t coords (djvu.xml ordering...)
        var l = chunk[i][0];
        var b = chunk[i][1];
        var r = chunk[i][2];
        var t = chunk[i][3];

        var div = document.createElement('div');
        this.ttsHilites.push(div);
        $(div).prop('className', 'BookReaderSearchHilite').css('zIndex', 3).appendTo('#BRtwopageview');
        this.setHilightCss2UP(div, this.ttsIndex, l, r, t, b);
    }
};

// ttsRemoveHilites()
//______________________________________________________________________________
BookReader.prototype.ttsRemoveHilites = function (chunk) {
    $(this.ttsHilites).remove();
    this.ttsHilites = [];
};

// ttsStartPolling()
//______________________________________________________________________________
// Play of the current chunk has ended, but the next chunk has not yet been loaded.
// We need to wait for the text for the next page to be loaded, so we can
// load the next audio chunk
BookReader.prototype.ttsStartPolling = function () {
    if (soundManager.debugMode) console.log('Starting the TTS poller...');
    var self = this;
    this.ttsPoller=setInterval(function(){
        if (self.ttsBuffering) {return;}

        if (soundManager.debugMode) console.log('TTS buffering finished!');
        clearInterval(self.ttsPoller);
        self.ttsPoller = null;
        self.ttsPrefetchAudio();
        self.ttsNextChunk();
    },500);
};

BookReader.prototype.buildShareDiv = function(jShareDiv)
{
    var pageView = document.location + '';
    var bookView = (pageView + '').replace(/#.*/,'');
    var self = this;

    var jForm = $([
        '<div class="share-title">Share this book</div>',
        '<div class="share-social">',
          '<div><button class="action share facebook-share-button"><i class="BRicon fb" /> Facebook</button></div>',
          '<div><button class="action share twitter-share-button"><i class="BRicon twitter" /> Twitter</button></div>',
          '<div><button class="action share email-share-button"><i class="BRicon email" /> Email</button></div>',
          '<label class="sub open-to-this-page">',
              '<input class="thispage-social" type="checkbox" />',
              'Open to this page?',
          '</label>',
        '</div>',
        '<div class="share-embed">',
          '<p class="share-embed-prompt">Copy and paste one of these options to share this book elsewhere.</p>',
          '<form method="post" action="">',
              '<fieldset class="fieldset-share-pageview">',
                  '<label for="pageview">Link to this page view</label>',
                  '<input type="text" name="pageview" class="BRpageviewValue" value="' + pageView + '"/>',
              '</fieldset>',
              '<fieldset class="fieldset-share-book-link">',
                  '<label for="booklink">Link to the book</label>',
                  '<input type="text" name="booklink" id="booklink" value="' + bookView + '"/>',
              '</fieldset>',
              '<fieldset class="fieldset-embed">',
                  '<label for="iframe">Embed a mini Book Reader</label>',
                  '<fieldset class="sub">',
                      '<label class="sub">',
                          '<input type="radio" name="pages" value="' + this.constMode1up + '" checked="checked"/>',
                          '1 page',
                      '</label>',
                      '<label class="sub">',
                          '<input type="radio" name="pages" value="' + this.constMode2up + '"/>',
                          '2 pages',
                      '</label>',
                      '<label class="sub">',
                          '<input type="checkbox" name="thispage" value="thispage"/>',
                          'Open to this page?',
                      '</label>',
                  '</fieldset>',
                  '<textarea cols="30" rows="4" name="iframe" class="BRframeEmbed"></textarea>',
              '</fieldset>',
          '</form>',
        '</div>',
        '<div class="BRfloatFoot center">',
            '<button class="share-finished" type="button" onclick="$.fn.colorbox.close();">Finished</button>',
        '</div>'
        ].join('\n'));

    jForm.appendTo(jShareDiv);

    jForm.find('.fieldset-embed input').bind('change', function() {
        var form = $(this).parents('form:first');
        var params = {};
        params.mode = $(form.find('.fieldset-embed input[name=pages]:checked')).val();
        if (form.find('.fieldset-embed input[name=thispage]').prop('checked')) {
            params.page = self.getPageNum(self.currentIndex());
        }

        // $$$ changeable width/height to be added to share UI
        var frameWidth = "480px";
        var frameHeight = "430px";
        form.find('.BRframeEmbed').val(self.getEmbedCode(frameWidth, frameHeight, params));
    });
    jForm.find('input[name=thispage]').trigger('change');
    jForm.find('input, textarea').bind('focus', function() {
        this.select();
    });

    // Bind share buttons

    // Use url without hashes
    var getShareUrl = function() {
      var shareThisPage = jForm.find('.thispage-social').prop('checked');
      if (shareThisPage) {
        return window.location.href;
      } else {
        return document.location.protocol + "//" + window.location.hostname + window.location.pathname;
      }
    };
    jForm.find('.facebook-share-button').click(function(){
      var params = $.param({ u: getShareUrl() });
      var url = 'https://www.facebook.com/sharer.php?' + params;
      self.createPopup(url, 600, 400, 'Share')
    });
    jForm.find('.twitter-share-button').click(function(){
      var params = $.param({
        url: getShareUrl(),
        text: self.bookTitle
      });
      var url = 'https://twitter.com/intent/tweet?' + params;
      self.createPopup(url, 600, 400, 'Share')
    });
    jForm.find('.email-share-button').click(function(){
      var body = self.bookTitle + "\n\n" + getShareUrl();
      window.location.href = 'mailto:?subject=' + encodeURI(self.bookTitle) + '&body=' + encodeURI(body);
    });

    jForm.appendTo(jShareDiv);
};

/**
 * @param JInfoDiv DOM element. Appends info to this element
 * Can be overridden or extended
 */
BookReader.prototype.buildInfoDiv = function(jInfoDiv)
{
    // Remove these legacy elements
    jInfoDiv.find('.BRfloatBody, .BRfloatCover, .BRfloatFoot').remove();

    var $leftCol = $("<div class=\"BRinfoLeftCol\"></div>");
    if (this.thumbnail) {
      $leftCol.append($("<div class=\"BRimageW\">"
      +"  <img src=\""+this.thumbnail+"\" "
      +"       alt=\""+BookReader.util.escapeHTML(this.bookTitle)+"\" />"
      +"</div>"));
    }

    var $rightCol = $("<div class=\"BRinfoRightCol\">");

    // A loop to build fields
    var extraClass;
    for (var i = 0; i < this.metadata.length; i++) {
      extraClass = this.metadata[i].extraValueClass || '';
      $rightCol.append($("<div class=\"BRinfoValueW\">"
      +"  <div class=\"BRinfoLabel\">"
      +     this.metadata[i].label
      +"  </div>"
      +"  <div class=\"BRinfoValue " + extraClass + "\">"
      +     this.metadata[i].value
      +"  </div>"
      +"</div>"));
    }

    var moreInfoText;
    if (this.bookUrlMoreInfo) {
      moreInfoText = this.bookUrlMoreInfo;
    } else if (this.bookTitle) {
      moreInfoText = this.bookTitle;
    }

    if (moreInfoText && this.bookUrl) {
      $rightCol.append($("<div class=\"BRinfoValueW\">"
        +"<div class=\"BRinfoMoreInfoW\">"
        +"  <a class=\"BRinfoMoreInfo\" href=\""+this.bookUrl+"\">"
        +   moreInfoText
        +"  </a>"
        +"</div>"
      +"</div>"));
    }


    var footerEl = "<div class=\"BRfloatFoot BRinfoFooter\"></div>";

    var children = [
      $leftCol,
      $rightCol,
      '<br style="clear:both"/>'
    ];
    var childrenEl = $('<div class="BRinfoW mv20-lg">').append(children);

    jInfoDiv.append(
      childrenEl,
      $(footerEl)
    ).addClass('wide');
};

// Can be overriden
BookReader.prototype.initUIStrings = function()
{
    // Navigation handlers will be bound after all UI is in place -- makes moving icons between
    // the toolbar and nav bar easier

    // Setup tooltips -- later we could load these from a file for i18n
    var titles = { '.logo': 'Go to subjpop.com', // $$$ update after getting OL record
                   '.zoom_in': 'Zoom in',
                   '.zoom_out': 'Zoom out',
                   '.onepg': 'One-page view',
                   '.twopg': 'Two-page view',
                   '.thumb': 'Thumbnail view',
                   '.print': 'Print this page',
                   '.embed': 'Embed BookReader',
                   '.link': 'Link to this book (and page)',
                   '.bookmark': 'Bookmark this page',
                   '.read': 'Read this book aloud',
                   '.share': 'Share this book',
                   '.info': 'About this book',
                   '.full': 'Show fullscreen',
                   '.book_left': 'Flip left',
                   '.book_right': 'Flip right',
                   '.book_up': 'Page up',
                   '.book_down': 'Page down',
                   '.play': 'Play',
                   '.pause': 'Pause',
                   '.BRdn': 'Show/hide nav bar', // Would have to keep updating on state change to have just "Hide nav bar"
                   '.BRup': 'Show/hide nav bar',
                   '.book_top': 'First page',
                   '.book_bottom': 'Last page'
                  };
    if ('rl' == this.pageProgression) {
        titles['.book_leftmost'] = 'Last page';
        titles['.book_rightmost'] = 'First page';
    } else { // LTR
        titles['.book_leftmost'] = 'First page';
        titles['.book_rightmost'] = 'Last page';
    }

    for (var icon in titles) {
        if (titles.hasOwnProperty(icon)) {
            $('#BookReader').find(icon).prop('title', titles[icon]);
        }
    }
}

/**
 * Helper opens a popup window. On mobile it only opens a new tab. Used for share.
 */
BookReader.prototype.createPopup = function(href, width, height, name) {
  // Fixes dual-screen position
  var dualScreenLeft = window.screenLeft != undefined ? window.screenLeft : screen.left;
  var dualScreenTop = window.screenTop != undefined ? window.screenTop : screen.top;

  var win_w = window.innerWidth ? window.innerWidth : document.documentElement.clientWidth ? document.documentElement.clientWidth : screen.width;
  var win_h = window.innerHeight ? window.innerHeight : document.documentElement.clientHeight ? document.documentElement.clientHeight : screen.height;

  var left   = ((win_w / 2) - (width / 2)) + dualScreenLeft,
      top    = ((win_h / 2) - (height / 2)) + dualScreenTop,
      url    = href,
      opts   = 'status=1' +
               ',width='  + width  +
               ',height=' + height +
               ',top='    + top    +
               ',left='   + left;

  window.open(url, name, opts);
};

/**
 * Reloads images. Useful when some images might have failed.
 */
BookReader.prototype.reloadImages = function() {
  $('#BRcontainer img').each(function(index, elem) {
    if (!elem.complete || elem.naturalHeight === 0) {
      var src = elem.src;
      elem.src = '';
      setTimeout(function() {
        elem.src = src;
      }, 1000);
    }
  });
};

BookReader.prototype.getToolBarHeight = function() {
  if ($('#BRtoolbar').css('display') === 'block') {
    return ($('#BRtoolbar').outerHeight() + parseInt($('#BRtoolbar').css('top')));
  } else {
    return 0;
  }
}

/**
 * @param {boolean} ignoreDisplay - bypass the display check
 */
BookReader.prototype.getNavHeight = function(ignoreDisplay) {
  if (ignoreDisplay || $('#BRnav').css('display') === 'block') {
    var outerHeight = $('#BRnav').outerHeight();
    var bottom = parseInt($('#BRnav').css('bottom'));
    if (!isNaN(outerHeight) && !isNaN(bottom)) {
      return outerHeight + bottom;
    }
  }
  return 0;
}


/**
 * Get's the page resume value, for remembering reader's page
 * Can be overriden for different implementation
 * @return {Number|null}
 */
BookReader.prototype.getResumeValue = function() {
    var val = BookReader.docCookies.getItem('br-resume');
    if (val !== null) return parseInt(val);
    else return null;
}

/**
 * Set's the page resume value, for remembering reader's page
 * Can be overriden for different implementation
 * @param {Number} the leaf index
 */
BookReader.prototype.updateResumeValue = function(index) {
    var ttl = new Date(+new Date + 12096e5); // 2 weeks
    var path = window.location.pathname;
    BookReader.docCookies.setItem('br-resume', index, ttl, path, null, false);
}

/*\
|*|  https://developer.mozilla.org/en-US/docs/Web/API/document.cookie
|*|  https://developer.mozilla.org/User:fusionchess
|*|  https://github.com/madmurphy/cookies.js
|*|  This framework is released under the GNU Public License, version 3 or later.
|*|  http://www.gnu.org/licenses/gpl-3.0-standalone.html
\*/
BookReader.docCookies = {
  getItem: function (sKey) {
    if (!sKey) { return null; }
    return decodeURIComponent(document.cookie.replace(new RegExp("(?:(?:^|.*;)\\s*" + encodeURIComponent(sKey).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=\\s*([^;]*).*$)|^.*$"), "$1")) || null;
  },
  setItem: function (sKey, sValue, vEnd, sPath, sDomain, bSecure) {
    var sExpires = "";
    if (vEnd) {
      sExpires = "; expires=" + vEnd.toUTCString();
    }
    document.cookie = encodeURIComponent(sKey) + "=" + encodeURIComponent(sValue) + sExpires + (sDomain ? "; domain=" + sDomain : "") + (sPath ? "; path=" + sPath : "") + (bSecure ? "; secure" : "");
    return true;
  },
  removeItem: function (sKey, sPath, sDomain) {
    if (!this.hasItem(sKey)) { return false; }
    document.cookie = encodeURIComponent(sKey) + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT" + (sDomain ? "; domain=" + sDomain : "") + (sPath ? "; path=" + sPath : "");
    return true;
  },
};


// Fix for deprecated method
jQuery.curCSS = function(element, prop, val) {
    return jQuery(element).css(prop, val);
};

})(jQuery);
