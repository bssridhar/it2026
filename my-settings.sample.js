/*
 * YOUR OWN SETTINGS for the home page – kept when the tool kit is updated.
 *
 * "Update tool kit.bat" makes a copy of this file named my-settings.js the first time (if there is none) and never
 * replaces my-settings.js afterwards. Edit my-settings.js (in Notepad), not this sample: the sample is replaced by
 * every update. Keep the quotes and commas as they are. Delete a line (or leave it as it is) to use the default.
 */
window.MY_SETTINGS = {
  // Name and the line under it at the top of the home page.
  firmName: "B S Sridhar & Co., Chartered Accountants",
  tagline: "Practice tool kit – for internal use",

  // Your own notices for the scrolling ticker – shown before the notices that come with the tool kit.
  myNotices: [
    // "Office closed on 25-12-2026.",
  ],

  // true: show only your notices (hide the tool kit's "New: …" notices).
  onlyMyNotices: false,

  // Tools not used in the office – their ids, e.g. ["huf", "voucher"]. The ids are in home-config.js.
  hideTools: []
};
