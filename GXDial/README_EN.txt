GX Dial — a customizable speed dial for Opera GX
================================================
(По-русски: см. README.txt)

The extension replaces Opera's default tiles with its own speed dial:
sections and folders, your own tile images, four themes (Neon, Glass,
Calm, Cards) and live animated backgrounds.

The interface is in English and Russian. By default the language follows
your browser; you can switch it in Settings → "Language".


INSTALLATION
------------
1. Unzip the archive to a permanent folder (for example Documents\GXDial).
   Don't delete or move it later, or the extension will disappear.
2. Open  opera://extensions  in Opera.
3. Turn on "Developer mode" (switch at the top right).
4. Click "Load unpacked" and choose the GXDial folder
   (the one with manifest.json inside).
5. Open a new tab (Ctrl+T) — the dial appears.


UPDATING
--------
1. Replace the files in the GXDial folder with the files from the new
   archive (easiest: replace the folder contents completely).
2. In opera://extensions press the reload button (circular arrow) on the
   GX Dial card.
Bookmarks, sections, images and settings are kept.
If Opera disabled the extension after the update (this happens when a new
version adds a permission), just turn it back on.


OPEN THE DIAL RIGHT WHEN OPERA STARTS
-------------------------------------
On startup Opera always opens its own start page first, and the extension
wakes up a moment later — so for 1–3 seconds you see the default tiles.
To avoid that, tell Opera to open GX Dial on startup:

1. Open  opera://settings/onStartup
2. Choose "Open a specific page or set of pages".
3. Add a page with the dial's address. You can copy your exact address
   in the dial itself: Settings (⚙) → "Other" → "When Opera starts" →
   "Copy". It looks like:  chrome-extension://<extension ID>/newtab.html
4. If there is a switch like "Show the start page first", turn it off.

Note: the extension ID changes if you move or rename the GXDial folder and
install the extension again. Then update the address in this setting (and
move your dial bookmarks over).


WHY THE ADDRESS BAR SHOWS chrome-extension://…
----------------------------------------------
It is the normal address of an extension page. Opera doesn't let
extensions hide it or leave the bar empty — the same for every new-tab
extension in Opera. Press F8 or Ctrl+L to type an address right away.


WHAT THE DIAL CAN DO
--------------------
• Sections — as a list or as tabs. Create one with "+ New section"
  ("+ Section" in tabs mode). Rename — double-click the name. Collapse —
  the arrow next to the name. Reorder — drag by the ⠿ handle.
• Folders inside sections — the "Folder" button in the section header.
  Click a folder to open it. To put a tile in a folder, drop it on the
  folder. Deleting a folder doesn't delete its bookmarks.
• Tiles — "+" in a section or "+ Bookmark". Hover a tile:
  ✎ — edit (title, address, section/folder, custom image),
  ✕ — delete. Drag to reorder; drop a tile into another section, folder
  or onto a section tab.
• Middle click or Ctrl+click a tile — open the site in a new tab.
• Visit counter — counts how many times each bookmark was opened
  (click, middle click or search). The number is shown next to the
  title, the most visited ones gather in a "Most visited" row above the
  sections, and the "By visits" button in a section header sorts its
  tiles by popularity (folders stay in place). Settings → "Visits".
• Search — the bar above the sections. It searches Google and your
  bookmarks at once: matching tiles light up, the rest fade out.
  Just start typing anywhere on the page, or press "/". Arrows — pick
  a result, Enter — open, Ctrl+Enter — open in a new tab, Esc — clear.
  Type an address (e.g. github.com) to open it directly. You can turn
  it off in Settings → "Other".
• Clock, date and weather — above the search bar, styled for each theme.
  Seconds are optional. Weather comes from free open services (Open-Meteo, wttr.in, Met Norway): pick a city in
  Settings → "Clock & weather", with °C / °F right there. The only thing
  sent from the browser is the coordinates of the chosen city (and the city
  name when you search for a city). Without internet the clock still works,
  and the weather shows the last data it received. To turn weather off,
  remove the city in settings.
• Settings (⚙ at the top right):
  – Language: Auto (browser language), Русский or English;
  – Theme: Neon / Glass / Calm / Cards (sets its own colors, which you
    can tweak);
  – Sections: list or tabs, backgrounds, spacing;
  – Sizes of tiles, captions, grid and gaps;
  – Cover without image: site address, icon, site color, pattern or letter
    (a single tile can use its own in the "Edit" window);
  – Background: your own image from disk or by URL, dim, blur;
    live background when there is no image (several per theme);
  – Colors, import an Opera bookmarks folder as a section (subfolders
    become folders), reset sizes.
• Esc closes the settings or an open folder.


TROUBLESHOOTING
---------------
• A new tab shows the default tiles — check that "Replace Opera's start
  page" is on in Settings → "Other", and that the extension is enabled
  in opera://extensions.
• All bookmarks disappeared after reinstalling — most likely the GXDial
  folder was moved and the extension got a new ID (data is stored
  separately for each ID).
