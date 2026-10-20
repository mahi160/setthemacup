/**
 * macOS `defaults` the installer keeps applied. Each row is checked against the
 * current value, so re-runs only write what drifted. Keys were verified against
 * macOS 27 (Golden Gate); see docs/tickets/14 for the research.
 */

export type DefaultType = 'bool' | 'int' | 'float' | 'string';

export interface Default {
  group: string;
  domain: string;
  key: string;
  type: DefaultType;
  /** `$HOME` is expanded at runtime */
  value: boolean | number | string;
  desc: string;
  /** `defaults -currentHost` (per-machine prefs) */
  currentHost?: boolean;
  /** App to restart so the change shows */
  restart?: 'Dock' | 'Finder' | 'SystemUIServer';
  /** Protected domain (needs Full Disk Access for the terminal) — a failed write is a warning */
  optional?: boolean;
}

const G = 'NSGlobalDomain';
const DOCK = 'com.apple.dock';
const FINDER = 'com.apple.finder';
const WM = 'com.apple.WindowManager';
const TP = 'com.apple.AppleMultitouchTrackpad';
const BT = 'com.apple.driver.AppleBluetoothMultitouch.trackpad';

const dock = (key: string, type: DefaultType, value: Default['value'], desc: string): Default =>
  ({ group: 'Dock', domain: DOCK, key, type, value, desc, restart: 'Dock' });
const finder = (key: string, type: DefaultType, value: Default['value'], desc: string): Default =>
  ({ group: 'Finder', domain: FINDER, key, type, value, desc, restart: 'Finder' });
const corner = (pos: string, label: string): Default[] => [
  { group: 'Hot corners', domain: DOCK, key: `wvous-${pos}-corner`, type: 'int', value: 1, desc: `${label} corner: no action`, restart: 'Dock' },
  { group: 'Hot corners', domain: DOCK, key: `wvous-${pos}-modifier`, type: 'int', value: 0, desc: `${label} corner: no modifier`, restart: 'Dock' },
];

export const defaults: Default[] = [
  // ── Dock ─────────────────────────────────────────────────────────────────
  dock('autohide', 'bool', true, 'Auto-hide the Dock'),
  dock('autohide-delay', 'float', 0, 'Show the Dock instantly'),
  dock('autohide-time-modifier', 'float', 0, 'No Dock slide animation'),
  dock('show-recents', 'bool', false, 'No recent apps in the Dock'),
  dock('static-only', 'bool', true, 'Dock shows only open apps'),
  dock('tilesize', 'int', 42, 'Small icons'),
  dock('magnification', 'bool', true, 'Magnify on hover'),
  dock('largesize', 'int', 54, 'Magnified size'),
  dock('show-process-indicators', 'bool', false, 'No dots under running apps'),
  dock('showhidden', 'bool', false, "Don't dim hidden apps"),
  dock('minimize-to-application', 'bool', true, 'Minimize into the app icon'),
  dock('mineffect', 'string', 'scale', 'Scale effect (faster than genie)'),
  dock('launchanim', 'bool', false, 'No bouncing on launch'),
  ...corner('tl', 'Top-left'),
  ...corner('tr', 'Top-right'),
  ...corner('bl', 'Bottom-left'),
  ...corner('br', 'Bottom-right'),

  // ── Spaces & windows ─────────────────────────────────────────────────────
  { group: 'Spaces & windows', domain: DOCK, key: 'mru-spaces', type: 'bool', value: false, desc: "Don't reorder Spaces by recent use", restart: 'Dock' },
  { group: 'Spaces & windows', domain: DOCK, key: 'expose-group-apps', type: 'bool', value: true, desc: 'Group windows by app in Mission Control', restart: 'Dock' },
  { group: 'Spaces & windows', domain: DOCK, key: 'workspaces-auto-swoosh', type: 'bool', value: false, desc: "Switching apps doesn't jump to another Space", restart: 'Dock' },
  { group: 'Spaces & windows', domain: DOCK, key: 'enterMissionControlByTopWindowDrag', type: 'bool', value: false, desc: 'Dragging a window to the top tiles it instead of opening Mission Control', restart: 'Dock' },
  { group: 'Spaces & windows', domain: 'com.apple.spaces', key: 'spans-displays', type: 'bool', value: false, desc: 'Each display has its own Spaces (after logout)' },
  { group: 'Spaces & windows', domain: WM, key: 'EnableStandardClickToShowDesktop', type: 'bool', value: false, desc: "Clicking the wallpaper doesn't push windows aside" },
  { group: 'Spaces & windows', domain: WM, key: 'GloballyEnabled', type: 'bool', value: false, desc: 'Stage Manager off' },
  { group: 'Spaces & windows', domain: WM, key: 'StandardHideWidgets', type: 'bool', value: true, desc: 'No widgets on the desktop' },
  { group: 'Spaces & windows', domain: WM, key: 'StageManagerHideWidgets', type: 'bool', value: true, desc: 'No widgets in Stage Manager' },
  { group: 'Spaces & windows', domain: WM, key: 'EnableTiledWindowMargins', type: 'bool', value: false, desc: 'Gapless window tiling' },
  { group: 'Spaces & windows', domain: G, key: 'NSCloseAlwaysConfirmsChanges', type: 'bool', value: true, desc: 'Ask to keep changes when closing documents' },
  { group: 'Spaces & windows', domain: 'com.apple.systempreferences', key: 'NSQuitAlwaysKeepsWindows', type: 'bool', value: false, desc: "Don't reopen windows when apps relaunch" },

  // ── Finder ───────────────────────────────────────────────────────────────
  finder('FXPreferredViewStyle', 'string', 'icnv', 'Icon view by default'),
  finder('ShowPathbar', 'bool', true, 'Path bar'),
  finder('ShowStatusBar', 'bool', true, 'Status bar'),
  finder('AppleShowAllFiles', 'bool', true, 'Show hidden files'),
  finder('NewWindowTarget', 'string', 'PfHm', 'New windows open Home'),
  finder('FXDefaultSearchScope', 'string', 'SCcf', 'Search the current folder'),
  finder('FXEnableExtensionChangeWarning', 'bool', false, 'No warning when changing extensions'),
  finder('_FXSortFoldersFirst', 'bool', true, 'Folders on top in windows'),
  finder('_FXSortFoldersFirstOnDesktop', 'bool', true, 'Folders on top on the desktop'),
  finder('FXRemoveOldTrashItems', 'bool', true, 'Empty Trash items after 30 days'),
  finder('WarnOnEmptyTrash', 'bool', false, 'No confirm when emptying Trash'),
  finder('ShowExternalHardDrivesOnDesktop', 'bool', false, 'No external drives on the desktop'),
  finder('ShowRemovableMediaOnDesktop', 'bool', false, 'No removable media on the desktop'),
  finder('ShowMountedServersOnDesktop', 'bool', false, 'No servers on the desktop'),
  finder('ShowRecentTags', 'bool', false, 'No tags in the sidebar'),
  finder('DisableAllAnimations', 'bool', true, 'No Finder animations'),
  { group: 'Finder', domain: G, key: 'AppleShowAllExtensions', type: 'bool', value: true, desc: 'Show all file extensions', restart: 'Finder' },
  { group: 'Finder', domain: 'com.apple.desktopservices', key: 'DSDontWriteNetworkStores', type: 'bool', value: true, desc: 'No .DS_Store on network shares' },
  { group: 'Finder', domain: 'com.apple.desktopservices', key: 'DSDontWriteUSBStores', type: 'bool', value: true, desc: 'No .DS_Store on USB drives' },

  // ── Dialogs ──────────────────────────────────────────────────────────────
  { group: 'Dialogs', domain: G, key: 'NSNavPanelExpandedStateForSaveMode', type: 'bool', value: true, desc: 'Expanded save dialog' },
  { group: 'Dialogs', domain: G, key: 'NSNavPanelExpandedStateForSaveMode2', type: 'bool', value: true, desc: 'Expanded save dialog' },
  { group: 'Dialogs', domain: G, key: 'PMPrintingExpandedStateForPrint', type: 'bool', value: true, desc: 'Expanded print dialog' },
  { group: 'Dialogs', domain: G, key: 'PMPrintingExpandedStateForPrint2', type: 'bool', value: true, desc: 'Expanded print dialog' },
  { group: 'Dialogs', domain: G, key: 'NSDocumentSaveNewDocumentsToCloud', type: 'bool', value: false, desc: 'Save to disk, not iCloud' },
  { group: 'Dialogs', domain: 'com.apple.print.PrintingPrefs', key: 'Quit When Finished', type: 'bool', value: true, desc: 'Close the printer app when done' },

  // ── Keyboard ─────────────────────────────────────────────────────────────
  { group: 'Keyboard', domain: G, key: 'ApplePressAndHoldEnabled', type: 'bool', value: false, desc: 'Key repeat instead of the accent popup' },
  { group: 'Keyboard', domain: G, key: 'InitialKeyRepeat', type: 'int', value: 25, desc: 'Short delay before repeat' },
  { group: 'Keyboard', domain: G, key: 'KeyRepeat', type: 'int', value: 2, desc: 'Fast key repeat' },
  { group: 'Keyboard', domain: G, key: 'AppleKeyboardUIMode', type: 'int', value: 2, desc: 'Tab moves between all controls' },
  { group: 'Keyboard', domain: G, key: 'NSAutomaticSpellingCorrectionEnabled', type: 'bool', value: false, desc: 'No autocorrect' },
  { group: 'Keyboard', domain: G, key: 'NSAutomaticCapitalizationEnabled', type: 'bool', value: false, desc: 'No auto-capitalization' },
  { group: 'Keyboard', domain: G, key: 'NSAutomaticDashSubstitutionEnabled', type: 'bool', value: false, desc: 'No smart dashes' },
  { group: 'Keyboard', domain: G, key: 'NSAutomaticPeriodSubstitutionEnabled', type: 'bool', value: false, desc: 'No double-space period' },
  { group: 'Keyboard', domain: G, key: 'NSAutomaticQuoteSubstitutionEnabled', type: 'bool', value: false, desc: 'No smart quotes' },

  // ── Trackpad ─────────────────────────────────────────────────────────────
  { group: 'Trackpad', domain: TP, key: 'Clicking', type: 'bool', value: true, desc: 'Tap to click' },
  { group: 'Trackpad', domain: BT, key: 'Clicking', type: 'bool', value: true, desc: 'Tap to click (Bluetooth trackpad)' },
  { group: 'Trackpad', domain: G, key: 'com.apple.mouse.tapBehavior', type: 'int', value: 1, desc: 'Tap to click (login screen)' },
  { group: 'Trackpad', domain: G, key: 'com.apple.mouse.tapBehavior', type: 'int', value: 1, desc: 'Tap to click (this Mac)', currentHost: true },
  { group: 'Trackpad', domain: TP, key: 'TrackpadThreeFingerDrag', type: 'bool', value: false, desc: 'No three-finger drag' },
  { group: 'Trackpad', domain: BT, key: 'TrackpadThreeFingerDrag', type: 'bool', value: false, desc: 'No three-finger drag (Bluetooth)' },
  { group: 'Trackpad', domain: TP, key: 'Dragging', type: 'bool', value: true, desc: 'Double-tap to drag' },
  { group: 'Trackpad', domain: TP, key: 'DragLock', type: 'bool', value: false, desc: 'Drag ends when you lift' },
  { group: 'Trackpad', domain: BT, key: 'Dragging', type: 'bool', value: true, desc: 'Double-tap to drag (Bluetooth)' },
  { group: 'Trackpad', domain: BT, key: 'DragLock', type: 'bool', value: false, desc: 'Drag ends when you lift (Bluetooth)' },
  { group: 'Trackpad', domain: TP, key: 'TrackpadRightClick', type: 'bool', value: true, desc: 'Two-finger right click' },
  { group: 'Trackpad', domain: TP, key: 'TrackpadTwoFingerDoubleTapGesture', type: 'int', value: 1, desc: 'Smart zoom' },
  { group: 'Trackpad', domain: G, key: 'com.apple.trackpad.scaling', type: 'float', value: 2, desc: 'Faster tracking' },
  { group: 'Trackpad', domain: G, key: 'com.apple.trackpad.forceClick', type: 'bool', value: true, desc: 'Force click' },
  { group: 'Trackpad', domain: G, key: 'com.apple.swipescrolldirection', type: 'bool', value: false, desc: 'Classic scroll direction' },
  { group: 'Trackpad', domain: G, key: 'AppleEnableSwipeNavigateWithScrolls', type: 'bool', value: false, desc: 'No swipe back/forward in browsers' },

  // ── Screenshots ──────────────────────────────────────────────────────────
  { group: 'Screenshots', domain: 'com.apple.screencapture', key: 'location', type: 'string', value: '$HOME/Downloads', desc: 'Save to Downloads', restart: 'SystemUIServer' },
  { group: 'Screenshots', domain: 'com.apple.screencapture', key: 'type', type: 'string', value: 'png', desc: 'PNG', restart: 'SystemUIServer' },
  { group: 'Screenshots', domain: 'com.apple.screencapture', key: 'disable-shadow', type: 'bool', value: true, desc: 'No window shadow', restart: 'SystemUIServer' },
  { group: 'Screenshots', domain: 'com.apple.screencapture', key: 'show-thumbnail', type: 'bool', value: false, desc: 'Save instantly (no floating preview)', restart: 'SystemUIServer' },

  // ── Menu bar ─────────────────────────────────────────────────────────────
  { group: 'Menu bar', domain: G, key: '_HIHideMenuBar', type: 'bool', value: false, desc: 'Always show the menu bar' },
  { group: 'Menu bar', domain: 'com.apple.menuextra.clock', key: 'DateFormat', type: 'string', value: 'EEE d MMM  HH:mm', desc: 'Clock: "Tue 20 Oct  15:30"' },
  { group: 'Menu bar', domain: G, key: 'NSStatusItemSpacing', type: 'int', value: 6, desc: 'Tighter menu bar icons (after logout)', currentHost: true },
  { group: 'Menu bar', domain: G, key: 'NSStatusItemSelectionPadding', type: 'int', value: 6, desc: 'Tighter menu bar highlight (after logout)', currentHost: true },

  // ── Speed & appearance ───────────────────────────────────────────────────
  { group: 'Speed & appearance', domain: G, key: 'NSAutomaticWindowAnimationsEnabled', type: 'bool', value: false, desc: 'No window open animations' },
  { group: 'Speed & appearance', domain: G, key: 'NSWindowResizeTime', type: 'float', value: 0.001, desc: 'Instant sheet resize' },
  { group: 'Speed & appearance', domain: G, key: 'QLPanelAnimationDuration', type: 'float', value: 0, desc: 'Instant Quick Look' },
  { group: 'Speed & appearance', domain: G, key: 'AppleReduceDesktopTinting', type: 'bool', value: true, desc: "Windows don't tint to the wallpaper" },
  { group: 'Speed & appearance', domain: 'com.apple.universalaccess', key: 'reduceMotion', type: 'bool', value: true, desc: 'Reduce motion', optional: true },
  { group: 'Speed & appearance', domain: 'com.apple.universalaccess', key: 'reduceTransparency', type: 'bool', value: true, desc: 'Reduce transparency (opaque Liquid Glass)', optional: true },

  // ── Privacy & noise ──────────────────────────────────────────────────────
  { group: 'Privacy & noise', domain: 'com.apple.assistant.support', key: 'Assistant Enabled', type: 'bool', value: false, desc: 'Siri off' },
  { group: 'Privacy & noise', domain: 'com.apple.Siri', key: 'StatusMenuVisible', type: 'bool', value: false, desc: 'No Siri in the menu bar' },
  { group: 'Privacy & noise', domain: 'com.apple.Siri', key: 'UserHasDeclinedEnable', type: 'bool', value: true, desc: "Don't offer Siri" },
  { group: 'Privacy & noise', domain: 'com.apple.gamed', key: 'Disabled', type: 'bool', value: true, desc: 'Game Center off' },
  { group: 'Privacy & noise', domain: 'com.apple.CrashReporter', key: 'DialogType', type: 'string', value: 'none', desc: 'No crash report dialogs' },
  { group: 'Privacy & noise', domain: 'com.apple.coreservices.useractivityd', key: 'ActivityAdvertisingAllowed', type: 'bool', value: false, desc: 'Handoff off (send)' },
  { group: 'Privacy & noise', domain: 'com.apple.coreservices.useractivityd', key: 'ActivityReceivingAllowed', type: 'bool', value: false, desc: 'Handoff off (receive)' },
  { group: 'Privacy & noise', domain: 'com.apple.ImageCapture', key: 'disableHotPlug', type: 'bool', value: true, desc: "Photos doesn't open when a phone is plugged in" },
  { group: 'Privacy & noise', domain: 'com.apple.TimeMachine', key: 'DoNotOfferNewDisksForBackup', type: 'bool', value: true, desc: 'No "use this disk for Time Machine?" prompts' },
];

/** Settings with no reliable `defaults` key — shown after the run. */
export const manualSettings = [
  'Appearance → Liquid Glass: drag the slider to the most opaque setting',
  'Apple Intelligence & Siri → turn off Apple Intelligence if unused (frees several GB)',
  'Notifications → turn off "Summarize Notifications"',
  'Menu Bar → untick the system items you never use',
  'Spotlight → untick categories you don\'t need; add code folders to Search Privacy',
  'General → Login Items & Extensions → remove what you don\'t need',
];
