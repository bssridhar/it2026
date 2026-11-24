/*
 * Version of the tool kit – shown at the bottom of the home page and read by "Update tool kit.bat".
 * Changed with every release; do not edit.
 */
window.KIT_VERSION = {
  version: 39,
  date: "2026-11-25",
  whatsNew: [
    "Tool kit server: accepts new registers without a restart; the home page warns if the running server is older than the tool kit files (with how to restart it).",
    "Holiday List (Office): holidays in their own file, shown year-wise with the day; edit, add several at once, print, copy. The Important strip shows a coming holiday from 5 days before (\"Holiday tomorrow …\"). Notices and Birthdays no longer has the holidays.",
    "Home page: \"Important\" strip (dark brown, bold yellow) below the notices, and colourful birthday wishes for team members. Edit them in Office → Notices, Holidays and Birthdays. Restart is automatic with Update tool kit.bat.",
    "DSC Register: mark a DSC as an inactive client (not renewing / account closed) – it moves out of the expired list and reminders into its own \"Inactive clients\" filter; Reactivate brings it back.",
    "Tool kit server without a window: \"Start tool kit server (hidden).vbs\" and \"Stop tool kit server.bat\"; log in server\\server.log; Update tool kit.bat restarts a running server with the new version.",
    "Tool kit server: fixed \"Not saved in the folder … The path is not of a legal form\" when a register was saved the second time. Restart the server after updating.",
    "Tool kit server for the office LAN: start it on the main computer (\"Start tool kit server.bat\"), open the tool kit at its address on every computer; the DSC Register and Checklists and Procedures are kept by the server in the data folder set in kit-config.json – nothing to connect or allow in the browser.",
    "Home page: the database folder line no longer stays at \"checking…\" – it shows the result or the reason within a few seconds.",
    "Database folder: when the browser refuses without asking, the message explains how to switch on its \"File editing\" permission, and shows the browser's own error text.",
    "Connecting the database folder: says exactly what went wrong (the browser's \"Edit files\" question cancelled, a folder that is not the tool kit, the \"shared\" folder, a system folder); choosing the folder that contains the tool kit folder now works too.",
    "DSC Register and Checklists and Procedures: once the database folder is connected, Save opens and saves the register there (no more \"where should it be saved\"); a clear \"Open the register\" button when the browser needs permission; your name is asked when missing and shared by both tools.",
    "Database folder: clearer Connect on the home page – says what to choose, checks that the folder can be written and lists the registers in it, and explains why if a folder cannot be used.",
    "Updating made simple: \"Update tool kit.bat\" backs up the database folder and installs a new version; your own settings are kept in my-settings.js.",
    "Version number and what's new shown at the bottom of the home page.",
    "Common database folder (next to \"shared\") for the DSC Register and Checklists and Procedures.",
    "Checklists and Procedures: client checklists, procedures and links, copied into emails with the formatting; archive by category.",
    "Save into the opened case file and Save as… in all the tools.",
    "Capital Gains Calculation: formatted copy for Word / Excel, A4 print layout, Rs. 10 crore cap shown in the working."
  ]
};
