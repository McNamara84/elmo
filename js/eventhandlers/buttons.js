/**
 * @file buttons.js
 * @description Main entry point for initializing modular form group logic.
 * Loads all independent modules and sets up global UI interactions such as help toggles and Easter egg.
 * 
 * @module buttons
 */

// ─── Import form group modules ────────────────────────────────────────────────
import './formgroups/feedback.js';
import './formgroups/author.js';
import './formgroups/contributor-person.js';
import './formgroups/contributor-organisation.js';
import './formgroups/resourceinformation-title.js';
import './formgroups/stc.js';
import './formgroups/relatedwork.js';
import './formgroups/fundingreference.js';
import { replaceHelpButtonInClonedRows, createRemoveButton, updateOverlayLabels } from './functions.js';

/**
 * Initializes global event handlers when the DOM is fully loaded.
 */
$(document).ready(function () {
  /**
   * Reads saved preference from localStorage to show/hide help icons.
   */
  if (localStorage.getItem("inputGroupTextVisible") === "false") {
    $(".input-group-text").hide();
  }

  /**
   * Show help tooltips (question mark icons) and save preference.
   */
  $('#buttonHelpOn').click(() => {
    $(".input-group-text").show();
    localStorage.setItem("inputGroupTextVisible", "true");
  });

  /**
   * Hide help tooltips and save preference.
   */
  $('#buttonHelpOff').click(() => {
    $(".input-group-text").hide();
    localStorage.setItem("inputGroupTextVisible", "false");
  });

  /**
   * Easter Egg Hover Tracker
   * Tracks hover events on certain elements and triggers an Easter egg
   * if hovered 30 times within 1-second intervals.
   */
  let hoverCount = 0;
  let timer = null;

  /**
   * Resets the internal hover counter.
   */
  function resetHoverCount() {
    hoverCount = 0;
  }

  /**
   * Hover handler for help icon / theme switch to trigger hidden surprise.
   */
  $("#buttonHelp, #bd-theme").hover(function () {
    hoverCount++;

    if (hoverCount === 30) {
      window.open(
        "doc/egg.html",
        "Egg",
        "width=650,height=450,scrollbars=no,resizable=no,location=no"
      );
      resetHoverCount();
    }

    clearTimeout(timer);
    timer = setTimeout(resetHoverCount, 1000);
  });
});
