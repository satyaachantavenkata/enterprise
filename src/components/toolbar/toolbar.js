import * as debug from '../../utils/debug';
import { utils } from '../../utils/utils';
import { Locale } from '../locale/locale';
import { stringUtils } from '../../utils/string';

// jQuery Components
import '../button/button.jquery';
import '../popupmenu/popupmenu.jquery';
import '../searchfield/searchfield.jquery';
import '../tooltip/tooltip.jquery';

// Component Name
const COMPONENT_NAME = 'toolbar';

/**
 * The Toolbar Component manages various levels of application navigation.
 * It contains a group of buttons that functionally related content. Each panel
 * consists of two levels: the top level identifies the category or section header,
 * and the second level provides the associated options.
 *
 * @class Toolbar
 * @param {HTMLElement|jQuery[]} element the base Toolbar element
 * @param {object} [settings] incoming settings
 *
 * @param {boolean} [settings.rightAligned=false] Will always attempt to right-align the contents of
 *  the toolbar. By default if there is no title it will left align. This forces right alignment.
 * @param {number} [settings.maxVisibleButtons=3] Total amount of buttons that can be present, not
 *  including the More button.
 * @param {boolean} [settings.resizeContainers=true] If true, uses Javascript to size the Title and
 *  Buttonset elements in a way that shows as much of the Title area as possible.
 * @param {boolean} [settings.favorButtonset=true] If "resizeContainers" is true, setting this to
 *  true will try to display as many buttons as possible while resizing the toolbar.
 *  Setting to false attempts to show the entire title instead.
 * @param {object} [settings.moreMenuSettings] If defined, provides a toolbar-level method of
 *  defining settings that will be applied to the More Actions button's popupmenu instance.
 * @param {boolean} [settings.noSearchfieldReinvoke=false] If true, does not manage the lifecycle
 *  of an internal toolbarsearchfield automatically.  Allows an external controller
 *  to do it instead.
 */
const TOOLBAR_DEFAULTS = {
  rightAligned: false,
  maxVisibleButtons: 3,
  resizeContainers: true,
  favorButtonset: true,
  moreMenuSettings: undefined,
  noSearchfieldReinvoke: false,
};

function Toolbar(element, settings) {
  this.element = $(element);
  this.settings = utils.mergeSettings(this.element[0], settings, TOOLBAR_DEFAULTS);

  debug.logTimeStart(COMPONENT_NAME);
  this.init();
  debug.logTimeEnd(COMPONENT_NAME);
}

// Plugin Methods
Toolbar.prototype = {

  /**
   * Initializes the Toolbar Component
   * @private
   * @chainable
   * @returns {this} component instance
   */
  init() {
    return this
      .setup()
      .build()
      .handleEvents();
  },

  /**
   * Detects discrepencies in settings.  In general, configures the component
   * based on user settings.
   * @private
   * @chainable
   * @returns {this} component instance
   */
  setup() {
    // Can't have zero buttons
    if (this.settings.maxVisibleButtons <= 0) {
      this.settings.maxVisibleButtons = TOOLBAR_DEFAULTS.maxVisibleButtons;
    }

    return this;
  },

  /**
   * Adds additional markup, wraps some internal elements, and helps construct a
   * complete Toolbar representation in the HTML Markup. This method also builds the
   * "More Actions" menu and ties its elements to the toolbar items.
   * @private
   * @chainable
   * @returns {this} component instance
   */
  build() {
    const self = this;

    this.element.attr('role', 'toolbar');
    if (this.settings.resizeContainers && this.element.is(':not(:hidden)')) {
      this.element[0].classList.add('do-resize');
    }

    this.buildAriaLabel();

    // keep track of how many popupmenus there are with an ID.
    // Used for managing events that are bound to $(document)
    if (!this.id) {
      this.id = (parseInt($('.toolbar, .formatter-toolbar').index(this.element), 10));
    }

    // Check for a "title" element.  This element is optional.
    // If a title element exists, a tooltip will be created for when it's not
    // possible to show the entire title text on screen.
    this.title = this.element.children('.title');
    if (this.title.length) {
      this.element[0].classList.add('has-title');

      this.cutoffTitle = false;
      this.title.on('beforeshow.toolbar', () => self.cutoffTitle).tooltip({
        content: `${this.title.text().trim()}`
      });
    } else {
      this.element[0].classList.remove('has-title');
    }

    // Container for main group of buttons and input fields.  Only these spill into the More menu.
    this.buttonset = this.element.children('.buttonset');
    if (!this.buttonset.length) {
      this.buttonset = $('<div class="buttonset"></div>');
      if (this.title.length) {
        this.buttonset.insertAfter(this.title);
      } else {
        this.buttonset.prependTo(this.element);
      }
    }

    this.element[this.settings.rightAligned ? 'addClass' : 'removeClass']('right-aligned');

    // Add and invoke More Button, if it doesn't exist
    this.more = this.element.find('.btn-actions');
    if (this.more.length === 0 && !this.element.hasClass('no-actions-button')) {
      let moreContainer = this.element.find('.more');

      if (!moreContainer.length) {
        moreContainer = $('<div class="more"></div>').appendTo(this.element);
      }

      this.more = $('<button class="btn-actions" type="button"></button>')
        .html(`${$.createIcon({ icon: 'more' })
        }<span class="audible">${Locale.translate('MoreActions')}</span>`)
        .attr('title', Locale.translate('More'))
        .appendTo(moreContainer);
    }

    // Reference all interactive items in the toolbar
    this.buttonsetItems = this.buttonset.children('button')
      .add(this.buttonset.find('input')); // Searchfield Wrappers

    // Items contains all actionable items in the toolbar, including the ones in
    // the title, and the more button
    this.items = this.buttonsetItems
      .add(this.title.children('button'))
      .add(this.more);

    // Invoke buttons
    const buttons = this.items.filter('button, input[type="button"], [class^="btn"]');
    buttons.each(function () {
      const buttonControl = $(this).data('button');
      if (!buttonControl) {
        $(this).button();
      }

      const tooltipControl = $(this).data('tooltip');
      if (!tooltipControl && $(this).attr('title')) {
        $(this).tooltip();
      }
    });

    // Invoke searchfields
    if (!this.settings.noSearchfieldReinvoke) {
      const searchfields = this.items.filter('.searchfield, .toolbar-searchfield-wrapper, .searchfield-wrapper');
      searchfields.each((i, item) => {
        let sf = $(item);
        if (sf.is('.toolbar-searchfield-wrapper, .searchfield-wrapper')) {
          sf = sf.children('.searchfield');
        }

        if (!sf.data('searchfield')) {
          const searchfieldOpts = $.extend({}, utils.parseSettings(sf[0]));
          sf.searchfield(searchfieldOpts);
        }
      });
    }

    // Setup the More Actions Menu.  Add Menu Items for existing buttons/elements in
    // the toolbar, but hide them initially. They are revealed when overflow checking
    // happens as the menu is opened.
    const popupMenuInstance = this.more.data('popupmenu');
    const moreAriaAttr = this.more.attr('aria-controls');

    if (!popupMenuInstance) {
      this.moreMenu = $(`#${moreAriaAttr}`);
      if (!this.moreMenu.length) {
        this.moreMenu = this.more.next('.popupmenu, .popupmenu-wrapper');
      }
      if (!this.moreMenu.length) {
        this.moreMenu = $(`<ul id="popupmenu-toolbar-${this.id}" class="popupmenu"></ul>`).insertAfter(this.more);
      }

      // Allow toolbar to understand pre-wrapped popupmenus
      // Angular Support -- See SOHO-7008
      if (this.moreMenu.is('.popupmenu-wrapper')) {
        this.moreMenu = this.moreMenu.children('.popupmenu');
      }
    } else {
      this.moreMenu = popupMenuInstance.menu;
    }

    function menuItemFilter() {
      return $(this).parent('.buttonset, .inline').length;
    }

    const menuItems = [];
    this.items.not(this.more).filter(menuItemFilter).each(function () {
      menuItems.push(self.buildMoreActionsMenuItem($(this)));
    });

    menuItems.reverse();
    $.each(menuItems, (i, item) => {
      if (item.text() !== '') {
        item.prependTo(self.moreMenu);
      }
    });

    this.defaultMenuItems = this.moreMenu.children('li:not(.separator)');
    this.hasDefaultMenuItems = this.defaultMenuItems.length > 0;

    // Setup an Event Listener that will refresh the contents of the More Actions
    // Menu's items each time the menu is opened.
    const menuButtonSettings = utils.extend({}, this.settings.moreMenuSettings, {
      trigger: 'click',
      menu: this.moreMenu
    }, (this.hasDefaultMenuItems ? { predefined: this.defaultMenuItems } : {}));
    if (popupMenuInstance) {
      this.more
        .on('beforeopen.toolbar', () => {
          self.refreshMoreActionsMenu(self.moreMenu);
        })
        .triggerHandler('updated', [menuButtonSettings]);
    } else {
      this.more.popupmenu(menuButtonSettings).on('beforeopen.toolbar', () => {
        self.refreshMoreActionsMenu(self.moreMenu);
      });
    }

    // Setup the tabindexes of all items in the toolbar and set the starting active button.
    function setActiveToolbarItem() {
      self.items.attr('tabindex', '-1');

      let active = self.items.filter('.is-selected');
      if (active.length) {
        self.activeButton = active.first().attr('tabindex', '0');
        self.items.not(self.activeButton).removeClass('is-selected');
        return;
      }

      // Set active to the first item in the toolbar.
      active = self.items.filter(':visible:not(:disabled)').first().attr('tabindex', '0');
      self.activeButton = active;

      // If the whole toolbar is hidden (contextual toolbars, etc),
      // automatically set the first non-disabled item as visible
      if (self.element.is(':hidden, .is-hidden')) {
        self.activeButton = self.items.filter(':not(:disabled)').first().attr('tabindex', '0');
        return;
      }

      if (self.isItemOverflowed(active)) {
        active.attr('tabindex', '-1');
        self.activeButton = self.more.addClass('is-selected').attr('tabindex', '0');
      }
    }

    setActiveToolbarItem();

    // Toggles the More Menu based on overflow of toolbar items
    this.adjustMenuItemVisibility();
    this.handleResize();

    /**
     * Fires when the Toolbar has completely rendered all its DOM elements.
     *
     * @event rendered
     * @memberof Toolbar
     * @param {jQuery.Event} e the jQuery Event object
     */
    this.element.triggerHandler('rendered');

    const searchfieldWrapper = this.buttonset.find('.searchfield-wrapper, .toolbar-searchfield-wrapper');
    if (searchfieldWrapper.length) {
      searchfieldWrapper.trigger('reanimate');
    }

    return this;
  },

  /**
   * Builds a single "More Actions Menu" item from a source toolbar item.
   * Also sets up linkage between the menu item and the original toolbar item to
   * allow events/properties to propagate when the More Actions item is acted upon.
   * @private
   * @param {jQuery[]} item the source item from the toolbar.
   * @returns {jQuery[]} a jQuery-wrapped <li> representing a More Actions menu
   *  implementation of the toolbar item.
   */
  buildMoreActionsMenuItem(item) {
    const isSplitButton = false;
    let popupLi;

    // If this item should be skipped, just return out
    if (item.data('skipit') === true) {
      item.data('skipit', undefined);
      return popupLi;
    }

    // Attempt to re-use an existing <li>, if possible.
    // If a new one is created, setup the linkage between the original element and its
    // "More Actions" menu counterpart.
    let a = item.data('action-button-link');

    if (!a || !a.length) {
      popupLi = $('<li></li>');
      a = $('<a href="#"></a>').appendTo(popupLi);

      // Setup data links between the buttons and their corresponding list items
      item.data('action-button-link', a);
      a.data('original-button', item);
    } else {
      popupLi = a.parent();
    }

    // Refresh states
    if (item.hasClass('hidden')) {
      popupLi.addClass('hidden');
    }
    if (item.is(':disabled')) {
      popupLi.addClass('is-disabled');
      a.prop('disabled', true);
    } else {
      popupLi.removeClass('is-disabled');
      a.prop('disabled', false);
    }

    // Refresh Text
    a.text(this.getItemText(item));

    // Pass along any icons except for the dropdown (which is added as part of the submenu design)
    const submenuDesignIcon = $.getBaseURL('#icon-dropdown');
    const icon = item.children('.icon').filter(function () {
      const iconName = $(this).getIconName();
      return iconName && iconName !== submenuDesignIcon && iconName.indexOf('dropdown') === -1;
    });

    if (icon && icon.length) {
      a.html(`<span>${a.text()}</span>`);
      icon.clone().detach().prependTo(a);
    }

    const linkspan = popupLi.find('b');
    if (linkspan.length) {
      this.moreMenu.addClass('has-icons');
      linkspan.detach().prependTo(popupLi);
    }

    function addItemLinksRecursively(menu, diffMenu, parentItem) {
      const children = menu.children('li');
      const id = diffMenu.attr('id');

      diffMenu.children('li').each((i, diffMenuItem) => {
        const dmi = $(diffMenuItem); // "Diffed" Menu Item
        const omi = children.eq(i); // Corresponding "Original" menu item
        const dmiA = dmi.children('a'); // Anchor inside of "Diffed" menu item
        const omiA = omi.children('a'); // Anchor inside of "Original" menu item
        const dmiID = dmi.attr('id');
        const dmiAID = dmiA.attr('id');

        // replace menu item ids with spillover-menu specific ids.
        if (dmiID) {
          dmi.removeAttr('id').attr('data-original-menu-item', dmiID);
        }
        if (dmiAID) {
          dmiA.removeAttr('id').attr('data-original-menu-anchor', dmiAID);
        }

        omiA.data('action-button-link', dmiA);
        dmiA.data('original-button', omiA);

        const omiSubMenu = omi.children('.wrapper').children('.popupmenu');
        const dmiSubMenu = dmi.children('.wrapper').children('.popupmenu');

        if (omiSubMenu.length && dmiSubMenu.length) {
          addItemLinksRecursively(omiSubMenu, dmiSubMenu, dmi);
        }

        if (isSplitButton) {
          dmi.removeClass('is-checked');
        }
      });

      diffMenu.removeAttr('id').attr('data-original-menu', id);
      parentItem.addClass('submenu');

      let appendTarget;
      if (parentItem.is(popupLi)) {
        appendTarget = parentItem.children('.wrapper');
        if (!appendTarget || !appendTarget.length) {
          appendTarget = $('<div class="wrapper"></div>');
        }
        appendTarget.html(diffMenu);
        parentItem.append(appendTarget);
      }
    }

    if (item.is('.btn-menu')) {
      if (!item.data('popupmenu')) {
        item.popupmenu();
      } else if (!a.children('.icon.arrow').length) {
        a.append($.createIcon({
          classes: 'icon arrow icon-dropdown',
          icon: 'dropdown'
        }));
      }

      const menu = item.data('popupmenu').menu;
      const diffMenu = menu.clone();

      addItemLinksRecursively(menu, diffMenu, popupLi);
    }

    if (item.is('[data-popdown]')) {
      item.popdown();
    }

    return popupLi;
  },

  /**
   * Refreshes the More Actions Menu items' text content, icons, states, and submenu content
   * based on changes made directly to their counterpart elements in the Toolbar.  Can also
   * optionally refresh only part of the menu.
   * @param {jQuery[]} menu the menu/submenu to be refreshed.
   */
  refreshMoreActionsMenu(menu) {
    const self = this;

    $('li > a', menu).each(function () {
      const a = $(this);
      const li = a.parent();
      const item = a.data('originalButton');
      let itemParent;
      const text = self.getItemText(item);
      let submenu;

      if (item) {
        if (a.find('span').length) {
          a.find('span').text(text.trim());
        } else {
          a.text(text.trim());
        }

        if (item.isHiddenAtBreakpoint() || item.parent().isHiddenAtBreakpoint()) {
          li.addClass('hidden');
        } else {
          li.removeClass('hidden');
        }

        if (item.parent().is('.is-disabled') || item.is(':disabled')) { // if it's disabled menu item, OR a disabled menu-button
          li.addClass('is-disabled');
          a.prop('disabled', true);
          a.attr('tabindex', '-1');
        } else {
          li.removeClass('is-disabled');
          a.prop('disabled', false);
        }

        if (item.is('a')) {
          itemParent = item.parent('li');

          if (itemParent.is('.is-checked')) {
            li.addClass('is-checked');
          } else {
            li.removeClass('is-checked');
          }
        }

        if (item.is('.btn-menu')) {
          submenu = a.parent().find('.popupmenu').first();
          self.refreshMoreActionsMenu(submenu);
        }
      }
    });
  },

  /**
   * Gets the complete text contnts of a Toolbar Item, in order to create its
   * corresponding "more actions" menu item.
   *
   * Order of operations for populating the List Item text:
   * 1. span contents (.audible), then
   * 2. button title attribute, then
   * 3. tooltip text (if applicable)
   * @param {jQuery[]} item the item being evaluated.
   * @returns {string} the complete text representation.
   */
  getItemText(item) {
    if (!item) {
      return '';
    }
    const span = item.find('span').first();
    const title = item.attr('title');
    const tooltip = item.data('tooltip');
    const tooltipText = tooltip && typeof tooltip.content === 'string' ? tooltip.content : undefined;
    let popupLiText;

    if (title !== '' && title !== undefined) {
      popupLiText = title;
    } else if (tooltipText) {
      popupLiText = tooltipText;
    } else if (span.length) {
      popupLiText = span.text();
    } else {
      popupLiText = item.text();
    }

    return stringUtils.stripHTML(popupLiText);
  },

  /**
   * Sets up all necessary event handling on a Toolbar component
   * @private
   * @chainable
   * @returns {this} component instance
   */
  handleEvents() {
    const self = this;

    this.items
      .off('keydown.toolbar').on('keydown.toolbar', (e) => {
        self.handleKeys(e);
      }).off('click.toolbar').on('click.toolbar', (e) => {
        self.handleClick(e);
      });

    this.items.filter('.btn-menu, .btn-actions')
      .off('close.toolbar').on('close.toolbar', function onClosePopup() {
        const el = $(this);
        let last;

        if (el.is('.is-overflowed')) {
          last = self.getLastVisibleButton();
          if (last && last.length) {
            last[0].focus();
          }
          return;
        }

        el.focus();
        self.buttonset.scrollTop(0);
      });

    this.items.not(this.more).off('selected.toolbar').on('selected.toolbar', (e, anchor) => {
      e.stopPropagation();
      self.handleSelected(e, anchor);
    });

    this.more.on('keydown.toolbar', (e) => {
      self.handleKeys(e);
    }).on('beforeopen.toolbar', () => {
      self.adjustMenuItemVisibility();
    }).on('selected.toolbar', (e, anchor) => {
      e.stopPropagation();
      self.handleSelected(e, anchor);
    });

    // Handle possible AJAX calls on Toolbar Menu buttons
    // TODO: Need to handle mouseenter/touchstart/keydown events that will cause this to trigger,
    // instead of directly handling this itself.
    this.more
      .off('show-submenu.toolbar')
      .on('show-submenu.toolbar', (e, li) => {
        self.handleTransferToMenuButtonItem(e, li);
      });

    this.element.off('updated.toolbar').on('updated.toolbar', (e, settings) => {
      e.stopPropagation();
      self.updated(settings);
    }).off('recalculate-buttons.toolbar').on('recalculate-buttons.toolbar', (e, containerDims) => {
      self.handleResize(containerDims);
    })
      .off('scrollup.toolbar')
      .on('scrollup.toolbar', () => {
        const moduleTabsParent = self.element.parents('.tab-container.module-tabs');
        if (moduleTabsParent.length) {
          moduleTabsParent.scrollTop(0);
        }
      });

    $('body').off(`resize.toolbar-${this.id}`).on(`resize.toolbar-${this.id}`, () => {
      self.handleResize();
    });

    // Trigger _handleResize()_ once to fix container sizes.
    this.handleResize();

    return this;
  },

  /**
   * Event Handler for the Soho Popupmenu's custom 'show-submenu' event, specifically for
   * the case of a menu button that's been spilled over into this Toolbar's More Actions menu.
   * @param {jQuery.Event} e custom `show-submenu` jQuery event
   * @param {jQuery[]} li the `li.submenu` element.
   */
  handleTransferToMenuButtonItem(e, li) {
    const originalMenuButton = li.children('a').data('original-button');
    if (!originalMenuButton) {
      return;
    }

    const popupAPI = originalMenuButton.data('popupmenu');
    if (!popupAPI || typeof popupAPI.settings.beforeOpen !== 'function') {
      return;
    }

    // Call out to the MenuButton's AJAX source, get its contents, and populate
    // the corresponding More Actions menu sub-item.
    popupAPI.callSource(e);
    this.buildMoreActionsMenuItem(originalMenuButton);
  },

  /**
   * Event handler for the Soho `selected` event on toolbar items
   * @private
   * @param {jQuery.Event} e custom `selected` event
   * @param {jQuery[]} anchor a reference to the anchor that was selected
   * @returns {void}
   */
  handleSelected(e, anchor) {
    const itemLink = anchor.data('original-button');
    const li = anchor.parent();
    let itemEvts;
    let toolbarEvts;
    let popup;
    let popupTrigger;

    // Don't continue if hidden/readonly/disabled
    if (li.is('.hidden, .is-disabled') || anchor.is('[readonly], [disabled]')) {
      e.preventDefault();
      return;
    }

    if (itemLink && itemLink.length > 0) {
      itemEvts = itemLink.listEvents();
      toolbarEvts = this.element.listEvents();

      // Make sure the active button is set properly
      this.setActiveButton(itemLink);

      // Handle popdowns with a custom placement algorithm that correctly pops the menu
      // open against the "More Actions" button instead of in an empty space
      // SOHO-7087
      if (itemLink.is('[data-popdown]')) {
        popupTrigger = itemLink.data('popdown');

        if (this.isItemOverflowed(itemLink)) {
          popupTrigger.settings.trigger = this.more;
          popupTrigger.updated();
        }
      }

      // Fire Angular Events
      if (itemLink.attr('ng-click') || itemLink.attr('data-ng-click')) {
        itemLink.trigger('click');
        return;
      }

      // Check the Toolbar Button for the existence of certain event types.
      // Checks the button, and checks the toolbar container element for delegated events.
      const evtTypes = ['click', 'touchend', 'touchcancel'];
      for (let i = 0; i < evtTypes.length; i++) {
        const type = evtTypes[i];

        // Check toolbar element for delegated-down events first
        if (toolbarEvts && toolbarEvts[type] && toolbarEvts[type].delegateCount > 0) {
          const el = this.element;
          const evt = $.Event(type);

          evt.target = el.find(itemLink)[0];
          el.trigger(evt);
          return;
        }

        // Check for events directly on the element
        if ((itemEvts && itemEvts[type]) || itemLink[0][`on${type}`]) {
          itemLink.trigger(type);
          return;
        }
      }

      // If the linked element is a child of a menu button, trigger its 'selected' event.
      popup = itemLink.parents('.popupmenu');
      popupTrigger = popup.data('trigger');
      if (popup.length && popupTrigger instanceof $ && popupTrigger.length) {
        popupTrigger.triggerHandler('selected', [itemLink]);
        return;
      }

      // Manually Trigger Select on the linked item, since it won't be done by another event
      this.triggerSelect(itemLink);
      return;
    }

    // If no item link exists, it's a pre-defined menu item.
    // Trigger 'selected' manually on the toolbar element.
    // Normally this would happen by virtue of triggering the "click"
    // handlers on a linked button above.
    this.triggerSelect(anchor);
  },

  /**
   * Event handler for clicks on toolbar items
   * @private
   * @listens {jQuery.Event} e
   * @param {jQuery.Event} e jQuery click event
   * @returns {boolean} basic "false" return expected for click events
   */
  handleClick(e) {
    this.setActiveButton($(e.currentTarget));
    this.triggerSelect($(e.currentTarget));
    return false;
  },

  /**
   * Event handler for key presses on toolbar items
   * @private
   * @listens {jQuery.Event} e
   * @param {jQuery.Event} e `keypress` event
   * @returns {void}
   */
  handleKeys(e) {
    const self = this;
    const key = e.which;
    const target = $(e.target);
    const isActionButton = target.is('.btn-actions');
    const isRTL = Locale.isRTL();

    if ((key === 37 && target.is(':not(input)')) ||
      (key === 38 && target.is(':not(input.is-open)'))) { // Don't navigate away if Up Arrow in autocomplete field that is open
      e.preventDefault();

      if (isActionButton) {
        self.setActiveButton(isRTL ? self.getFirstVisibleButton() : self.getLastVisibleButton());
      } else {
        self.navigate(isRTL ? 1 : -1);
      }
    }

    if ((key === 39 && target.is(':not(input)')) ||
      (key === 40 && target.is(':not(input.is-open)'))) { // Don't navigate away if Down Arrow in autocomplete field that is open
      e.preventDefault();

      if (isActionButton) {
        self.setActiveButton(isRTL ? self.getLastVisibleButton() : self.getFirstVisibleButton());
      } else {
        self.navigate(isRTL ? -1 : 1);
      }
    }
  },

  /**
   * Re-renders the toolbar element and adjusts all internal parts to account for the new size.
   * @param {object} [containerDims] an object containing dimensions that can be set
   *  on the Toolbar's title and buttonset elements.
   * @param {number} [containerDims.title] represents the width that will be applied
   *  to the title element
   * @param {number} [containerDims.buttonset] represents the width that will be
   *  applied to the buttonset element
   * @returns {void}
   */
  handleResize(containerDims) {
    if (this.settings.resizeContainers) {
      const title = containerDims ? containerDims.title : undefined;
      const buttonset = containerDims ? containerDims.buttonset : undefined;

      this.sizeContainers(title, buttonset);
    }

    const buttons = this.getButtonsetButtons();
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].removeClass('is-overflowed');
    }

    if (this.element.is(':not(:hidden)')) {
      this.adjustMenuItemVisibility();
      this.toggleMoreMenu(); // Added 9/16/2015 due to issue HFC-2876
    }
  },

  /**
   * Resizes the Toolbar's internal container areas (title, buttonset) to make
   * efficient use of their space.
   * @private
   * @chainable
   * @param {number} titleSize desired size of the title element.
   * @param {number} buttonsetSize desired size of the buttonset element.
   */
  sizeContainers(titleSize, buttonsetSize) {
    const containerElem = this.element[0];
    const titleElem = this.title[0];
    const buttonsetElem = this.buttonset[0];
    const moreElem = this.more[0];

    // Don't do this at all unless we have a title element (which is optional)
    if (!this.title || !this.title.length) {
      return;
    }

    // If the element's hidden and has defined sizes, remove them so we can use the defaults.
    if (this.element.is(':hidden')) {
      buttonsetElem.style.width = '';
      titleElem.style.width = '';
      containerElem.classList.remove('do-resize');
      return;
    }

    const WHITE_SPACE = 30;
    const MIN_TITLE_SIZE = 44 + WHITE_SPACE;
    const MIN_BUTTONSET_SIZE = 0;

    buttonsetElem.style.width = '';
    titleElem.style.width = '';

    if (!containerElem.classList.contains('do-resize')) {
      containerElem.classList.add('do-resize');
    }

    const toolbarDims = $(containerElem).getHiddenSize();
    const buttonsetDims = $(buttonsetElem).getHiddenSize();
    const titleDims = $(titleElem).getHiddenSize();
    const moreDims = $(moreElem).getHiddenSize();
    const toolbarPadding = parseInt(toolbarDims.padding.left, 10) +
      parseInt(toolbarDims.padding.right, 10);

    if (isNaN(moreDims.width)) {
      moreDims.width = 50;
    }

    if (isNaN(buttonsetDims.width) || buttonsetDims.width < MIN_BUTTONSET_SIZE) {
      buttonsetDims.width = MIN_BUTTONSET_SIZE;
    }

    function addPx(val) {
      return `${val}px`;
    }

    // Get the target size of the title element
    const self = this;
    const hasTitleSizeGetter = (titleSize !== undefined && !isNaN(titleSize));
    const hasButtonsetSizeGetter = (buttonsetSize !== undefined && !isNaN(buttonsetSize));
    let d;
    this.cutoffTitle = false;

    // Determine the target sizes for title, based on external setters,
    //  or building an estimated size.
    function getTargetTitleWidth() {
      if (hasTitleSizeGetter) {
        return parseInt(titleSize, 10);
      }
      if (self.settings.favorButtonset === true) {
        return toolbarDims.width - (toolbarPadding +
          (hasButtonsetSizeGetter ? parseInt(buttonsetSize, 10) : buttonsetDims.width) +
          moreDims.width);
      }
      return titleDims.scrollWidth;
    }
    let targetTitleWidth = getTargetTitleWidth();

    // Determine the target sizes for buttonset
    function getTargetButtonsetWidth() {
      if (hasButtonsetSizeGetter) {
        return parseInt(buttonsetSize, 10);
      }
      if (self.settings.favorButtonset === true) {
        return buttonsetDims.width;
      }
      return toolbarDims.width - (toolbarPadding +
        (hasTitleSizeGetter ? parseInt(titleSize, 10) : titleDims.scrollWidth) +
        moreDims.width);
    }
    let targetButtonsetWidth = getTargetButtonsetWidth();

    if (this.settings.favorButtonset) {
      // Cut off the buttonset anyway if title is completely hidden.  Something's gotta give!
      if (targetTitleWidth < MIN_TITLE_SIZE) {
        this.cutoffTitle = true;
        d = Math.abs(targetTitleWidth - MIN_TITLE_SIZE);
        targetTitleWidth = MIN_TITLE_SIZE;
        targetButtonsetWidth -= d;
      }

      buttonsetElem.style.width = addPx(targetButtonsetWidth + 2);
      titleElem.style.width = addPx(targetTitleWidth - 2);

      return;
    }
    //= =========================
    // Favor the title element
    // Cut off the title anyway if buttonset is completely hidden.  Something's gotta give!
    if (targetButtonsetWidth < MIN_BUTTONSET_SIZE) {
      this.cutoffTitle = true;
      d = Math.abs(targetButtonsetWidth - MIN_BUTTONSET_SIZE);
      targetButtonsetWidth = MIN_BUTTONSET_SIZE;
      targetTitleWidth -= d;
    }

    // Always favor the title by one extra px for Chrome
    titleElem.style.width = addPx(targetTitleWidth + 2);
    buttonsetElem.style.width = addPx(targetButtonsetWidth - 2);
  },

  /**
   * Changes the "active" button on the toolbar.
   * @param {number} direction can be `-1` (previous), `1` (next), or `0` (remain on current).
   * @returns {void}
   */
  navigate(direction) {
    const items = this.items.filter(':visible:not(:disabled)');
    const current = items.index(this.activeButton);
    const next = current + direction;
    let target;

    if (next >= 0 && next < items.length) {
      target = items.eq(next);
    }

    if (next >= items.length) {
      target = items.first();
    }

    if (next === -1) {
      target = items.last();
    }

    if (this.isItemOverflowed(target)) {
      target = this.more;
    }

    this.setActiveButton(target);
  },

  /**
   * Gets a reference to the last visible (not overflowed) button inside of the buttonset.
   * @returns {jQuery[]} the last visible button in the buttonset.
   */
  getLastVisibleButton() {
    const items = $(this.items.get().reverse()).not(this.more);
    let target;
    let i = 0;
    let elem;

    while (!target && i < items.length) {
      elem = $(items[i]);
      if (!this.isItemOverflowed(elem)) {
        target = elem;
        break;
      }
      i++;
    }

    if (!target || target.length === 0) {
      target = items.first();
    }

    while (target.length && target.is('.separator, *:disabled, *:hidden')) {
      target = target.prev();
    }

    return target;
  },

  /**
   * Gets a reference to the first visible (not overflowed) button inside of the buttonset.
   * @returns {jQuery[]} the first visible button in the buttonset.
   */
  getFirstVisibleButton() {
    let i = 0;
    const items = this.items;
    let target = items.eq(i);

    while (target.is('.separator, *:disabled, *:hidden')) {
      i++;
      target = items.eq(i);
    }

    return target;
  },

  /**
   * Sets the currently "active" (focused) Toolbar item
   * @param {jQuery[]} activeButton the preferred target element to make active.
   * @param {boolean} [noFocus] if defined, prevents this method from giving focus
   *  to the new active button.
   */
  setActiveButton(activeButton, noFocus) {
    // Return out of this if we're clicking the currently-active item
    if (activeButton[0] === this.activeButton[0]) {
      return;
    }

    const self = this;

    function getMoreOrLast() {
      if (self.hasNoMoreButton() || !self.element.hasClass('has-more-button')) {
        return self.getLastVisibleButton();
      }

      return self.more;
    }

    function getActiveButton() {
      // Menu items simply set the "More Actions" button as active
      if (activeButton.is('a')) {
        return getMoreOrLast();
      }

      // If it's the more button, hide the tooltip and set it as active
      const tooltip = self.more.data('tooltip');
      if (activeButton[0] === self.more[0]) {
        if (tooltip && tooltip.tooltip.is(':not(.hidden)')) {
          tooltip.hide();
        }
        return getMoreOrLast();
      }

      // Overflowed items also set
      if (self.isItemOverflowed(activeButton)) {
        if (!activeButton.is('.searchfield')) {
          return getMoreOrLast();
        }
      }

      return activeButton;
    }

    this.items.add(this.more).attr('tabindex', '-1').removeClass('is-selected');

    this.activeButton = getActiveButton();
    this.activeButton.addClass('is-selected').attr('tabindex', '0');

    if (!noFocus) {
      this.activeButton[0].focus();

      /**
       * Fires when the Toolbar's currently `active` element has changed.
       *
       * @event navigate
       * @memberof Toolbar
       * @param {jQuery.Event} e the jQuery Event object
       * @param {jQuery} activeButton a reference to the new active button.
       */
      this.element.triggerHandler('navigate', [this.activeButton]);
    }
  },

  /**
   * Triggers a "selected" event on the base Toolbar element using a common element as an argument.
   * @param {HTMLElement|SVGElement|jQuery[]} element a jQuery Object containing an
   *  anchor tag, button, or input field.
   */
  triggerSelect(element) {
    const elem = $(element);
    if (elem.is(this.more) || (elem.is('.btn-menu, li.submenu'))) {
      return;
    }

    /**
     * Fires when a Toolbar item is selected.
     *
     * @event selected
     * @memberof Toolbar
     * @property {jQuery.Event} e the jQuery event object
     * @property {jQuery[]} itemLink a reference to the corresponding toolbar item, wrapped in a jQuery selector
     */
    this.element.triggerHandler('selected', [elem]);
  },

  /**
   * Assembles and returns a list of all buttons inside the Buttonset element.
   * @returns {array} of elements inside the buttonset
   */
  getButtonsetButtons() {
    const buttons = [];
    const items = this.buttonsetItems;
    let item;

    for (let i = 0; i < items.length; i++) {
      item = items.eq(i);
      if (item.data('action-button-link') !== undefined && item.is(':not(.searchfield)')) {
        buttons.push(item);
      }
    }

    return buttons;
  },

  /**
   * Gets and Iterates through a list of toolbar items and determines which are
   * currently overflowed, and which are visible.
   * @param {array} buttons an Array of jQuery-wrapped elements that represents toolbar items.
   * @returns {object} containing a `visible` items array, and a `hidden` items array.
   */
  getVisibleButtons(buttons) {
    const self = this;
    const hiddenButtons = [];
    const visibleButtons = [];

    if (!buttons || !Array.isArray(buttons)) {
      buttons = this.getButtonsetButtons();
    }

    for (let i = 0; i < buttons.length; i++) {
      buttons[i][0].classList.remove('is-overflowed');
    }

    function getButtonVisibility(button) {
      if (!self.isItemOverflowed(button)) {
        visibleButtons.push(button);
      } else {
        hiddenButtons.push(button);
      }
    }

    for (let i = 0; i < buttons.length; i++) {
      getButtonVisibility(buttons[i]);
    }

    return {
      visible: visibleButtons,
      hidden: hiddenButtons
    };
  },

  /**
   * Gets and Iterates through the full list of Toolbar Items and determines which
   *  ones should currently be present in the More Actions menu.
   * @private
   * @param {object} items an object (normally generated by `_.getVisibleButtons()`)
   *  containing arrays of currently visible and hidden buttons, along with some meta-data.
   * @returns {void}
   */
  adjustMenuItemVisibility(items) {
    let iconDisplay = 'removeClass';

    if (!items) {
      items = this.getVisibleButtons();
    }

    function toggleClass($elem, doHide) {
      const elem = $elem[0];
      const li = $elem.data('action-button-link').parent()[0];
      const elemIsHidden = $elem.isHiddenAtBreakpoint();

      if (doHide) {
        li.classList.add('hidden');
        elem.classList.remove('is-overflowed');
        return;
      }

      if (!elemIsHidden) {
        li.classList.remove('hidden');
      }
      elem.classList.add('is-overflowed');

      if ($elem.find('.icon').length) {
        iconDisplay = 'addClass';
      }
    }

    let i = 0;
    for (i; i < items.visible.length; i++) {
      toggleClass(items.visible[i], true);
    }
    for (i = 0; i < items.hidden.length; i++) {
      toggleClass(items.hidden[i], false);
    }

    let numIcons = 0;
    this.moreMenu.find('.icon').each(function () {
      if (!$(this).parent().parent().hasClass('hidden')) {
        numIcons++;
      }
    });

    if (numIcons > 0) {
      iconDisplay = 'addClass';
    }

    this.moreMenu[iconDisplay]('has-icons');
  },

  /**
   * Detects whether or not a toolbar item is currently overflowed.  In general,
   *  toolbar items are considered overflow if their right-most edge sits past the
   *  right-most edge of the buttonset border.  There are some edge-cases.
   * @param {jQuery[]} item the Toolbar item being tested.
   * @returns {boolean} whether or not the item belongs in the More Actions menu
   */
  isItemOverflowed(item) {
    // No items will be overflowed if the `More Actions` menu is purposefully disabled.
    if (this.moreButtonIsDisabled()) {
      return false;
    }

    if (!item || item.length === 0) {
      return true;
    }

    const itemIndexInButtonset = this.buttonsetItems.filter(':not(.hidden)').index(item);
    let maxVisibleButtons = this.settings.maxVisibleButtons;

    // the `maxVisibleButtons` calculation should include a visible More Actions button.
    // Subtract one from the `maxVisibleButtons` setting to account for the More Button,
    // if it's visible. See SOHO-7237
    if (this.moreButtonIsVisible()) {
      maxVisibleButtons -= 1;
    }

    // In cases where a Title is present and buttons are right-aligned,
    // only show up to the maximum allowed.
    if (this.title.length) {
      if (itemIndexInButtonset >= maxVisibleButtons) {
        return true;
      }
    }

    if (this.buttonset.scrollTop() > 0) {
      this.buttonset.scrollTop(0);
    }

    // unwrap from jQuery
    if (item instanceof $ && item.length) {
      item = item[0];
    }

    const classList = item.classList;
    const style = window.getComputedStyle(item);

    if (classList.contains('btn-actions')) {
      return true;
    }
    if (classList.contains('searchfield')) {
      return false;
    }
    if (style.display === 'none') {
      return true;
    }

    const isRTL = Locale.isRTL();
    const itemRect = item.getBoundingClientRect();
    const buttonsetRect = this.buttonset[0].getBoundingClientRect();
    const itemOutsideXEdge = isRTL ? (itemRect.left <= buttonsetRect.left) :
      (itemRect.right >= buttonsetRect.right);
    const itemBelowYEdge = itemRect.bottom >= buttonsetRect.bottom;

    return (itemBelowYEdge === true || itemOutsideXEdge === true);
  },

  /**
   * @returns {boolean} whether or not this toolbar is able to have a More Button
   */
  moreButtonIsDisabled() {
    return this.element[0].classList.contains('no-actions-button');
  },

  /**
   * Detection for this toolbar to have a More Button
   * @deprecated as of v4.4.0 due to unclear nomenclature.  Use `moreButtonIsDisabled()`
   * @private
   * @returns {boolean} whether or not the More Actions button is disabled.
   */
  hasNoMoreButton() {
    return this.moreButtonIsDisabled();
  },

  /**
  * Detection for whether or not More Actions menu is currently visible.  This is
  * different than the More Actions menu being disabled.  This check determines
  * whether or not items have spilled over, causing the menu to be shown or hidden.
  * @returns {boolean} whether or not More Actions menu is currently visible.
  */
  moreButtonIsVisible() {
    return this.element[0].classList.contains('has-more-button');
  },

  /**
   * Determines whether or not the "more actions" button should be displayed.
   * @private
   * @returns {undefined} whether or not the "more actions" button should be displayed.
   */
  toggleMoreMenu() {
    if (this.moreButtonIsDisabled()) {
      return;
    }

    const overflowItems = this.moreMenu.children('li:not(.separator)');
    const hiddenOverflowItems = overflowItems.not('.hidden');

    let method = 'removeClass';
    if (hiddenOverflowItems.length > 0) {
      method = 'addClass';
    }

    this.element[method]('has-more-button');

    const popupAPI = this.more.data('popupmenu');
    if (method === 'removeClass') {
      if (!popupAPI) {
        return;
      }

      popupAPI.close();

      const menuItems = popupAPI.menu.find('li:not(.separator)').children('a');
      let shouldFocus = false;

      menuItems.add(this.more).each(function () {
        if (document.activeElement === this) {
          shouldFocus = true;
        }
      });

      if (shouldFocus) {
        this.getLastVisibleButton()[0].focus();
      }
    }
  },

  /**
   * Creates an `aria-label` attribute on the toolbar, for bettery accessibility.
   * Based on AOL Access Guidelines:
   * http://access.aol.com/dhtml-style-guide-working-group/#toolbar
   * @private
   * @returns {void}
   */
  buildAriaLabel() {
    // Don't re-build if one already exists.
    if (this.element.attr('aria-label')) {
      return;
    }

    const isHeader = (this.element.closest('.header').length === 1);
    const id = this.element.attr('id') || '';
    const title = this.element.children('.title');
    const prevLabel = this.element.prev('label');
    const prevSpan = this.element.prev('.label');

    function getLabelText() {
      if (isHeader) {
        return $('header.header').find('h1').text();
      }
      if (title.length) {
        return title.filter('div').text();
      }
      if (prevLabel.length) {
        return prevLabel.text();
      }
      if (prevSpan.length) {
        return prevSpan.text();
      }
      return `${id} ${Locale.translate('Toolbar')}`;
    }
    const labelText = getLabelText();

    this.element.attr('aria-label', labelText.replace(/\s+/g, ' ').trim());
  },

  /**
   * @param {object} [settings] incoming different settings
   * @returns {void}
   */
  updated(settings) {
    if (settings) {
      this.settings = utils.mergeSettings(this.element[0], settings, this.settings);
    }

    this
      .unbind()
      .teardown()
      .init();
  },

  /**
   * Enables the entire Toolbar component
   * @returns {void}
   */
  enable() {
    this.element.prop('disabled', false);
    this.items.prop('disabled', false);
    this.more.prop('disabled', false);
  },

  /**
   * Disables the entire Toolbar component
   * @returns {void}
   */
  disable() {
    this.element.prop('disabled', true);
    this.items.prop('disabled', true);
    this.more.prop('disabled', true).data('popupmenu').close();
  },

  /**
   * Removes currently associated event listeners from the Toolbar.
   * @private
   * @chainable
   * @returns {this} component instance
   */
  unbind() {
    this.items
      .off('keydown.toolbar click.toolbar focus.toolbar blur.toolbar');

    this.more.off('keydown.toolbar beforeopen.toolbar selected.toolbar');
    $('body').off(`resize.toolbar-${this.id}`);
    return this;
  },

  /**
   * Returns the Toolbar's internal markup to its original state.
   * @chainable
   * @returns {this} component instance
   */
  teardown() {
    const self = this;

    if (this.title && this.title.length) {
      const dataTooltip = this.title.off('beforeshow.toolbar').data('tooltip');
      if (dataTooltip) {
        dataTooltip.destroy();
      }
    }

    const moreMenuChildren = this.moreMenu.children('li');
    moreMenuChildren.each(function () {
      self.teardownMoreActionsMenuItem($(this), true);
    });

    // Remove AJAX-ified menu items.
    moreMenuChildren.not(this.defaultMenuItems).remove();

    return this;
  },

  /**
   * Tears down a More Actions Menu item.
   * @private
   * @param {jQuery[]} item the existing <li> from inside the More Actions menu.
   * @param {boolean} doRemove if defined, causes the list item to be removed from
   *  the more actions menu.
   */
  teardownMoreActionsMenuItem(item, doRemove) {
    const self = this;
    const li = $(item);
    const a = li.children('a');
    const itemLink = a.data('original-button');

    a.off('updated.toolbar mousedown.toolbar click.toolbar touchend.toolbar touchcancel.toolbar recalculate-buttons.toolbar');

    const icons = li.find('.icon');
    if (icons.length) {
      icons.remove();
    }

    let submenuContainer;
    if (li.is('.submenu')) {
      submenuContainer = li.children('.wrapper').children('.popupmenu');
      submenuContainer.children('li').each(function () {
        self.teardownMoreActionsMenuItem($(this), true);
      });
    }

    if (itemLink && itemLink.length) {
      $.removeData(a[0], 'original-button');
      $.removeData(itemLink[0], 'action-button-link');
      a.remove();

      if (submenuContainer) {
        submenuContainer
          .off()
          .parent('.wrapper')
          .off()
          .remove();
      }

      if (doRemove) {
        li.remove();
      }
    }
  },

  /**
   * Destroys this Toolbar Component instance and completely disassociates it from
   *  its corresponding DOM Element.
   * @returns {void}
   */
  destroy() {
    this
      .unbind()
      .teardown();

    if (this.buttonset.children('.searchfield-wrapper').length) {
      const searchFields = this.buttonset.children('.searchfield-wrapper').children('.searchfield');
      if (searchFields.data('searchfield')) {
        searchFields.data('searchfield').destroy();
      }
    }

    if (this.more.length && this.more.data('popupmenu') !== undefined) {
      this.more.data('popupmenu').destroy();
    }

    this.element[0].classList.remove('do-resize');
    this.buttonset[0].style.width = '';
    if (this.title && this.title.length) {
      this.title[0].style.width = '';
    }

    this.element.removeAttr('role').removeAttr('aria-label');
    $.removeData(this.element[0], COMPONENT_NAME);
  }
};

export { Toolbar, COMPONENT_NAME };
