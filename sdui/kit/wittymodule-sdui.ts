// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// Written by WittyModule's kit/module-kit.sh from kit/sdui: don't edit, run module-kit.sh again.

// A module's SDUI in TypeScript: the types of sdui.json, a few constructors for common
// sections, and checkModuleUI, which makes the server's checks that can be made without
// a server. The format is the server's (WittyMediaServer pkg/sdui/module.go,
// docs/SDUI-MODULES.md, docs/sdui-module.schema.json); this file only describes it.
//
// Plain TypeScript with no dependencies and nothing a type-stripper can't remove (no
// enums, namespaces or parameter properties), so it runs in Node 22.6+ with type
// stripping and in anything built with Vite or esbuild. It reads the catalogue and the
// JSON Schema from the JSON files beside it.
//
//   import { defineModuleUI, shelf, checkModuleUI } from './kit/wittymodule-sdui.ts'
//
// `wittymodule check` and the server make the full check; this one is for the editor and
// the build, so that a mistake is found before a release.

import catalogJSON from './catalog.json' with { type: 'json' }
import schemaJSON from './sdui-module.schema.json' with { type: 'json' }

// ---------------------------------------------------------------------------
// The format and its limits.
// ---------------------------------------------------------------------------

/** The `format` of a module's SDUI file. */
export const FORMAT = 'wittymodule-sdui'
/** The `formatVersion` this kit writes and the server reads. */
export const FORMAT_VERSION = 1
/** The file's name, beside module.json in a release. */
export const MODULE_FILE = 'sdui.json'
/** The most a module's SDUI file may weigh, in bytes. */
export const MAX_MODULE_BYTES = 1 << 20

/** How many of each thing one module may add. */
export const MODULE_LIMITS = {
  pages: 32,
  sources: 64,
  components: 64,
  navigation: 16,
  settings: 16,
  views: 32,
  inserts: 32,
  presets: 64,
  /** rows on one settings page */
  rows: 64,
} as const

/** Limits on any page (the catalogue's `limits`). */
export const PAGE_LIMITS = {
  maxPageBytes: 256 << 10,
  maxSections: 200,
  maxDepth: 6,
  maxChildren: 60,
  maxVariants: 8,
  maxNavItems: 40,
  maxIdLength: 64,
} as const

// ---------------------------------------------------------------------------
// What the catalogue offers, as types. The arrays are the catalogue's (catalog.json,
// beside this file; a test checks they agree); the checks below read catalog.json.
// ---------------------------------------------------------------------------

export const ICONS = ['home', 'library', 'movie', 'show', 'tv', 'live', 'guide', 'record', 'music', 'album', 'artist', 'mic', 'radio', 'podcast', 'book', 'audiobook', 'comic', 'photo', 'video', 'disc', 'game', 'collection', 'list', 'folder', 'search', 'settings', 'user', 'users', 'kids', 'star', 'heart', 'clock', 'history', 'calendar', 'sparkles', 'fire', 'shuffle', 'play', 'download', 'share', 'globe', 'info', 'warning', 'check', 'plus', 'grid', 'filter', 'sort', 'plug', 'chart', 'devices', 'more'] as const
export const CARD_STYLES = ['poster', 'landscape', 'progress', 'episode', 'square', 'album', 'circle', 'person', 'book', 'game', 'photo', 'channel', 'tile', 'plate', 'block', 'logo', 'chip'] as const
/** The catalogue's components a page may use (the authored ones). */
export const COMPONENTS = ['Hero', 'Shelf', 'Grid', 'Tabs', 'Tab', 'Carousel', 'CrossBar', 'WidgetGrid', 'Widget', 'NumberedRow', 'FilterBar', 'Dock', 'KeyLegend', 'DetailHeader', 'SeasonList', 'TrackList', 'Credits', 'Banner', 'Text', 'Notice', 'Divider', 'Spacer', 'Stack', 'Split', 'Button', 'Image', 'SearchBox', 'List', 'ListItem', 'Form', 'QR', 'NativeView'] as const
export const SOURCES = ['continueWatching', 'nextUp', 'recommended', 'watchLater', 'liked', 'statistics', 'serverStatus', 'savedView', 'recentlyAdded', 'recentlyReleased', 'topRated', 'random', 'browse', 'genre', 'studio', 'tag', 'collection', 'collections', 'featured', 'libraries', 'genres', 'liveNow', 'recordings', 'books', 'formats', 'albums', 'artists', 'continuePlaying', 'credits', 'filmography', 'episodes', 'tracks', 'similar', 'versions', 'listsFor', 'newList', 'devices', 'year', 'activity', 'notices', 'creators', 'comments', 'markers', 'canvas', 'smartRule', 'libraryAdmin', 'libraryScan', 'newLibrary', 'matchQueue', 'matchCandidates', 'formField', 'search'] as const
export const PAGE_KINDS = ['home', 'libraries', 'library', 'detail', 'search', 'livetv', 'music', 'photos', 'books', 'games', 'collections', 'custom'] as const
export const FORM_FACTORS = ['tv', 'phone', 'tablet', 'desktop', 'web', 'headset'] as const
export const PLATFORMS = ['web', 'tvos', 'ios', 'android', 'androidtv', 'desktop', 'visionos', 'quest'] as const
export const PROFILE_KINDS = ['adult', 'kids', 'guest'] as const
export const LIBRARY_KINDS = ['movies', 'discs', 'shows', 'anime', 'videos', 'shorts', 'channels', 'musicvideos', 'commercials', 'music', 'audiobooks', 'podcasts', 'radio', 'books', 'photos', 'games'] as const
export const MEDIA_KINDS = ['movie', 'show', 'episode', 'video', 'disc', 'album', 'artist', 'track', 'book', 'audiobook', 'podcast', 'game', 'photo', 'collection', 'person'] as const
export const PLACEMENTS = ['primary', 'more', 'end', 'hidden'] as const
export const REPEATS = ['libraries', 'pinnedViews', 'collections', 'bookSeries', 'bookAuthors', 'personParts'] as const
/** The catalogue's commands: what a `command` action's `op` may be. */
export const COMMANDS = ['watchLater.add', 'watchLater.remove', 'watched.set', 'watched.clear', 'selectTab', 'control.open', 'wittyplay.room.create', 'wittyplay.room.join', 'wittyplay.room.invite', 'wittyplay.state.save', 'wittyplay.state.load', 'wittyplay.state.delete', 'wittyplay.controller.assign', 'wittyplay.room.leave', 'wittyplay.room.close', 'wittyplay.online.set', 'wittyplay.online.share', 'wittyplay.online.appear', 'wittyplay.kids.friends', 'wittyplay.screenshot.keep', 'wittyplay.memory.delete', 'collection.createSmart', 'creator.subscribe', 'comment.add', 'comment.delete', 'library.scan', 'library.rescan', 'library.forgetMetadata', 'libraries.forgetMetadata', 'library.create', 'meta.match', 'meta.unmatch', 'collection.add', 'collection.remove', 'collection.create', 'session.end', 'sessions.endOthers', 'history.clear', 'rewind.open', 'controller.remap', 'refresh', 'setup.skip'] as const
export const PERSONAL_KINDS = ['reorder', 'hide', 'pin', 'density', 'cardSize', 'defaultTab'] as const
/** The views every app may know for a NativeView; a module adds its own. */
export const NATIVE_VIEWS = ['guide', 'photoTimeline', 'photoMap', 'coverFlow'] as const
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export const CAN_FEATURES = ['games', 'recordings', 'downloads', 'sharing', 'comments', 'syncplay', 'remoteControl', 'remote', 'editProfile', 'editLayout', 'liveTv'] as const
export const FLAGS = ['setupIncomplete', 'scanning', 'librariesEmpty', 'hasQuery', 'screenTimeUp'] as const

// The server's, not in the catalogue.

/** The kinds of page a module may add; it adds to Home with an insert. */
export const MODULE_PAGE_KINDS = ['custom', 'library', 'detail', 'livetv', 'music', 'photos', 'books', 'games'] as const
/** The kinds of item a data source may give. */
export const ITEM_KINDS = ['movie', 'episode', 'show', 'season', 'video', 'disc', 'album', 'artist', 'track', 'book', 'audiobook', 'podcast', 'game', 'photo', 'channel', 'recording', 'collection', 'library', 'genre', 'view', 'person'] as const
export const SETTING_KINDS = ['bool', 'enum', 'int', 'string', 'secret', 'info'] as const
export const SETTING_SCOPES = ['server', 'profile'] as const
/** The property types a module's component or source may describe. */
export const PROP_TYPES = ['string', 'text', 'markdown', 'int', 'bool', 'enum', 'enumList', 'icon', 'route', 'image', 'url', 'section', 'library', 'ref', 'scope'] as const
/** The app's own screens a navigation entry may open (Settings is the server's). */
export const NAV_SCREENS = ['settings', 'guide', 'profiles', 'downloads', 'remote', 'nowPlaying', 'pair', 'collections'] as const
/** The colour tokens a theme scope may set: the colours of the server's built-in themes (themes/<id>/theme.json). */
export const COLOR_TOKENS = ['accent', 'accentFg', 'accentHover', 'accentLine', 'accentSoft', 'accentText', 'bg', 'bg2', 'bg3', 'bg4', 'border', 'borderStrong', 'brandAccent', 'controlLine', 'danger', 'dangerSoft', 'fg', 'fg2', 'fg3', 'focus', 'hover', 'ok', 'okSoft', 'onImage', 'overlay', 'pressed', 'scrim', 'warn', 'warnSoft'] as const
export type ColorToken = (typeof COLOR_TOKENS)[number]
export const MAP_PROPS =['title', 'subtitle', 'synopsis'] as const
export const MAP_FIELDS = ['title', 'subtitle', 'overview', 'tagline', 'year', 'studio', 'contentRating', 'artist', 'showTitle', 'count', 'number', 'runtime', 'genres'] as const

/**
 * The built-in pages and their top-level sections: where an insert may go. Copied from
 * the server's stock pages (pkg/sdui/stock.go) for catalogue revision 2.
 */
export const STOCK_PAGES: Readonly<Record<string, { kind: PageKind; sections: readonly string[] }>> = {
  home: { kind: 'home', sections: ['setup', 'welcome', 'hero', 'libraries', 'jump', 'onnow', 'foryou', 'nextup', 'view', 'recent', 'shuffle'] },
  libraries: { kind: 'libraries', sections: ['all'] },
  library: { kind: 'library', sections: ['all'] },
  'library-movies': { kind: 'library', sections: ['filters', 'all'] },
  'library-shows': { kind: 'library', sections: ['filters', 'all'] },
  'library-anime': { kind: 'library', sections: ['filters', 'all'] },
  'library-music': { kind: 'library', sections: ['played', 'views'] },
  'library-audiobooks': { kind: 'library', sections: ['listening', 'all'] },
  'library-podcasts': { kind: 'library', sections: ['listening', 'all'] },
  'library-photos': { kind: 'library', sections: ['timeline'] },
  'library-books': { kind: 'library', sections: ['reading', 'all'] },
  'library-games': { kind: 'library', sections: ['playing', 'all'] },
  detail: { kind: 'detail', sections: ['header', 'similar'] },
  'detail-show': { kind: 'detail', sections: ['header', 'episodes', 'similar'] },
  'detail-episode': { kind: 'detail', sections: ['header', 'season'] },
  'detail-album': { kind: 'detail', sections: ['header', 'tracks', 'more'] },
  'detail-collection': { kind: 'detail', sections: ['header', 'all'] },
  search: { kind: 'search', sections: ['q', 'idle', 'found', 'channels'] },
  livetv: { kind: 'livetv', sections: ['guide'] },
  music: { kind: 'music', sections: ['listening', 'played', 'added', 'artists'] },
  photos: { kind: 'photos', sections: ['recent'] },
  books: { kind: 'books', sections: ['reading', 'recent'] },
  games: { kind: 'games', sections: ['playing', 'recent'] },
  collections: { kind: 'collections', sections: ['later', 'all'] },
}

export type Icon = (typeof ICONS)[number]
export type CardStyle = (typeof CARD_STYLES)[number]
export type CatalogComponent = (typeof COMPONENTS)[number]
export type CatalogSource = (typeof SOURCES)[number]
export type PageKind = (typeof PAGE_KINDS)[number]
export type ModulePageKind = (typeof MODULE_PAGE_KINDS)[number]
export type FormFactor = (typeof FORM_FACTORS)[number]
export type Platform = (typeof PLATFORMS)[number]
export type ProfileKind = (typeof PROFILE_KINDS)[number]
export type LibraryKind = (typeof LIBRARY_KINDS)[number]
export type MediaKind = (typeof MEDIA_KINDS)[number]
export type ItemKind = (typeof ITEM_KINDS)[number]
export type Placement = (typeof PLACEMENTS)[number]
export type RepeatOver = (typeof REPEATS)[number]
export type CatalogCommandOp = (typeof COMMANDS)[number]
export type PersonalKind = (typeof PERSONAL_KINDS)[number]
export type Weekday = (typeof WEEKDAYS)[number]
export type CanFeature = (typeof CAN_FEATURES)[number]
export type Flag = (typeof FLAGS)[number]
export type SettingKind = (typeof SETTING_KINDS)[number]
export type SettingScope = (typeof SETTING_SCOPES)[number]
export type PropType = (typeof PROP_TYPES)[number]
export type NavScreen = (typeof NAV_SCREENS)[number]
export type StockPageID = keyof typeof STOCK_PAGES

/** A name of a module's own: `<module>.<name>`, such as wittyplay.recent or wittyplay.ConsoleShelf. */
export type ModuleName = `${string}.${string}`

// ---------------------------------------------------------------------------
// The file's types (the server's model.go, catalog.go and module.go).
// ---------------------------------------------------------------------------

/** One choice of a property or setting. */
export interface EnumOption {
  value: string
  label: string
}

/** When a section, variant or navigation entry is shown. Every field that is set must hold. */
export interface Condition {
  all?: Condition[]
  any?: Condition[]
  not?: Condition
  formFactor?: FormFactor[]
  platform?: Platform[]
  profileKind?: ProfileKind[]
  admin?: boolean
  feature?: string
  module?: string
  can?: CanFeature
  hasLibrary?: LibraryKind
  /** The page's own library is of this kind (library and detail pages). */
  libraryKind?: LibraryKind
  capability?: string
  flag?: Flag
  minWidth?: number
  maxWidth?: number
  /** HH:MM, 24-hour, from inclusive. */
  timeFrom?: string
  /** HH:MM, 24-hour, to exclusive. */
  timeTo?: string
  weekday?: Weekday[]
  locale?: string
}

/** Narrows a library or detail page. A module never names a library by ID. */
export interface Match {
  library?: number
  libraryKind?: LibraryKind
  mediaKind?: MediaKind
}

/** Makes one copy of a section per library, pinned view or collection; $each stands for it. */
export interface Repeat {
  over: RepeatOver
  kinds?: LibraryKind[]
  limit?: number
}

/**
 * A data source and its parameters, written flat: { type: 'recentlyAdded', limit: 20 }.
 * A string beginning with $ stands for what the page was opened with ($library, $item, ...).
 */
export interface Source {
  type: CatalogSource | ModuleName
  [param: string]: unknown
}

/** One component on a page. */
export interface Section {
  /** Unique on the page: lower-case letters, digits, - and _, starting with a letter. */
  id: string
  /** A catalogue component, or one of this module's own (`<module>.<Name>`). */
  component: CatalogComponent | ModuleName
  props?: Record<string, unknown>
  source?: Source
  when?: Condition
  repeat?: Repeat
  scope?: string
  locked?: boolean
  /** The sections inside a container (Stack, Split, Tabs, Tab, List, NativeView). */
  children?: Section[]
}

export interface Variant {
  id: string
  label?: string
  when: Condition
  sections: Section[]
}

export interface PersonalPolicy {
  allow: PersonalKind[]
}

/** A whole page a module adds. */
export interface Page {
  /** `<module>` or `<module>-something`. */
  id: string
  kind: ModulePageKind
  title: string
  icon?: Icon
  description?: string
  /** Required on a library or detail page: libraryKind or mediaKind. */
  match?: Match
  scope?: string
  sections: Section[]
  variants?: Variant[]
  personal?: PersonalPolicy
  ttlSeconds?: number
  /** What the page puts into the shell's own regions while it is shown (revision 8). */
  regions?: PageRegions
}

/** A page's contribution to the shell: the status bar's extra items and the system dock (revision 8). */
export interface PageRegions {
  statusBar?: StatusItem[]
  systemDock?: DockEntry[]
}

export const STATUS_KINDS = ['profile', 'server', 'text'] as const
export type StatusKind = (typeof STATUS_KINDS)[number]

/** One thing in the status bar: the profile (with `text` as the line under the name), the server's name, or text alone. */
export interface StatusItem {
  id: string
  kind: StatusKind
  text?: string
}

/** One destination of the system dock: a round button; `as: 'layer'` shows its page over the screen. */
export interface DockEntry {
  id: string
  label: string
  icon: Icon
  route: string
  as?: 'layer'
}

/** One entry of the main menu. A module's entries open its pages or a route. */
export interface NavItem {
  /** `<module>` or `<module>-something`. */
  id: string
  label?: string
  icon?: Icon
  type: 'page' | 'native' | 'route'
  page?: string
  screen?: NavScreen
  route?: string
  when?: Condition
  /** Where the entry sits on each form factor; one left out is primary. */
  placement?: Partial<Record<FormFactor, Placement>>
}

/** One property of a module's component, or parameter of its source. */
export interface PropSpec {
  /** camelCase; not "type" or "map". */
  name: string
  type: PropType
  label: string
  help?: string
  default?: unknown
  required?: boolean
  options?: EnumOption[]
  min?: number
  max?: number
  maxLength?: number
  formFactors?: FormFactor[]
  /** The catalogue revision it appeared in. */
  since: number
}

/** A data source the module answers through its helper. */
export interface ModuleSource {
  /** `<module>.<camelName>`. */
  type: ModuleName
  label: string
  description: string
  icon: Icon
  category?: string
  params?: PropSpec[]
  /** The kinds of item it gives. */
  yields: ItemKind[]
  /** The card style "auto" means for it. */
  cardStyle: CardStyle
  pageKinds?: PageKind[]
  paged: boolean
  /** The route "See all" opens, with {param} placeholders. */
  seeAll?: string
  title?: string
  since: number
  example?: unknown
  module?: string
  /** Offer it for tvOS Top Shelf, as a row of its own: only with no required params and no pageKinds. */
  topShelf?: boolean
}

/** A named section with properties of its own; `{{name}}` in its section is a property's value. */
export interface ModuleComponent {
  /** `<module>.<PascalName>`. */
  type: ModuleName
  label: string
  description?: string
  icon?: Icon
  props?: PropSpec[]
  /** The kinds of page it may be used on; empty: any. */
  pageKinds?: PageKind[]
  /** A section of a catalogue component: never another of the module's. */
  section: Section
}

/** A view of the module's own that an app may draw in a NativeView. */
export interface ModuleView {
  /** `<module>.<camelName>`. */
  id: ModuleName
  label: string
  description?: string
  platforms?: Platform[]
}

/** One of the module's sections put into a built-in page. */
export interface ModuleInsert {
  page: StockPageID
  /** A top-level section of that page; neither: at the end. Not both. */
  after?: string
  before?: string
  /** Its id is `<module>-something`. */
  section: Section
}

/** A section offered in the page editor's gallery. */
export interface ModulePreset {
  /** `<module>-something`. */
  id: string
  label: string
  description?: string
  section: Section
}

/** The module's theme scope: its ID, and the colours it would like. */
export interface ModuleTheme {
  /** The module's ID. */
  scope: string
  label?: string
  /** Colour token → #rrggbb, #rrggbbaa or rgb()/rgba(). */
  tokens?: Partial<Record<ColorToken, string>>
}

interface SettingRowBase {
  label: string
  help?: string
  /** server (the default) or profile. */
  scope?: SettingScope
  unit?: string
  maxLength?: number
}

/** One setting, as every app's own Settings draws it. */
export type SettingRow =
  | (SettingRowBase & { kind: 'bool'; key: string; default?: boolean })
  | (SettingRowBase & { kind: 'enum'; key: string; options: EnumOption[]; default?: string })
  | (SettingRowBase & { kind: 'int'; key: string; min?: number; max?: number; default?: number })
  | (SettingRowBase & { kind: 'string'; key: string; default?: string })
  | (SettingRowBase & { kind: 'secret'; key: string; scope?: 'server' })
  | (SettingRowBase & { kind: 'info'; key?: undefined })

export interface SettingsGroup {
  title?: string
  footer?: string
  rows: SettingRow[]
}

export interface SettingsPage {
  /** `<module>` or `<module>-something`. */
  id: string
  title: string
  icon?: Icon
  /** Shown only to administrators; then it holds no profile settings. */
  admin?: boolean
  /** A place of the hand-built Settings it also appears in: `you.games`, or `people.profile` (administrators only, so `admin` must be true). */
  slot?: SettingsSlot
  groups: SettingsGroup[]
}

export const SETTINGS_SLOTS = ['you.games', 'people.profile'] as const
export type SettingsSlot = (typeof SETTINGS_SLOTS)[number]

/** A module's SDUI file, sdui.json. */
export interface ModuleUI {
  /** The JSON Schema an editor checks the file with; the server ignores it. */
  $schema?: string
  format: typeof FORMAT
  formatVersion: typeof FORMAT_VERSION
  /** The module's ID, the same as module.json's. */
  module: string
  /** The catalogue revision it was written against. */
  catalog: number
  theme: ModuleTheme
  pages?: Page[]
  inserts?: ModuleInsert[]
  presets?: ModulePreset[]
  components?: ModuleComponent[]
  sources?: ModuleSource[]
  views?: ModuleView[]
  navigation?: NavItem[]
  settings?: SettingsPage[]
}

/** One thing wrong, like the server's: where, what, and how to put it right. */
export interface Issue {
  /** A JSON pointer into the file: /pages/0/sections/2/props/cardStyle. */
  path: string
  /** "error": the server refuses the module; "warning": it doesn't, but it is probably a mistake. */
  severity: 'error' | 'warning'
  message: string
  fix?: string
}

// ---------------------------------------------------------------------------
// Helpers for writing one.
// ---------------------------------------------------------------------------

/** Returns ui as it is: it is there so an editor checks the object against ModuleUI. */
export function defineModuleUI<const T extends ModuleUI>(ui: T): T {
  return ui
}

/** The parts of a module's file every module has, filled in: format, version, catalogue, theme. */
export function moduleUI(module: string, rest: Omit<ModuleUI, 'format' | 'formatVersion' | 'module' | 'catalog' | 'theme'> & { theme?: Omit<ModuleTheme, 'scope'> }): ModuleUI {
  const { theme, ...more } = rest
  return { format: FORMAT, formatVersion: FORMAT_VERSION, module, catalog: CATALOG_REVISION, theme: { scope: module, ...(theme || {}) }, ...more }
}

type SeeAll = 'auto' | 'always' | 'never'
type Empty = 'hide' | 'message'
type CardSize = 's' | 'm' | 'l'

type HeadingStyle = 'plain' | 'band' | 'underline'

export interface ShelfProps {
  title?: string
  subtitle?: string
  headingStyle?: HeadingStyle
  cardStyle?: 'auto' | CardStyle
  cardSize?: CardSize
  showTitles?: boolean
  seeAll?: SeeAll
  /** Draw the last card as See all (auto: when there is more to see). */
  seeAllCard?: SeeAll
  numbered?: boolean
  /** Let the next card show at the edge, so a row is known to scroll. */
  peek?: boolean
  /** The focused card grows (revision 8). */
  focusGrow?: boolean
  /** Show the focused item's detail panel, with its `actions` (revision 8). */
  detail?: boolean
  /** The row takes focus as a whole (revision 8). */
  focusable?: boolean
  maxItems?: number
  empty?: Empty
  emptyText?: string
  /** A line under the message of an empty section saying what to do (revision 8). */
  emptyHint?: string
  /** A button an empty section offers (revision 8). */
  emptyAction?: EmptyAction
}

/** The button of an empty section: a label and exactly one place to go (`to` a route, `native` a screen) or command to run (`op`, with `item`, `params`, `confirm`); `as: 'layer'` shows the page over the screen; `when` shows it only to those the condition holds for (for example `{admin: true}`). */
export interface EmptyAction {
  label: string
  to?: string
  native?: NavScreen
  op?: CatalogCommandOp | string
  item?: string
  params?: Record<string, unknown>
  confirm?: string
  as?: 'layer'
  when?: Condition
}

/** A row that scrolls one card at a time, with no See all (catalogue revision 6). */
export interface CarouselProps {
  title?: string
  headingStyle?: HeadingStyle
  cardStyle?: 'auto' | CardStyle
  cardSize?: CardSize
  showTitles?: boolean
  maxItems?: number
  empty?: Empty
  emptyText?: string
}

/** A ranked row: big numbers beside the cards (revision 6). `index` counts 1, 2, 3 in order; `auto` takes the source's own rank. */
export interface NumberedRowProps {
  title?: string
  headingStyle?: HeadingStyle
  numbers?: 'auto' | 'index'
  maxItems?: number
  empty?: Empty
  emptyText?: string
}

/** A CrossBar's children are Tab sections, one per category; `default` is the ID of the one it opens on (revision 6). */
export interface CrossBarProps {
  default?: string
}

export interface WidgetGridProps {
  /** Columns the grid is laid out in, 1 to 12. */
  columns?: number
}

/** One tile of a WidgetGrid (revision 6). x and y place it (columns and rows counted from 0); w and h size it. */
export interface WidgetProps {
  kind?: 'continue' | 'liveNow' | 'stats' | 'serverStatus' | 'clock' | 'recordings'
  title?: string
  x?: number
  y?: number
  w?: number
  h?: number
}

/** A list of rows, each a `ListItem` or filled from a source (revision 8: `focusable`). */
export interface ListProps {
  title?: string
  headingStyle?: HeadingStyle
  dense?: boolean
  focusable?: boolean
  empty?: Empty
  emptyText?: string
  emptyHint?: string
  emptyAction?: EmptyAction
}

/** A group of list rows with controls, submitted together as one command (revision 8). `op` is the command, `item` its item; each control's `name` is the key its value goes under in the command's params. */
export interface FormProps {
  title?: string
  submitLabel?: string
  cancelLabel?: string
  op?: CatalogCommandOp | string
  item?: string
}

/** What a Button, Notice or ListItem does besides opening a place: a command with its item and params (a bool, int or ints param as a JSON value), a question asked first, going back. */
export interface ActionProps {
  op?: CatalogCommandOp | string
  item?: string
  params?: Record<string, unknown>
  confirm?: string
  back?: boolean
}

/** A QR code of `value` (a route or an https address; the join link of a room), with a `label` under it (revision 8). Draws from the section's `source` (an item's `link`) when `value` is left out. */
export interface QRProps {
  value?: string
  label?: string
  size?: CardSize
}

/** A page-level filter bar: `target` is optional (revision 8), and `fields` may also be `reading`, `format`, `minRating`. */
export interface FilterBarProps {
  target?: string
  fields?: string[]
  sorts?: string[]
  showCount?: boolean
}

export interface CreditsProps {
  title?: string
  parts?: Array<'cast' | 'guests' | 'crew'>
  castLimit?: number
  crewLimit?: number
  departments?: Array<'directing' | 'writing' | 'production' | 'camera' | 'lighting' | 'editing' | 'sound' | 'art' | 'costume' | 'effects' | 'crew'>
  cardSize?: CardSize
}

/**
 * What a source answers for a person (`yields: ['person']`, cardStyle `person`): a friend, a
 * player in a room, someone in a cast. The card shows the photo (initials when there is none),
 * `title`, `subtitle` (a role, or where they are) and `badges` (presence, a seat). It opens
 * something only when `route` is set; without one it is not a button.
 */
export interface PersonItem {
  id: string
  kind: 'person'
  title: string
  subtitle?: string
  /** Presence as badge text: Playing and Online draw a green dot on the avatar, Away amber, Offline muted (the person card style's `badgeTones`). */
  badges?: string[]
  images?: { square?: string; poster?: string }
  icon?: Icon
  route?: string
  scope?: string
  /** What activating the row does instead of opening `route`; `trailing` is the text at its end; `control` a switch, choice, field or slider in the row (revision 8). */
  action?: ItemActionTarget
  trailing?: string
  control?: Control
  /** The buttons of a Shelf's detail panel while the item has focus. */
  actions?: ItemAction[]
  /** What a QR section draws for the item: a route or an https address only. */
  link?: string
}

/** A value a catalogue command takes besides the action's item. `bool` and `int`/`ints` params are written as JSON numbers and booleans, not strings. */
export interface CommandParam {
  name: string
  type: 'string' | 'int' | 'bool' | 'ints' | 'object'
  label: string
  required?: boolean
}

/** A catalogue command as `GET /api/sdui/catalog` lists it. `module` is the module a command belongs to: a module's own action may use only its own commands (`module` is its ID, or the `op` starts with `<module>.`). */
export interface CommandSpec {
  op: CatalogCommandOp | string
  label: string
  description: string
  method: string
  path: string
  body?: string
  params?: CommandParam[]
  module?: string
}

/** An action an item or a Button carries (revision 8: `as`, `confirm`). */
export interface ItemActionTarget {
  type: 'navigate' | 'play' | 'native' | 'external' | 'back' | 'command'
  to?: string
  item?: string
  url?: string
  op?: CatalogCommandOp | string
  params?: Record<string, unknown>
  /** `layer`: a navigate action's page is shown over the screen (a sheet) instead of replacing it. */
  as?: 'layer'
  /** A question asked before a command is carried out, with the command's label as the confirming button. */
  confirm?: string
}

export const GLYPHS = ['a', 'b', 'x', 'y'] as const
export type Glyph = (typeof GLYPHS)[number]

/** One button of an item's detail panel (a Shelf with `detail`), first the A action. */
export interface ItemAction {
  id: string
  label: string
  /** The key it is drawn with: A selects, B goes back, X and Y are the secondary and options keys. */
  glyph?: Glyph
  action: ItemActionTarget
}

export const CONTROL_TYPES = ['switch', 'select', 'field', 'slider'] as const
export type ControlType = (typeof CONTROL_TYPES)[number]

/** A control drawn in a list row, so a page can hold settings-like rows (Settings itself stays hand-built). A switch's `value` is a boolean and flipping it runs the row's action; a select's and a field's a string; a slider's a number. `name` is the key its value goes under inside a Form. */
export interface Control {
  type: ControlType
  name?: string
  value?: boolean | string | number
  options?: EnumOption[]
  min?: number
  max?: number
  step?: number
  unit?: string
  placeholder?: string
  maxLength?: number
  multiline?: boolean
  input?: 'text' | 'number' | 'url' | 'search'
  disabled?: boolean
  why?: string
}

/**
 * A `command` action: `op` is one of COMMANDS, `item` fills {item} in the command's request,
 * and `params` give its {name} values (a number for an `int` param). See docs/SDUI.md, Command.
 */
export interface CommandAction {
  type: 'command'
  op: CatalogCommandOp
  item?: string
  params?: Record<string, string | number>
}

export interface GridProps {
  title?: string
  focusable?: boolean
  cardStyle?: 'auto' | CardStyle
  cardSize?: CardSize
  showTitles?: boolean
  maxItems?: number
  empty?: Empty
  emptyText?: string
  emptyHint?: string
  emptyAction?: EmptyAction
}

export interface HeroProps {
  title?: string
  style?: 'billboard' | 'banner'
  autoAdvanceSec?: number
  showSynopsis?: boolean
  showLogo?: boolean
  actions?: Array<'play' | 'details' | 'watchLater'>
  maxItems?: number
}

export interface TextProps {
  format?: 'plain' | 'markdown'
  role?: 'pageTitle' | 'heading' | 'title' | 'body' | 'caption'
  align?: 'start' | 'center' | 'end'
  maxLines?: number
}

export interface NoticeProps {
  tone?: 'info' | 'success' | 'warning' | 'danger'
  title?: string
  icon?: Icon
  buttonLabel?: string
  to?: string
  native?: NavScreen
  url?: string
}

export interface NativeViewProps {
  library?: number | string
}

/** What any section may also carry. */
export interface SectionExtras {
  when?: Condition
  repeat?: Repeat
  scope?: string
  locked?: boolean
}

function made(id: string, component: Section['component'], props: object | undefined, source: Source | undefined, extras: SectionExtras | undefined, children?: Section[]): Section {
  const s: Section = { id, component }
  if (props && Object.keys(props).length > 0) s.props = { ...props }
  if (source) s.source = source
  if (extras) Object.assign(s, extras)
  if (children && children.length > 0) s.children = children
  return s
}

/** Any section: a catalogue component, or one of the module's own with its props. */
export function section(id: string, component: Section['component'], parts: { props?: Record<string, unknown>; source?: Source; children?: Section[] } & SectionExtras = {}): Section {
  const { props, source, children, ...extras } = parts
  return made(id, component, props, source, extras, children)
}

/** A row of cards from a source. */
export function shelf(id: string, source: Source, props?: ShelfProps, extras?: SectionExtras): Section {
  return made(id, 'Shelf', props, source, extras)
}

/** A grid of cards from a source that loads more as it is scrolled: the last section of its list. */
export function grid(id: string, source: Source, props?: GridProps, extras?: SectionExtras): Section {
  return made(id, 'Grid', props, source, extras)
}

/** A large rotating spotlight of a few titles from a source. */
export function hero(id: string, source: Source, props?: HeroProps, extras?: SectionExtras): Section {
  return made(id, 'Hero', props, source, extras)
}

/** A row that scrolls a card at a time. */
export function carousel(id: string, source: Source, props?: CarouselProps, extras?: SectionExtras): Section {
  return made(id, 'Carousel', props, source, extras)
}

/** A ranked row with big numbers. */
export function numberedRow(id: string, source: Source, props?: NumberedRowProps, extras?: SectionExtras): Section {
  return made(id, 'NumberedRow', props, source, extras)
}

/** A QR code. */
export function qr(id: string, props?: QRProps, extras?: SectionExtras & { source?: Source }): Section {
  const { source, ...rest } = extras ?? {}
  return made(id, 'QR', props, source, rest)
}

/** A form: list rows with controls and a submit button. Children are List, Text, Notice, Divider or Spacer sections. */
export function form(id: string, children: Section[], props?: FormProps, extras?: SectionExtras): Section {
  return made(id, 'Form', props, undefined, extras, children)
}

/** A title's cast and crew, from a `credits` source. */
export function credits(id: string, source: Source, props?: CreditsProps, extras?: SectionExtras): Section {
  return made(id, 'Credits', props, source, extras)
}

/** A grid of widgets: put `widget`s in it. */
export function widgetGrid(id: string, widgets: Section[], props?: WidgetGridProps, extras?: SectionExtras): Section {
  return made(id, 'WidgetGrid', props, undefined, extras, widgets)
}

/** One tile of a widget grid. */
export function widget(id: string, props?: WidgetProps, extras?: SectionExtras): Section {
  return made(id, 'Widget', props, undefined, extras)
}

/** A cross bar: `Tab` sections, one per category, in a row of tabs with the tab's rows under it. */
export function crossBar(id: string, tabs: Section[], props?: CrossBarProps, extras?: SectionExtras): Section {
  return made(id, 'CrossBar', props, undefined, extras, tabs)
}

/** A line or paragraph of text. */
export function text(id: string, value: string, props?: TextProps, extras?: SectionExtras): Section {
  return made(id, 'Text', { text: value, ...props }, undefined, extras)
}

/** A box with a message, and maybe a button (buttonLabel with one of to, native or url). */
export function notice(id: string, value: string, props?: NoticeProps, extras?: SectionExtras): Section {
  return made(id, 'Notice', { text: value, ...props }, undefined, extras)
}

/**
 * A view an app draws itself (one of the catalogue's, or one of the module's own views).
 * fallback are the sections every app that can't draw it shows instead. It fills the rest
 * of the page, so it is the last section of its list.
 */
export function nativeView(id: string, view: string, fallback: Section[] = [], props?: NativeViewProps, extras?: SectionExtras): Section {
  return made(id, 'NativeView', { view, ...props }, undefined, extras, fallback)
}

// ---------------------------------------------------------------------------
// The check.
// ---------------------------------------------------------------------------

interface CatPropSpec {
  name: string
  type: string
  label: string
  default?: unknown
  required?: boolean
  options?: EnumOption[]
  min?: number
  max?: number
  maxLength?: number
}
interface CatComponent {
  type: string
  label: string
  authored: boolean
  data: string
  accepts?: string[]
  container: boolean
  props?: CatPropSpec[]
  pageKinds?: string[]
}
interface CatSource {
  type: string
  params?: CatPropSpec[]
  yields: string[]
  cardStyle: string
  pageKinds?: string[]
}
interface Catalogue {
  revision: number
  components: CatComponent[]
  cardStyles: Array<{ style: string; kinds?: string[] }>
  sources: CatSource[]
  conditions: Array<{ field: string; options?: EnumOption[] }>
  pageKinds: Array<{ kind: string; variables?: string[]; match?: string[] }>
  nativeViews: EnumOption[]
  icons: string[]
  repeats: EnumOption[]
  formFactors: string[]
  platforms: string[]
  profileKinds: string[]
  libraryKinds: string[]
  mediaKinds: string[]
  personalKinds: EnumOption[]
  placements: EnumOption[]
}

const catalog = catalogJSON as unknown as Catalogue

/** The catalogue revision this kit was made with: what `catalog` should say. */
export const CATALOG_REVISION: number = catalog.revision

const vals = (o: EnumOption[] | undefined) => (o || []).map((x) => x.value)
const condOptions = (field: string) => vals(catalog.conditions.find((c) => c.field === field)?.options)
const cat = {
  icons: catalog.icons,
  cardStyles: catalog.cardStyles.map((c) => c.style),
  pageKinds: catalog.pageKinds.map((k) => k.kind),
  formFactors: catalog.formFactors,
  platforms: catalog.platforms,
  profileKinds: catalog.profileKinds,
  libraryKinds: catalog.libraryKinds,
  mediaKinds: catalog.mediaKinds,
  placements: vals(catalog.placements),
  repeats: vals(catalog.repeats),
  personalKinds: vals(catalog.personalKinds),
  weekdays: condOptions('weekday'),
  can: condOptions('can'),
  flags: condOptions('flag'),
  authored: catalog.components.filter((c) => c.authored).map((c) => c.type),
  sourceNames: catalog.sources.map((s) => s.type),
}
const componentIndex = new Map(catalog.components.map((c) => [c.type, c]))
const sourceIndex = new Map(catalog.sources.map((s) => [s.type, s]))
const styleIndex = new Map(catalog.cardStyles.map((s) => [s.style, s]))
const pageKindIndex = new Map(catalog.pageKinds.map((k) => [k.kind, k]))

const moduleIDPattern = /^[a-z][a-z0-9]{1,63}$/
const sourceNamePattern = /^[a-z][A-Za-z0-9]{0,47}$/
const compNamePattern = /^[A-Z][A-Za-z0-9]{0,47}$/
const settingKeyPattern = /^[a-z][A-Za-z0-9_.-]{0,63}$/
const placeholderRe = /\{\{([A-Za-z][A-Za-z0-9_]{0,47})\}\}/g
const idPattern = /^[a-z][a-z0-9_-]{0,63}$/
const scopePattern = idPattern
const clockPattern = /^([01][0-9]|2[0-3]):[0-5][0-9]$/
const wordPattern = /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/
const localeTag = /^[A-Za-z]{2,8}([-_][A-Za-z0-9]{1,8}){0,3}$/
const mdLink = /\]\(([^)\s]*)[^)]*\)/g

/** Whether s can be a module's ID. */
export function validModuleID(s: string): boolean {
  return moduleIDPattern.test(s)
}

/** The module a namespaced name belongs to ("wittyplay" for wittyplay.recent), "" for a catalogue name. */
export function moduleOf(name: string): string {
  const i = typeof name === 'string' ? name.indexOf('.') : -1
  if (i < 0) return ''
  const mod = name.slice(0, i)
  return validModuleID(mod) ? mod : ''
}

const ownedID = (mod: string, id: string) => id === mod || (typeof id === 'string' && id.startsWith(mod + '-'))
const contains = (list: readonly string[], s: unknown) => typeof s === 'string' && list.includes(s)
const runes = (s: unknown) => (typeof s === 'string' ? [...s].length : 0)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v)
const list = <T = any>(v: unknown): T[] => (Array.isArray(v) ? v : [])
const q = (s: unknown) => JSON.stringify(s ?? '')
const propStr = (p: unknown, k: string, def: string) => (isObj(p) && isStr(p[k]) && p[k] !== '' ? (p[k] as string) : def)
const toInt = (v: unknown): number | undefined => (typeof v === 'number' && Number.isInteger(v) ? v : undefined)

/** Whether s is a place in the app: a path beginning with exactly one slash. */
export function validRoute(s: unknown): boolean {
  if (!isStr(s) || s.length === 0 || s.length > 600 || s[0] !== '/' || s.startsWith('//') || /[\\\x00\r\n\t ]/.test(s)) return false
  // What Go's url.Parse refuses: control characters and broken % escapes.
  return !/[\x00-\x1f\x7f]/.test(s) && !/%(?![0-9A-Fa-f]{2})/.test(s)
}

/** Whether s is an http or https address. */
export function validURL(s: unknown): boolean {
  if (!isStr(s) || s.length > 2000 || /[\x00\r\n\t ]/.test(s)) return false
  try {
    const u = new URL(s)
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname !== ''
  } catch {
    return false
  }
}

function editDistance(a: string, b: string): number {
  if (a.length > 64 || b.length > 64) return 99
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  let cur = new Array<number>(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    ;[prev, cur] = [cur, prev]
  }
  return prev[b.length]
}

/** "Did you mean …?" for the nearest name in options, or "". */
function suggest(s: unknown, options: readonly string[]): string {
  const str = isStr(s) ? s : ''
  let best = ''
  let bestD = 4
  const ls = str.toLowerCase()
  for (const c of options) {
    const lc = c.toLowerCase()
    let d = editDistance(ls, lc)
    if (ls !== '' && lc.startsWith(ls)) d = Math.min(d, 1)
    if (d < bestD) {
      best = c
      bestD = d
    }
  }
  if (best === '' || bestD > Math.max(1, Math.floor(str.length / 2))) return ''
  return `Did you mean "${best}"?`
}
const orFix = (s: string, fallback: string) => s || fallback

// The module's own components, sources and views: what its pages may use.
interface Self {
  components: Map<string, any>
  sources: Map<string, any>
  views: Map<string, any>
}

function selfOf(ui: any): Self {
  const s: Self = { components: new Map(), sources: new Map(), views: new Map() }
  for (const c of list(ui.components)) if (moduleOf(c?.type) === ui.module && !s.components.has(c.type)) s.components.set(c.type, c)
  for (const c of list(ui.sources)) if (moduleOf(c?.type) === ui.module && !s.sources.has(c.type)) s.sources.set(c.type, c)
  for (const c of list(ui.views)) if (moduleOf(c?.id) === ui.module && !s.views.has(c.id)) s.views.set(c.id, c)
  return s
}

function moduleComponentSpec(mc: any): CatComponent {
  return { type: mc.type, label: mc.label, authored: true, data: 'none', container: false, props: list(mc.props), pageKinds: list(mc.pageKinds) }
}

// Filling a component's template, as the server does.
function fillValue(v: unknown, values: Record<string, unknown>): [unknown, boolean] {
  if (isStr(v)) {
    const whole = /^\{\{([A-Za-z][A-Za-z0-9_]{0,47})\}\}$/.exec(v)
    if (whole) {
      const val = values[whole[1]]
      return [val, val !== undefined && val !== null]
    }
    return [
      v.replace(placeholderRe, (_m, name: string) => {
        const val = values[name]
        if (isStr(val)) return val
        if (typeof val === 'number') return String(val)
        return ''
      }),
      true,
    ]
  }
  if (isObj(v)) return [fillMap(v, values), true]
  if (Array.isArray(v)) {
    const out: unknown[] = []
    for (const e of v) {
      const [fe, ok] = fillValue(e, values)
      if (ok) out.push(fe)
    }
    return [out, true]
  }
  return [v, true]
}

function fillMap(m: unknown, values: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!isObj(m)) return undefined
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(m)) {
    const [fv, keep] = fillValue(v, values)
    if (keep) out[k] = fv
  }
  return Object.keys(out).length ? out : undefined
}

function fillSection(t: any, values: Record<string, unknown>, prefix: string): any {
  const out: any = { ...t }
  out.props = fillMap(t.props, values)
  if (t.source) out.source = fillMap(t.source, values)
  delete out.children
  const kids = list(t.children).map((c) => ({ ...fillSection(c, values, prefix), id: (prefix + '-' + c.id).slice(0, PAGE_LIMITS.maxIdLength) }))
  if (kids.length) out.children = kids
  return out
}

function expandComponent(c: any, use: any): any {
  const values: Record<string, unknown> = {}
  for (const ps of list(c.props)) if (ps.default !== undefined && ps.default !== null) values[ps.name] = ps.default
  if (isObj(use.props)) Object.assign(values, use.props)
  const out = fillSection(isObj(c.section) ? c.section : {}, values, use.id)
  out.id = use.id
  if (use.when && out.when) out.when = { all: [use.when, out.when] }
  else if (use.when) out.when = use.when
  if (use.repeat) out.repeat = use.repeat
  if (use.scope) out.scope = use.scope
  else if (!out.scope) out.scope = moduleOf(c.type)
  out.locked = !!(out.locked || use.locked)
  return out
}

function placeholders(t: any): string[] {
  const seen = new Set<string>()
  const walk = (v: unknown) => {
    if (isStr(v)) for (const m of v.matchAll(placeholderRe)) seen.add(m[1])
    else if (Array.isArray(v)) v.forEach(walk)
    else if (isObj(v)) Object.values(v).forEach(walk)
  }
  const sec = (s: any) => {
    walk(s?.props)
    walk(s?.source)
    list(s?.children).forEach(sec)
  }
  sec(t)
  return [...seen].sort()
}

function exampleProps(specs: any[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const s of specs) {
    if (s.default !== undefined && s.default !== null) {
      out[s.name] = s.default
      continue
    }
    switch (s.type) {
      case 'int': out[s.name] = s.min ?? 1; break
      case 'bool': out[s.name] = false; break
      case 'enum': if (list(s.options).length) out[s.name] = s.options[0].value; break
      case 'enumList': if (list(s.options).length) out[s.name] = [s.options[0].value]; break
      case 'icon': out[s.name] = 'star'; break
      case 'route': out[s.name] = '/'; break
      case 'image': out[s.name] = '/api/example.png'; break
      case 'url': out[s.name] = 'https://example.org/'; break
      case 'library': case 'ref': out[s.name] = '1'; break
      case 'section': case 'scope': out[s.name] = 'example'; break
      default: out[s.name] = 'Example'
    }
  }
  return out
}

function isZeroCondition(c: any): boolean {
  if (!isObj(c)) return true
  return Object.values(c).every((v) => v === undefined || v === null || v === '' || v === 0 || (Array.isArray(v) && v.length === 0))
}

class Checker {
  issues: Issue[] = []
  count = 0
  page: { id?: string; kind: string }
  self: Self | null
  own: boolean

  constructor(page: { id?: string; kind: string }, self: Self | null = null, own = false) {
    this.page = page
    this.self = self
    this.own = own
  }

  err(path: string, fix: string, message: string) {
    this.issues.push(fix ? { path, severity: 'error', message, fix } : { path, severity: 'error', message })
  }

  warn(path: string, fix: string, message: string) {
    this.issues.push(fix ? { path, severity: 'warning', message, fix } : { path, severity: 'warning', message })
  }

  missingModule(path: string, fix: string, what: string, name: string, mod: string) {
    if (this.own) {
      this.err(path, "Use the catalogue's, or this module's own.", `${q(name)} is another module's ${what}: a module uses only its own, so it works wherever it is installed`)
      return
    }
    this.warn(path, fix, `${q(name)} is a ${what} of the ${mod} module, which isn't in use: the section is left out until it is`)
  }

  component(t: string): CatComponent | undefined {
    const mc = this.self?.components.get(t)
    if (mc) return moduleComponentSpec(mc)
    const spec = componentIndex.get(t)
    if (spec && t === 'NativeView' && this.self && this.self.views.size > 0) {
      const extra = [...this.self.views.values()].map((w) => ({ value: w.id, label: w.label }))
      return { ...spec, props: list<CatPropSpec>(spec.props).map((p) => (p.name === 'view' ? { ...p, options: [...list<EnumOption>(p.options), ...extra] } : p)) }
    }
    return spec
  }

  sourceSpec(t: string): CatSource | undefined {
    return this.self?.sources.get(t) || sourceIndex.get(t)
  }

  // A page, as the server's validatePage checks it.
  pageCheck(p: any) {
    if (!idPattern.test(p.id ?? '')) this.err('/id', 'Use a short name such as family-night.', `a page's ID is lower-case letters, digits, - and _, starting with a letter, at most ${PAGE_LIMITS.maxIdLength} long`)
    const kind = pageKindIndex.get(p.kind)
    if (!kind) {
      let fix = orFix(suggest(p.kind, cat.pageKinds), 'The kinds are ' + cat.pageKinds.join(', ') + '.')
      if (p.kind === 'settings' || p.kind === 'player') fix = 'Settings and the player are the app\'s own screens, not pages. Link to Settings with a Button or a navigation entry: "native": "settings".'
      this.err('/kind', fix, `${q(p.kind)} is not a kind of page`)
    }
    if (!isStr(p.title) || p.title.trim() === '') this.err('/title', 'Give the page a title; it is what the navigation and the window show.', 'a page needs a title')
    else if (runes(p.title) > 120) this.err('/title', 'Shorten it.', 'a title is at most 120 characters')
    if (p.icon && !contains(cat.icons, p.icon)) this.err('/icon', suggest(p.icon, cat.icons), `${q(p.icon)} is not one of the built-in icons`)
    if ((p.description ?? '').length > 500) this.err('/description', 'Shorten it.', 'a description is at most 500 characters')
    if (p.scope && !scopePattern.test(p.scope)) this.err('/scope', 'Use a module\'s ID such as wittymusic, or a name of your own in lower case.', `${q(p.scope)} is not a theme scope`)
    if ((p.ttlSeconds ?? 0) < 0 || (p.ttlSeconds ?? 0) > 86400) this.err('/ttlSeconds', 'Use 0 for the default.', 'ttlSeconds is between 0 and 86400')
    this.regions(p.regions)
    if (p.slot) {
      if (!contains(SETTINGS_SLOTS, p.slot)) this.err('/slot', 'Use you.games or people.profile.', `${q(p.slot)} is not a place settings pages can go`)
      if (p.kind !== 'custom') this.err('/slot', 'Use a custom page.', 'only a custom page can go into Settings')
    }
    const m = p.match
    if (isObj(m) && kind) {
      for (const field of ['library', 'libraryKind', 'mediaKind']) {
        if (m[field] && !contains(kind.match || [], field)) this.err('/match/' + field, "Remove it, or change the page's kind.", `a ${p.kind} page can't be matched by ${field}`)
      }
      if ((m.library ?? 0) < 0) this.err('/match/library', '', "a library's ID is a positive number")
      if (m.libraryKind && !contains(cat.libraryKinds, m.libraryKind)) this.err('/match/libraryKind', suggest(m.libraryKind, cat.libraryKinds), `${q(m.libraryKind)} is not a kind of library`)
      if (m.mediaKind && !contains(cat.mediaKinds, m.mediaKind)) this.err('/match/mediaKind', suggest(m.mediaKind, cat.mediaKinds), `${q(m.mediaKind)} is not a kind of title`)
    }
    if (isObj(p.personal)) {
      list(p.personal.allow).forEach((a, i) => {
        if (!contains(cat.personalKinds, a)) this.err('/personal/allow/' + i, suggest(a, cat.personalKinds), `${q(a)} is not something a profile can change`)
      })
    }
    if (list(p.sections).length === 0 && list(p.variants).length === 0) this.warn('/sections', 'Add a section, or apply a preset.', 'the page has no sections, so it will be empty')
    this.sectionList(list(p.sections), '/sections')
    if (list(p.variants).length > PAGE_LIMITS.maxVariants) this.err('/variants', 'Combine variants with any/all conditions.', `a page has at most ${PAGE_LIMITS.maxVariants} variants`)
    const seen = new Set<string>()
    list(p.variants).forEach((va: any, i) => {
      const path = '/variants/' + i
      if (!idPattern.test(va.id ?? '')) this.err(path + '/id', 'Use a short name such as kids.', "a variant's ID is lower-case letters, digits, - and _")
      else if (seen.has(va.id)) this.err(path + '/id', 'Give each variant its own ID.', `two variants are called ${q(va.id)}`)
      seen.add(va.id)
      if (!va.when || isZeroCondition(va.when)) this.err(path + '/when', 'Say who or what the variant is for, such as {"profileKind": ["kids"]}.', 'a variant needs a condition, or it would always replace the page')
      this.condition(va.when, path + '/when', 0)
      this.sectionList(list(va.sections), path + '/sections')
    })
    if (this.count > PAGE_LIMITS.maxSections) this.err('/sections', 'Split it into more than one page.', `the page has ${this.count} sections; the most is ${PAGE_LIMITS.maxSections}`)
    const bytes = utf8Length(JSON.stringify(p))
    if (bytes > PAGE_LIMITS.maxPageBytes) this.err('', 'Split it into more than one page.', `the page is ${bytes} bytes; the most is ${PAGE_LIMITS.maxPageBytes}`)
  }

  sectionList(sections: any[], path: string) {
    if (sections.length > PAGE_LIMITS.maxChildren) this.err(path, 'Group some under Tabs, or split the page.', `a page has at most ${PAGE_LIMITS.maxChildren} top-level sections`)
    const grids = new Map<string, any>()
    this.sections(sections, path, 1, '', new Map(), grids)
    const bars = (secs: any[], p: string) => {
      secs.forEach((s, i) => {
        const sp = p + '/' + i
        if (s?.component === 'FilterBar') {
          const t = propStr(s.props, 'target', '')
          const g = grids.get(t)
          const names = [...grids.keys()].sort()
          if (t !== '' && !g) this.err(sp + '/props/target', orFix(suggest(t, names), 'Set target to the ID of a Grid section on this page.'), `the filter bar's target ${q(t)} is not a Grid on this page`)
          else if (t !== '' && g?.source?.filterable !== true) this.err(sp + '/props/target', 'Set "filterable": true on the grid\'s source (the browse source has it).', `the grid ${q(t)} doesn't follow filters`)
        }
        bars(list(s?.children), sp + '/children')
      })
    }
    bars(sections, path)
  }

  sections(secs: any[], path: string, depth: number, parent: string, ids: Map<string, string>, grids: Map<string, any>) {
    for (let i = 0; i < secs.length; i++) {
      const s = isObj(secs[i]) ? secs[i] : {}
      const sp = path + '/' + i
      this.count++
      if (depth > PAGE_LIMITS.maxDepth) {
        this.err(sp, 'Flatten the page.', `sections are nested at most ${PAGE_LIMITS.maxDepth} deep`)
        return
      }
      if (!idPattern.test(s.id ?? '')) this.err(sp + '/id', 'Use a short name such as continue or recent.', `a section's ID is lower-case letters, digits, - and _, starting with a letter, at most ${PAGE_LIMITS.maxIdLength} long`)
      else if (ids.has(s.id)) this.err(sp + '/id', 'Give each section its own ID.', `the ID ${q(s.id)} is already used at ${ids.get(s.id)}`)
      ids.set(s.id, sp)
      const mod = moduleOf(s.component)
      const mc = this.self?.components.get(s.component)
      if (mod !== '' && !mc) {
        this.missingModule(sp + '/component', `Install or turn on the ${mod} module, or remove the section.`, 'component', s.component, mod)
        continue
      }
      if (mc) {
        const spec = this.component(s.component)!
        this.props(list(spec.props), s.props, sp + '/props', spec.label)
        if (list(s.children).length > 0) this.err(sp + '/children', 'Remove them: the component brings its own.', `a ${spec.label} can't hold other sections`)
        if (isObj(s.source) && Object.keys(s.source).length > 0) this.err(sp + '/source', 'Remove the source: the component brings its own.', `a ${spec.label} doesn't take a data source`)
        const pk = list<string>(mc.pageKinds)
        if (pk.length > 0 && !pk.includes(this.page.kind)) this.err(sp + '/component', `Use it on a ${pk.join(' or ')} page.`, `a ${spec.label} only works on a ${pk.join(' or ')} page`)
        const ev = new Checker(this.page, this.self, this.own)
        ev.sections([expandComponent(mc, s)], sp, depth, parent, new Map(), new Map())
        for (const is of ev.issues) this.issues.push({ ...is, message: spec.label + ': ' + is.message })
        continue
      }
      const spec = this.component(s.component)
      if (!spec || !spec.authored) {
        this.err(sp + '/component', orFix(suggest(s.component, cat.authored), 'Choose a component from the catalogue: ' + cat.authored.join(', ') + '.'), `${q(s.component)} is not a component`)
        continue
      }
      if (s.component === 'Grid') grids.set(s.id, s)
      if (isObj(s.props) && 'emptyAction' in s.props) this.emptyAction(s.props.emptyAction, sp + '/props/emptyAction')
      if ((s.component === 'Tab') !== (parent === 'Tabs' || parent === 'CrossBar')) {
        if (s.component === 'Tab') this.err(sp + '/component', 'Put the Tab inside a Tabs section.', 'a Tab belongs inside Tabs or a CrossBar')
        else this.err(sp + '/component', 'Wrap it in a Tab.', `Tabs and a CrossBar hold only Tab sections, not ${s.component}`)
      }
      if (parent === 'List' && s.component !== 'ListItem') this.err(sp + '/component', 'Use a ListItem.', `a List holds only ListItem sections, not ${s.component}`)
      if (parent === 'Stack:row' && !['Button', 'Text', 'Image', 'Spacer', 'Divider', 'SearchBox'].includes(s.component)) this.err(sp + '/component', 'Put it in a Stack that goes down, or directly on the page.', `a Stack that goes across holds only Button, Text, Image, Spacer, Divider and SearchBox, not ${s.component}`)
      this.props(list(spec.props), s.props, sp + '/props', spec.label)
      this.source(s, spec, sp)
      this.condition(s.when, sp + '/when', 0)
      if (s.scope && !scopePattern.test(s.scope)) this.err(sp + '/scope', "Use a module's ID such as wittytv, or a name of your own in lower case.", `${q(s.scope)} is not a theme scope`)
      if (s.repeat) this.repeat(s, sp, depth)
      if (['Button', 'ListItem', 'Notice', 'Banner', 'Image'].includes(s.component)) {
        const n = ['to', 'native', 'url'].filter((k) => propStr(s.props, k, '') !== '').length
        if (n > 1) this.err(sp + '/props', 'Keep one of to, native and url.', `a ${spec.label} opens one thing, not ${n}`)
        if (n === 0 && s.component === 'Button') this.err(sp + '/props', 'Set to (a place in the app), native (a screen of the app) or url (a web page).', "the button doesn't open anything")
        if (s.component === 'Notice' && n > 0 !== (propStr(s.props, 'buttonLabel', '') !== '')) this.err(sp + '/props/buttonLabel', 'Set both a buttonLabel and where it leads, or neither.', "a notice's button needs a label and somewhere to go")
      }
      const children = list(s.children)
      if (children.length > 0 && !spec.container) {
        this.err(sp + '/children', 'Move them out, or into a Stack.', `a ${spec.label} can't hold other sections`)
        continue
      }
      if (children.length > PAGE_LIMITS.maxChildren) this.err(sp + '/children', 'Split it.', `a section holds at most ${PAGE_LIMITS.maxChildren} others`)
      if (s.component === 'Split' && children.length !== 2) this.err(sp + '/children', 'Give it exactly two sections; use a Stack inside one for more.', `Two columns needs exactly two sections, not ${children.length}`)
      if ((s.component === 'Tabs' || s.component === 'CrossBar') && children.length === 0) this.err(sp + '/children', 'Add a Tab.', 'Tabs needs at least one Tab')
      if (s.component === 'Tabs' || s.component === 'CrossBar') {
        const d = propStr(s.props, 'default', '')
        if (d !== '' && !children.some((c: any) => c?.id === d)) this.err(sp + '/props/default', 'Use the ID of one of its tabs.', `${q(d)} is not one of this section's tabs`)
      }
      const srcType = isObj(s.source) && isStr(s.source.type) ? s.source.type : ''
      if (s.component === 'List' && children.length > 0 && srcType !== '') this.err(sp + '/source', 'Keep the rows or the source.', 'a List is written by hand or filled from a source, not both')
      if (s.component === 'NativeView' && i !== secs.length - 1) this.err(sp, 'Move it to the end.', "the app's own view fills the rest of the page, so nothing can follow it")
      if (s.component === 'Grid' && i !== secs.length - 1 && srcType !== '') this.warn(sp, 'Move the grid to the end, or use a Row for the sections above it.', 'a Grid loads more as it is scrolled, so the sections after it are only reached at its end')
      let child = s.component
      if (s.component === 'Stack' && propStr(s.props, 'direction', 'column') === 'row') child = 'Stack:row'
      this.sections(children, sp + '/children', depth + 1, child, ids, grids)
    }
  }

  /** The button an empty section offers: a label and exactly one place to go or command to run. */
  emptyAction(a: any, path: string) {
    if (!isObj(a)) { this.err(path, 'Write {"label": "Add a library", "native": "settings"}.', 'emptyAction is an object with a label and where it leads'); return }
    if (!isStr(a.label) || a.label.trim() === '' || runes(a.label) > 40) this.err(path + '/label', 'Give the button a label of at most 40 characters.', 'the button needs a label')
    const n = ['to', 'native', 'op'].filter((k) => isStr(a[k]) && a[k] !== '').length
    if (n !== 1) this.err(path, 'Keep one of to, native and op.', `the button leads to one place or runs one command, not ${n}`)
    if (isStr(a.to) && a.to !== '' && !validRoute(a.to)) this.err(path + '/to', 'Use a place in the app beginning with one /.', `${q(a.to)} is not a place in the app`)
    if (isStr(a.op) && a.op !== '' && !contains(COMMANDS, a.op)) this.err(path + '/op', 'Use one of the catalogue\'s commands.', `${q(a.op)} is not a command`)
    if ('when' in a && !isObj(a.when)) this.err(path + '/when', 'Write a condition such as {"admin": true}.', 'when is a condition')
  }

  /** What a page puts into the shell's regions (revision 8). */
  regions(r: any) {
    if (!isObj(r)) return
    const bar = list(r.statusBar)
    const dock = list(r.systemDock)
    if (bar.length > 6) this.err('/regions/statusBar', 'Keep six or fewer.', 'the status bar holds at most 6 items')
    if (dock.length > 7) this.err('/regions/systemDock', 'Keep seven or fewer.', 'the system dock holds at most 7 entries')
    let seen = new Set<string>()
    bar.forEach((it: any, i) => {
      const p = `/regions/statusBar/${i}`
      if (!idPattern.test(it?.id ?? '') || seen.has(it.id)) this.err(p + '/id', 'Give each item its own short ID.', "an item's ID is lower-case letters, digits, - and _, and each is used once")
      seen.add(it?.id)
      if (!contains(STATUS_KINDS, it?.kind)) this.err(p + '/kind', 'Use ' + STATUS_KINDS.join(', ') + '.', `${q(it?.kind)} is not a kind of status item`)
      if (runes(it?.text ?? '') > 80) this.err(p + '/text', 'Shorten it.', "a status item's text is at most 80 characters")
    })
    seen = new Set<string>()
    dock.forEach((d: any, i) => {
      const p = `/regions/systemDock/${i}`
      if (!idPattern.test(d?.id ?? '') || seen.has(d.id)) this.err(p + '/id', 'Give each entry its own short ID.', "an entry's ID is lower-case letters, digits, - and _, and each is used once")
      seen.add(d?.id)
      if (!isStr(d?.label) || d.label.trim() === '' || runes(d.label) > 24) this.err(p + '/label', 'Use one or two short words.', 'an entry needs a label of at most 24 characters')
      if (!contains(cat.icons, d?.icon)) this.err(p + '/icon', suggest(d?.icon, cat.icons), `${q(d?.icon)} is not one of the built-in icons`)
      if (!isStr(d?.route) || !d.route.startsWith('/')) this.err(p + '/route', 'Use a place in the app such as /page/online.', 'an entry opens a route')
      if (d?.as !== undefined && d.as !== '' && d.as !== 'layer') this.err(p + '/as', 'Use layer, or leave it out.', `${q(d.as)} is not a way to show a page`)
    })
  }

  repeat(s: any, sp: string, depth: number) {
    const rp = isObj(s.repeat) ? s.repeat : {}
    if (!contains(cat.repeats, rp.over)) this.err(sp + '/repeat/over', suggest(rp.over, cat.repeats), `${q(rp.over)} is not something a section can be repeated over`)
    const srcType = isObj(s.source) && isStr(s.source.type) ? s.source.type : ''
    if (srcType === '' || list(s.children).length > 0) this.err(sp + '/repeat', 'Repeat a Row, Grid or Banner that has a source.', 'only a section with a data source can be repeated')
    if (depth > 2) this.err(sp + '/repeat', 'Move it to the top of the page or directly inside a Tab.', 'a repeated section sits at the top of a page or directly inside a Tab')
    list(rp.kinds).forEach((k, i) => {
      if (!contains(cat.libraryKinds, k)) this.err(sp + '/repeat/kinds/' + i, suggest(k, cat.libraryKinds), `${q(k)} is not a kind of library`)
    })
    if (list(rp.kinds).length > 0 && rp.over !== 'libraries') this.err(sp + '/repeat/kinds', 'Remove kinds.', 'kinds only applies when repeating over libraries')
    if ((rp.limit ?? 0) < 0 || (rp.limit ?? 0) > 50) this.err(sp + '/repeat/limit', '', "a repeat's limit is between 0 and 50")
    if (!Object.values(isObj(s.source) ? s.source : {}).includes('$each')) this.warn(sp + '/source', 'Use "$each" for the library, view or collection.', 'the section is repeated but its source never uses $each, so every copy would be the same')
  }

  props(specs: CatPropSpec[], props: unknown, path: string, what: string) {
    const names = specs.map((s) => s.name)
    const p = isObj(props) ? props : {}
    for (const k of Object.keys(p).sort()) {
      const spec = specs.find((s) => s.name === k)
      if (!spec) {
        this.err(path + '/' + k, orFix(suggest(k, names), 'Remove it. The properties are ' + names.join(', ') + '.'), `${what} has no property ${q(k)}`)
        continue
      }
      this.value(spec, p[k], path + '/' + k)
    }
    for (const s of specs) {
      if (s.required && (p[s.name] === undefined || p[s.name] === null || p[s.name] === '')) this.err(path + '/' + s.name, `Set ${s.name}: ${String(s.label).toLowerCase()}.`, `${what} needs ${q(s.name)}`)
    }
  }

  value(spec: CatPropSpec, val: unknown, path: string) {
    const str = isStr(val) ? val : ''
    const isVar = isStr(val) && val.startsWith('$')
    const wantStr = () => {
      if (!isStr(val)) this.err(path, 'Write it in quotes.', `${spec.name} is text`)
      return isStr(val)
    }
    const options = vals(spec.options)
    switch (spec.type) {
      case 'string':
      case 'text':
      case 'markdown': {
        if (!wantStr()) return
        if (isVar && spec.type === 'string') return this.variable(str, path)
        const limit = spec.maxLength || 4000
        if (runes(str) > limit) this.err(path, 'Shorten it.', `${spec.name} is at most ${limit} characters`)
        if (/[\x00\x1b]/.test(str)) this.err(path, 'Remove the control characters.', `${spec.name} holds characters that can't be shown`)
        if (spec.type === 'markdown') {
          for (const m of str.matchAll(mdLink)) {
            if (!validRoute(m[1]) && !validURL(m[1])) this.err(path, 'Link to a place in the app (/library/3) or a web address (https://…).', `the link ${q(m[1])} doesn't lead anywhere the app can open`)
          }
        }
        return
      }
      case 'int': {
        const n = toInt(val)
        if (n === undefined) {
          if (isVar) return this.variable(str, path)
          this.err(path, 'Write a whole number without quotes.', `${spec.name} is a whole number`)
          return
        }
        if ((spec.min != null && n < spec.min) || (spec.max != null && n > spec.max)) this.err(path, '', `${spec.name} is between ${spec.min ?? 'any'} and ${spec.max ?? 'any'}`)
        return
      }
      case 'bool':
        if (typeof val !== 'boolean') this.err(path, 'Write true or false without quotes.', `${spec.name} is true or false`)
        return
      case 'enum':
        if (!wantStr()) return
        if (!options.includes(str)) this.err(path, suggest(str, options), `${q(str)} is not a choice for ${spec.name}; the choices are ${options.join(', ')}`)
        return
      case 'enumList': {
        if (!Array.isArray(val)) {
          this.err(path, 'Write a list: ["a", "b"].', `${spec.name} is a list`)
          return
        }
        const seen = new Set<string>()
        val.forEach((x, i) => {
          const s = isStr(x) ? x : ''
          if (!options.includes(s)) this.err(path + '/' + i, suggest(s, options), `${q(s)} is not a choice for ${spec.name}; the choices are ${options.join(', ')}`)
          else if (seen.has(s)) this.err(path + '/' + i, 'Remove the repeat.', `${q(s)} is listed twice`)
          seen.add(s)
        })
        return
      }
      case 'icon':
        if (wantStr() && !cat.icons.includes(str)) this.err(path, suggest(str, cat.icons), `${q(str)} is not one of the built-in icons`)
        return
      case 'route':
        if (wantStr() && !validRoute(str)) this.err(path, 'Use a place in the app beginning with one /, such as /library/3. For a web page use url.', `${q(str)} is not a place in the app`)
        return
      case 'image':
        if (wantStr() && (!validRoute(str) || !str.startsWith('/api/'))) this.err(path, 'Use the address of a picture on this server, beginning /api/.', `${q(str)} is not a picture on this server`)
        return
      case 'url':
        if (wantStr() && !validURL(str)) this.err(path, 'Use a full address beginning http:// or https://.', `${q(str)} is not a web address`)
        return
      case 'section':
      case 'scope':
        if (wantStr() && !idPattern.test(str)) this.err(path, '', `${q(str)} is not an ID`)
        return
      case 'library':
      case 'ref': {
        if (isVar) return this.variable(str, path)
        const n = toInt(val)
        if (n !== undefined) {
          if (n <= 0) this.err(path, '', `${spec.name} is a positive number`)
          return
        }
        if (isStr(val)) {
          if (spec.type === 'library' && /^[+-]?\d+$/.test(val)) return
          if (spec.type === 'ref' && val.length <= 300 && val !== '') return
        }
        this.err(path, 'Use the ID number, or a variable such as $library or $each.', `${spec.name} is an ID or a $variable`)
        return
      }
    }
  }

  variable(name: string, path: string) {
    if (name === '$each') return
    const allowed = pageKindIndex.get(this.page.kind)?.variables || []
    if (!allowed.includes(name)) {
      const fix = allowed.length > 0 ? `On a ${this.page.kind} page the variables are ${allowed.join(', ')}, and $each in a repeated section.` : `A ${this.page.kind} page has no variables; write the value itself.`
      this.err(path, fix, `${name} means nothing on a ${this.page.kind} page`)
    }
  }

  source(s: any, spec: CatComponent, sp: string) {
    const src = isObj(s.source) ? s.source : {}
    const t = isStr(src.type) ? src.type : ''
    if (Object.keys(src).length > 0 && t === '') {
      this.err(sp + '/source/type', 'Name the source: "type": "recentlyAdded".', 'the source has no type')
      return
    }
    if (t === '' && spec.data === 'required') {
      this.err(sp + '/source', 'Choose where its items come from, such as {"type": "recentlyAdded"}.', `a ${spec.label} needs a data source`)
      return
    }
    if (t !== '' && spec.data === 'none') {
      this.err(sp + '/source', 'Remove the source.', `a ${spec.label} doesn't take a data source`)
      return
    }
    if (t === '') return
    const mod = moduleOf(t)
    if (mod !== '' && !this.self?.sources.get(t)) {
      this.missingModule(sp + '/source/type', `Install or turn on the ${mod} module, or choose another source.`, 'source', t, mod)
      return
    }
    const ss = this.sourceSpec(t)
    if (!ss) {
      this.err(sp + '/source/type', orFix(suggest(t, cat.sourceNames), 'Choose a source from the catalogue: ' + cat.sourceNames.join(', ') + '.'), `${q(t)} is not a data source`)
      return
    }
    const accepts = list<string>(spec.accepts)
    if (accepts.length > 0 && !accepts.includes(t)) this.err(sp + '/source/type', `Use the ${accepts.join(' or ')} source.`, `a ${spec.label} shows ${accepts.join(' or ')}, not ${t}`)
    const pk = list<string>(ss.pageKinds)
    if (pk.length > 0 && !pk.includes(this.page.kind)) this.err(sp + '/source/type', `Use it on a ${pk.join(' or ')} page.`, `the ${t} source only works on a ${pk.join(' or ')} page`)
    const params: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(src)) if (k !== 'type' && k !== 'map') params[k] = v
    this.props(list(ss.params), params, sp + '/source', 'the ' + t + ' source')
    if ('map' in src) {
      const mm = src.map
      if (!isObj(mm)) this.err(sp + '/source/map', 'Write {"subtitle": "studio"}.', "map pairs a card's title, subtitle or synopsis with an item field")
      for (const [prop, f] of Object.entries(isObj(mm) ? mm : {})) {
        const field = isStr(f) ? f : ''
        if (!contains(MAP_PROPS, prop)) this.err(sp + '/source/map/' + prop, suggest(prop, MAP_PROPS), `map can set title, subtitle or synopsis, not ${q(prop)}`)
        if (!contains(MAP_FIELDS, field)) this.err(sp + '/source/map/' + prop, orFix(suggest(field, MAP_FIELDS), 'Use one of the fields listed.'), `${q(field)} is not an item field; the fields are ${MAP_FIELDS.join(', ')}`)
      }
    }
    const style = propStr(s.props, 'cardStyle', 'auto')
    if (style !== 'auto' && s.component !== 'List') {
      const cs = styleIndex.get(style)
      const kinds = list<string>(cs?.kinds)
      if (cs && kinds.length > 0) {
        const match = list<string>(ss.yields).some((k) => kinds.includes(k))
        if (!match && ['channel', 'episode', 'chip'].includes(style)) this.warn(sp + '/props/cardStyle', `Use auto, or ${ss.cardStyle}.`, `the ${style} card style is made for ${kinds.join(' and ')}, which the ${t} source doesn't give`)
      }
    }
  }

  condition(c: any, path: string, depth: number) {
    if (!isObj(c)) return
    if (depth > 8) {
      this.err(path, 'Flatten it.', 'conditions are nested at most 8 deep')
      return
    }
    list(c.all).forEach((x, i) => this.condition(x, path + '/all/' + i, depth + 1))
    list(c.any).forEach((x, i) => this.condition(x, path + '/any/' + i, depth + 1))
    this.condition(c.not, path + '/not', depth + 1)
    if (list(c.all).length > 16 || list(c.any).length > 16) this.err(path, '', 'all and any hold at most 16 conditions')
    const many = (field: string, allowed: readonly string[]) => {
      list(c[field]).forEach((x, i) => {
        if (!contains(allowed, x)) this.err(`${path}/${field}/${i}`, suggest(x, allowed), `${q(x)} is not a ${field}; the choices are ${allowed.join(', ')}`)
      })
    }
    many('formFactor', cat.formFactors)
    many('platform', cat.platforms)
    many('profileKind', cat.profileKinds)
    many('weekday', cat.weekdays)
    const one = (field: string, allowed: readonly string[]) => {
      if (c[field] && !contains(allowed, c[field])) this.err(path + '/' + field, suggest(c[field], allowed), `${q(c[field])} is not a choice for ${field}; the choices are ${allowed.join(', ')}`)
    }
    one('can', cat.can)
    one('hasLibrary', cat.libraryKinds)
    one('libraryKind', cat.libraryKinds)
    one('flag', cat.flags)
    for (const field of ['feature', 'module', 'capability']) {
      if (c[field] && !wordPattern.test(c[field])) this.err(path + '/' + field, '', `${q(c[field])} is not a name`)
    }
    for (const field of ['timeFrom', 'timeTo']) {
      if (c[field] && !clockPattern.test(c[field])) this.err(path + '/' + field, 'Write the time as HH:MM on a 24-hour clock, such as 18:30.', `${q(c[field])} is not a time of day`)
    }
    const minW = c.minWidth ?? 0
    const maxW = c.maxWidth ?? 0
    if (minW < 0 || maxW < 0 || (minW > 0 && maxW > 0 && minW > maxW)) this.err(path + '/minWidth', '', 'minWidth and maxWidth are positive, and minWidth is no more than maxWidth')
    if (c.locale && !localeTag.test(c.locale)) this.err(path + '/locale', 'Use a language tag such as en or pt-BR.', `${q(c.locale)} is not a language`)
    if (c.libraryKind && this.page.kind !== 'library' && this.page.kind !== 'detail') this.warn(path + '/libraryKind', 'Use hasLibrary to ask whether the profile has such a library.', `libraryKind asks about the page's own library, and a ${this.page.kind} page has none`)
  }

  specText(p: string, label: unknown, desc: unknown) {
    if (!isStr(label) || label.trim() === '') this.err(p + '/label', 'Give it a label for the editor.', 'it needs a label')
    else if (runes(label) > 80) this.err(p + '/label', 'Shorten it.', 'a label is at most 80 characters')
    if (runes(desc) > 500) this.err(p + '/description', 'Shorten it.', 'a description is at most 500 characters')
  }

  paramSpecs(specs: any[], path: string) {
    const seen = new Set<string>()
    specs.forEach((s, i) => {
      const p = `${path}/${i}`
      if (!sourceNamePattern.test(s?.name ?? '') || s.name === 'type' || s.name === 'map') this.err(p + '/name', 'Use a camelCase name.', `${q(s?.name)} is not a property name`)
      if (seen.has(s?.name)) this.err(p + '/name', 'Give each its own name.', `${q(s.name)} is described twice`)
      seen.add(s?.name)
      if (!contains(PROP_TYPES, s?.type)) this.err(p + '/type', suggest(s?.type, PROP_TYPES), `${q(s?.type)} is not a property type`)
      if (!isStr(s?.label) || s.label.trim() === '') this.err(p + '/label', 'Give it a label for the editor.', 'a property needs a label')
      if ((s?.type === 'enum' || s?.type === 'enumList') && list(s.options).length === 0) this.err(p + '/options', 'List the choices.', 'a choice needs options')
      if (s?.default !== undefined && s.default !== null) {
        const dv = new Checker({ kind: 'custom' })
        dv.value(s, s.default, p + '/default')
        for (const is of dv.issues) if (!is.message.includes('means nothing')) this.issues.push(is)
      }
    })
  }

  settingRow(r: any, p: string, keys: Map<string, string>, adminPage: boolean) {
    if (!contains(SETTING_KINDS, r.kind)) this.err(p + '/kind', suggest(r.kind, SETTING_KINDS), `${q(r.kind)} is not a kind of setting; the kinds are ${SETTING_KINDS.join(', ')}`)
    if (!isStr(r.label) || r.label.trim() === '' || runes(r.label) > 80) this.err(p + '/label', 'Give it a short label.', 'a setting needs a label of at most 80 characters')
    if (runes(r.help) > 500 || runes(r.unit) > 20) this.err(p + '/help', 'Shorten it.', 'help is at most 500 characters and a unit 20')
    if (r.kind === 'info') {
      if ((r.key ?? '') !== '' || (r.default !== undefined && r.default !== null)) this.err(p, 'Leave out key and default.', 'an info row has no value')
      return
    }
    if (!settingKeyPattern.test(r.key ?? '')) this.err(p + '/key', 'Use a short camelCase name.', `${q(r.key)} is not a setting's key`)
    else if (keys.has(r.key)) this.err(p + '/key', 'Give each setting its own key.', `${q(r.key)} is already used at ${keys.get(r.key)}`)
    keys.set(r.key, p)
    switch (r.scope ?? '') {
      case '':
      case 'server':
        break
      case 'profile':
        if (adminPage) this.err(p + '/scope', "Move it to a page that isn't for administrators only.", "a profile's own setting is on a page every profile sees")
        if (r.kind === 'secret') this.err(p + '/scope', 'Keep secrets for the server.', "a secret is the server's, not a profile's")
        break
      default:
        this.err(p + '/scope', 'Use server or profile.', `${q(r.scope)} is not where a setting is kept`)
    }
    if (r.kind === 'enum' && list(r.options).length === 0) this.err(p + '/options', 'List the choices.', 'a choice needs options')
    if (r.kind !== 'enum' && list(r.options).length > 0) this.err(p + '/options', 'Remove them, or make it an enum.', 'only an enum has options')
    if (r.default !== undefined && r.default !== null) {
      if (r.kind === 'secret') this.err(p + '/default', 'Leave it out.', 'a secret has no default')
      else {
        const e = checkSetting(r, r.default)
        if (e) this.err(p + '/default', '', 'the default: ' + e)
      }
    }
    if ((r.maxLength ?? 0) < 0 || (r.maxLength ?? 0) > 4000) this.err(p + '/maxLength', '', 'maxLength is between 0 and 4000')
  }
}

/** Checks one value for a setting row, as the server does; "" when it is fine. */
export function checkSetting(r: { key?: string; kind: string; options?: EnumOption[]; min?: number; max?: number; maxLength?: number }, val: unknown): string {
  const key = r.key ?? ''
  switch (r.kind) {
    case 'bool':
      return typeof val === 'boolean' ? '' : key + ' is true or false'
    case 'enum':
      return isStr(val) && vals(r.options).includes(val) ? '' : `${key} is one of ${vals(r.options).join(', ')}`
    case 'int': {
      const n = toInt(val)
      if (n === undefined) return key + ' is a whole number'
      if ((r.min != null && n < r.min) || (r.max != null && n > r.max)) return `${key} is between ${r.min ?? 'any'} and ${r.max ?? 'any'}`
      return ''
    }
    case 'string':
    case 'secret': {
      if (!isStr(val)) return key + ' is text'
      const limit = r.maxLength || 1000
      if (runes(val) > limit) return `${key} is at most ${limit} characters`
      if (/[\x00\x1b\n\r]/.test(val)) return key + ' is one line of plain text'
      return ''
    }
    default:
      return key + ' takes no value'
  }
}

function utf8Length(s: string): number {
  return new TextEncoder().encode(s).length
}

// The JSON Schema, walked: what the server's strict reading refuses (an unknown field,
// a value of the wrong type). Missing fields aren't reported here: the server reads
// them as empty, and the checks after this say which of those matter.
const schemaDefs = (schemaJSON as any).$defs as Record<string, any>

function schemaWalk(v: unknown, node: any, path: string, out: Issue[]) {
  if (v === null || v === undefined || !node) return
  if (node.$ref) node = schemaDefs[String(node.$ref).replace('#/$defs/', '')]
  if (!node) return
  const where = path || '/'
  switch (node.type) {
    case 'object': {
      if (!isObj(v)) {
        out.push({ path: where, severity: 'error', message: 'this is an object: {…}', fix: 'Write it as {"name": value, …}.' })
        return
      }
      const props = node.properties || {}
      for (const [k, val] of Object.entries(v)) {
        if (k in props) schemaWalk(val, props[k], path + '/' + k, out)
        else if (node.additionalProperties === false) {
          const fix = k === '$schema' ? "Remove it: the server reads sdui.json strictly. Point your editor at the schema in its settings instead (see sdui/kit/README.md)." : orFix(suggest(k, Object.keys(props)), 'Remove it. The fields are ' + Object.keys(props).join(', ') + '.')
          out.push({ path: path + '/' + k, severity: 'error', message: `${q(k)} is not a field here, and the server refuses a file with one`, fix })
        } else if (isObj(node.additionalProperties)) schemaWalk(val, node.additionalProperties, path + '/' + k, out)
      }
      return
    }
    case 'array':
      if (!Array.isArray(v)) {
        out.push({ path: where, severity: 'error', message: 'this is a list: […]', fix: 'Write it as [ … ].' })
        return
      }
      v.forEach((x, i) => schemaWalk(x, node.items, path + '/' + i, out))
      return
    case 'string':
      if (!isStr(v)) out.push({ path: where, severity: 'error', message: 'this is text', fix: 'Write it in quotes.' })
      return
    case 'integer':
      if (!Number.isInteger(v)) out.push({ path: where, severity: 'error', message: 'this is a whole number', fix: 'Write a whole number without quotes.' })
      return
    case 'number':
      if (typeof v !== 'number') out.push({ path: where, severity: 'error', message: 'this is a number', fix: 'Write a number without quotes.' })
      return
    case 'boolean':
      if (typeof v !== 'boolean') out.push({ path: where, severity: 'error', message: 'this is true or false', fix: 'Write true or false without quotes.' })
      return
  }
}

/**
 * Checks a module's SDUI file as the server does, as far as that can be done without a
 * server: the file's shape, its names, the catalogue's components, sources, icons, card
 * styles and page kinds, that it uses nothing of another module's, its components'
 * templates, its navigation, settings and limits. moduleId is the ID in module.json;
 * leave it out to take the file's own. Errors are what the server would refuse.
 */
export function checkModuleUI(input: unknown, moduleId?: string): Issue[] {
  if (!isObj(input)) return [{ path: '/', severity: 'error', message: "a module's SDUI file is a JSON object", fix: `Start from {"format": "${FORMAT}", …}.` }]
  const shape: Issue[] = []
  const bytes = utf8Length(JSON.stringify(input))
  if (bytes > MAX_MODULE_BYTES) shape.push({ path: '/', severity: 'error', message: `${MODULE_FILE} is ${bytes} bytes; the most is ${MAX_MODULE_BYTES}`, fix: 'Split the module, or leave some out.' })
  schemaWalk(input, { $ref: '#/$defs/ModuleUI' }, '', shape)
  // The server can't read a file of the wrong shape, so it checks nothing more.
  if (shape.length > 0) return shape

  const ui: any = input
  const v = new Checker({ kind: 'custom' })
  if (ui.format !== FORMAT) v.err('/format', `Write "format": "${FORMAT}".`, `${q(ui.format)} is not the format of a module's SDUI file`)
  if (ui.formatVersion !== FORMAT_VERSION) v.err('/formatVersion', `Write "formatVersion": ${FORMAT_VERSION}.`, `this server reads format version ${FORMAT_VERSION}, not ${ui.formatVersion ?? 0}`)
  if (!validModuleID(ui.module ?? '')) v.err('/module', "Use the module's ID from module.json.", `${q(ui.module)} is not a module ID`)
  else if (moduleId && ui.module !== moduleId) v.err('/module', "Use the module's ID from module.json.", `the file is for ${q(ui.module)}, and the module is ${q(moduleId)}`)
  const mod: string = ui.module ?? ''
  const catRev = ui.catalog ?? 0
  if (catRev < 1 || catRev > CATALOG_REVISION) v.err('/catalog', `Write the catalogue revision it was made for, 1 to ${CATALOG_REVISION}.`, `catalog ${catRev} is not a revision this kit knows; it knows up to ${CATALOG_REVISION}`)
  const theme = isObj(ui.theme) ? ui.theme : {}
  if (theme.scope !== mod) v.err('/theme/scope', "Use the module's ID as its scope.", `a module's theme scope is its own ID, ${q(mod)}`)
  if (runes(theme.label) > 60) v.err('/theme/label', 'Shorten it.', 'a label is at most 60 characters')
  for (const k of Object.keys(isObj(theme.tokens) ? theme.tokens : {}).sort()) {
    const val = theme.tokens[k]
    if (!contains(COLOR_TOKENS, k)) v.err('/theme/tokens/' + k, 'Use a colour token themes have, such as accent.', `${q(k)} is not a colour token`)
    if (!isColour(val)) v.err('/theme/tokens/' + k, 'Use #rrggbb, #rrggbbaa or rgb()/rgba().', `${q(val)} is not a colour`)
  }
  const limits: Array<[string, number, number]> = [
    ['/pages', list(ui.pages).length, MODULE_LIMITS.pages],
    ['/sources', list(ui.sources).length, MODULE_LIMITS.sources],
    ['/components', list(ui.components).length, MODULE_LIMITS.components],
    ['/navigation', list(ui.navigation).length, MODULE_LIMITS.navigation],
    ['/settings', list(ui.settings).length, MODULE_LIMITS.settings],
    ['/views', list(ui.views).length, MODULE_LIMITS.views],
    ['/inserts', list(ui.inserts).length, MODULE_LIMITS.inserts],
    ['/presets', list(ui.presets).length, MODULE_LIMITS.presets],
  ]
  for (const [path, n, most] of limits) if (n > most) v.err(path, 'Split the module, or leave some out.', `a module adds at most ${most} of these, not ${n}`)

  const self = selfOf(ui)
  const seen = new Map<string, string>()
  const name = (path: string, kind: string, n: string) => {
    const key = kind + ' ' + n
    if (seen.has(key)) v.err(path, 'Give each its own name.', `${q(n)} is already used at ${seen.get(key)}`)
    seen.set(key, path)
  }

  list(ui.sources).forEach((s: any, i) => {
    const p = `/sources/${i}`
    if (moduleOf(s.type) !== mod || !sourceNamePattern.test(String(s.type ?? '').slice(mod.length + 1))) v.err(p + '/type', `Name it ${mod}.something, in camelCase.`, `${q(s.type)} is not a name of this module's: a source is ${mod}.<name>`)
    name(p + '/type', 'source', s.type)
    v.specText(p, s.label, s.description)
    if (s.icon && !contains(cat.icons, s.icon)) v.err(p + '/icon', suggest(s.icon, cat.icons), `${q(s.icon)} is not one of the built-in icons`)
    if (list(s.yields).length === 0) v.err(p + '/yields', 'List the kinds of item it gives, such as ["game"].', 'a source says what it gives')
    list(s.yields).forEach((k, j) => {
      if (!contains(ITEM_KINDS, k)) v.err(`${p}/yields/${j}`, suggest(k, ITEM_KINDS), `${q(k)} is not a kind of item`)
    })
    if (!styleIndex.has(s.cardStyle)) v.err(p + '/cardStyle', suggest(s.cardStyle, cat.cardStyles), `${q(s.cardStyle)} is not a card style`)
    list(s.pageKinds).forEach((k, j) => {
      if (!pageKindIndex.has(k)) v.err(`${p}/pageKinds/${j}`, suggest(k, cat.pageKinds), `${q(k)} is not a kind of page`)
    })
    if (s.seeAll && !validRoute(String(s.seeAll).replace(/[{}]/g, ''))) v.err(p + '/seeAll', `Use a place in the app such as /page/${mod}.`, `${q(s.seeAll)} is not a place in the app`)
    v.paramSpecs(list(s.params), p + '/params')
  })

  list(ui.components).forEach((c: any, i) => {
    const p = `/components/${i}`
    if (moduleOf(c.type) !== mod || !compNamePattern.test(String(c.type ?? '').slice(mod.length + 1))) v.err(p + '/type', `Name it ${mod}.Something, in PascalCase.`, `${q(c.type)} is not a name of this module's: a component is ${mod}.<Name>`)
    name(p + '/type', 'component', c.type)
    v.specText(p, c.label, c.description)
    if (c.icon && !contains(cat.icons, c.icon)) v.err(p + '/icon', suggest(c.icon, cat.icons), `${q(c.icon)} is not one of the built-in icons`)
    v.paramSpecs(list(c.props), p + '/props')
    list(c.pageKinds).forEach((k, j) => {
      if (!pageKindIndex.has(k)) v.err(`${p}/pageKinds/${j}`, suggest(k, cat.pageKinds), `${q(k)} is not a kind of page`)
    })
    const sec = isObj(c.section) ? c.section : {}
    if (self.components.has(sec.component)) {
      v.err(p + '/section/component', "Build it from the catalogue's components.", "a component is made of the catalogue's components, not of another of the module's")
      return
    }
    for (const ph of placeholders(sec)) {
      if (!list(c.props).some((ps: any) => ps?.name === ph)) v.err(p + '/section', `Add a property called ${ph}, or remove {{${ph}}}.`, `{{${ph}}} names no property of the component`)
    }
    const kind = list<string>(c.pageKinds)[0] || 'custom'
    const filled = expandComponent(c, { id: 'example', component: c.type, props: exampleProps(list(c.props)) })
    const sv = new Checker({ kind }, self, true)
    sv.sectionList([filled], p + '/section')
    v.issues.push(...sv.issues)
  })

  list(ui.views).forEach((w: any, i) => {
    const p = `/views/${i}`
    if (moduleOf(w.id) !== mod || !sourceNamePattern.test(String(w.id ?? '').slice(mod.length + 1))) v.err(p + '/id', `Name it ${mod}.something, in camelCase.`, `${q(w.id)} is not a name of this module's: a view is ${mod}.<name>`)
    name(p + '/id', 'view', w.id)
    v.specText(p, w.label, w.description)
    list(w.platforms).forEach((pl, j) => {
      if (!contains(cat.platforms, pl)) v.err(`${p}/platforms/${j}`, suggest(pl, cat.platforms), `${q(pl)} is not a platform`)
    })
  })

  const pageIDs = new Set<string>()
  list(ui.pages).forEach((pg: any, i) => {
    const p = `/pages/${i}`
    if (!ownedID(mod, pg.id)) v.err(p + '/id', `Call it ${mod} or ${mod}-something.`, `${q(pg.id)} is not a page ID of this module's`)
    if (pg.id in STOCK_PAGES) v.err(p + '/id', 'Choose another ID.', `${q(pg.id)} is a built-in page's ID`)
    name(p + '/id', 'page', pg.id)
    pageIDs.add(pg.id)
    if (!contains(MODULE_PAGE_KINDS, pg.kind)) v.err(p + '/kind', `A module adds a page of kind ${MODULE_PAGE_KINDS.join(', ')}; it adds to Home with an insert.`, `a module can't add a ${pg.kind} page`)
    const m = isObj(pg.match) ? pg.match : null
    if ((pg.kind === 'library' || pg.kind === 'detail') && (!m || (!m.libraryKind && !m.mediaKind))) v.err(p + '/match', 'Narrow it with match.libraryKind or match.mediaKind.', `a module's ${pg.kind} page is for a kind of library or title, never all of them`)
    if (m && m.library) v.err(p + '/match/library', 'Use match.libraryKind.', "a module doesn't know this server's libraries")
    const pv = new Checker({ id: pg.id, kind: pg.kind }, self, true)
    pv.pageCheck(pg)
    for (const is of pv.issues) v.issues.push({ ...is, path: p + is.path })
  })

  list(ui.inserts).forEach((ins: any, i) => {
    const p = `/inserts/${i}`
    const target = STOCK_PAGES[ins.page]
    if (!target || !Object.prototype.hasOwnProperty.call(STOCK_PAGES, ins.page)) {
      v.err(p + '/page', 'Name a built-in page, such as home.', `${q(ins.page)} is not a built-in page`)
      return
    }
    if (ins.after && ins.before) v.err(p, 'Keep one of after and before.', 'an insert goes after a section or before one, not both')
    for (const ref of [ins.after, ins.before]) {
      if (ref && !target.sections.includes(ref)) v.err(p, `Name a top-level section of the ${ins.page} page.`, `the ${ins.page} page has no section ${q(ref)}`)
    }
    const sec = isObj(ins.section) ? ins.section : {}
    if (!ownedID(mod, sec.id)) v.err(p + '/section/id', `Call it ${mod}-something.`, `${q(sec.id)} is not a section ID of this module's`)
    name(p + '/section/id', 'insert ' + ins.page, sec.id)
    const sv = new Checker({ id: ins.page, kind: target.kind }, self, true)
    sv.sectionList([sec], p + '/section')
    v.issues.push(...sv.issues)
  })

  list(ui.presets).forEach((ps: any, i) => {
    const p = `/presets/${i}`
    if (!ownedID(mod, ps.id)) v.err(p + '/id', `Call it ${mod}-something.`, `${q(ps.id)} is not a preset ID of this module's`)
    name(p + '/id', 'preset', ps.id)
    v.specText(p, ps.label, ps.description)
    const sv = new Checker({ kind: 'custom' }, self, true)
    sv.sectionList([isObj(ps.section) ? ps.section : {}], p + '/section')
    v.issues.push(...sv.issues)
  })

  navigation(v, list(ui.navigation), (id) => pageIDs.has(id) || id in STOCK_PAGES)
  list(ui.navigation).forEach((it: any, i) => {
    const p = `/navigation/${i}`
    if (!ownedID(mod, it.id)) v.err(p + '/id', `Call it ${mod} or ${mod}-something.`, `${q(it.id)} is not an entry ID of this module's`)
    if (it.type === 'native' && it.screen === 'settings') v.err(p + '/screen', "Describe the module's settings under settings instead.", "Settings is the server's entry")
    if (it.type === 'libraries' || it.type === 'library') v.err(p + '/type', 'Use a page or a route.', "a module doesn't know this server's libraries")
  })

  const keys = new Map<string, string>()
  list(ui.settings).forEach((sp: any, i) => {
    const p = `/settings/${i}`
    if (!ownedID(mod, sp.id)) v.err(p + '/id', `Call it ${mod} or ${mod}-something.`, `${q(sp.id)} is not a settings page ID of this module's`)
    name(p + '/id', 'settings', sp.id)
    v.specText(p, sp.title, '')
    if (sp.icon && !contains(cat.icons, sp.icon)) v.err(p + '/icon', suggest(sp.icon, cat.icons), `${q(sp.icon)} is not one of the built-in icons`)
    if (sp.slot) {
      if (!contains(SETTINGS_SLOTS, sp.slot)) v.err(p + '/slot', 'Use you.games or people.profile.', `${q(sp.slot)} is not a place settings pages can go`)
      else if (sp.slot === 'people.profile' && !sp.admin) v.err(p + '/admin', 'Set admin to true.', `the ${sp.slot} slot is for administrators, so the page must be an admin page`)
    }
    let rows = 0
    list(sp.groups).forEach((grp: any, g) => {
      const gp = `${p}/groups/${g}`
      if (runes(grp.title) > 80 || runes(grp.footer) > 500) v.err(gp, 'Shorten it.', "a group's title is at most 80 characters and its footer 500")
      list(grp.rows).forEach((r: any, ri) => {
        rows++
        v.settingRow(isObj(r) ? r : {}, `${gp}/rows/${ri}`, keys, !!sp.admin)
      })
    })
    if (rows === 0) v.err(p + '/groups', 'Add a row, or leave the page out.', 'a settings page needs at least one row')
    if (rows > MODULE_LIMITS.rows) v.err(p + '/groups', 'Split it into more pages.', `a settings page has at most ${MODULE_LIMITS.rows} rows`)
  })
  return v.issues
}

// The navigation's checks (the server's ValidateNavigation), on the module's entries with
// the server's Settings entry after them.
function navigation(v: Checker, items: any[], pageExists: (id: string) => boolean) {
  const all = [...items, { id: 'settings', type: 'native', screen: 'settings' }]
  if (all.length > PAGE_LIMITS.maxNavItems) v.err('/navigation', 'Put less used entries behind a page of links.', `the navigation has at most ${PAGE_LIMITS.maxNavItems} entries`)
  const ids = new Set<string>()
  const nv = new Checker({ kind: 'custom' })
  all.forEach((it: any, i) => {
    const p = '/navigation/' + i
    if (!idPattern.test(it.id ?? '')) nv.err(p + '/id', 'Use a short name such as home.', "an entry's ID is lower-case letters, digits, - and _")
    else if (ids.has(it.id)) nv.err(p + '/id', 'Give each entry its own ID.', `two entries are called ${q(it.id)}`)
    ids.add(it.id)
    if (runes(it.label) > 40) nv.err(p + '/label', 'Shorten it.', 'a label is at most 40 characters')
    if (it.icon && !contains(cat.icons, it.icon)) nv.err(p + '/icon', suggest(it.icon, cat.icons), `${q(it.icon)} is not one of the built-in icons`)
    switch (it.type) {
      case 'page':
        if (!idPattern.test(it.page ?? '')) nv.err(p + '/page', 'Name the page by its ID.', "the entry doesn't say which page it opens")
        else if (!pageExists(it.page)) nv.err(p + '/page', 'Create the page first, or remove the entry.', `there is no page called ${q(it.page)}`)
        break
      case 'libraries':
        break
      case 'library':
        if (!((it.library ?? 0) > 0)) nv.err(p + '/library', "Give the library's ID.", "the entry doesn't say which library it opens")
        break
      case 'native': {
        if (!contains(NAV_SCREENS, it.screen)) nv.err(p + '/screen', suggest(it.screen, NAV_SCREENS), `${q(it.screen)} is not a screen an entry can open; the choices are ${NAV_SCREENS.join(', ')}`)
        if (it.screen === 'settings' && it.when) nv.err(p + '/when', 'Remove the condition.', "Settings is always in the navigation; it can't have a condition")
        if (it.screen === 'settings') {
          for (const [ff, where] of Object.entries(isObj(it.placement) ? it.placement : {})) if (where === 'hidden') nv.err(p + '/placement/' + ff, 'Use more or end to keep it out of the way.', "Settings can't be hidden")
        }
        break
      }
      case 'route':
        if (!validRoute(it.route)) nv.err(p + '/route', 'Use a place in the app beginning with one /.', `${q(it.route)} is not a place in the app`)
        if (!it.label) nv.err(p + '/label', 'Give it a label.', 'an entry that opens a route needs a label')
        break
      default:
        nv.err(p + '/type', suggest(it.type, ['page', 'libraries', 'library', 'native', 'route']), `${q(it.type)} is not a kind of entry; the kinds are page, libraries, library, native and route`)
    }
    nv.condition(it.when, p + '/when', 0)
    for (const ff of Object.keys(isObj(it.placement) ? it.placement : {}).sort()) {
      const where = it.placement[ff]
      if (!contains(cat.formFactors, ff)) nv.err(p + '/placement/' + ff, suggest(ff, cat.formFactors), `${q(ff)} is not a form factor`)
      if (!contains(cat.placements, where)) nv.err(p + '/placement/' + ff, suggest(where, cat.placements), `${q(where)} is not a placement; the choices are ${cat.placements.join(', ')}`)
    }
  })
  v.issues.push(...nv.issues)
}

/** Whether s is a colour the theme engine takes (the server's themes.NormalizeColor). */
export function isColour(s: unknown): boolean {
  if (!isStr(s)) return false
  const v = s.trim()
  if (['transparent', 'black', 'white'].includes(v.toLowerCase())) return true
  if (/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)) return true
  const m = /^rgba?\(\s*([0-9.]+)[\s,]+([0-9.]+)[\s,]+([0-9.]+)(?:[\s,/]+([0-9.]+%?))?\s*\)$/.exec(v)
  if (!m) return false
  const num = (x: string) => /^(\d+\.?\d*|\.\d+)$/.test(x)
  if (![m[1], m[2], m[3]].every((x) => num(x) && Number(x) <= 255)) return false
  return m[4] === undefined || num(m[4].replace(/%$/, ''))
}

/** Whether any issue is an error. */
export function hasErrors(issues: Issue[]): boolean {
  return issues.some((i) => i.severity !== 'warning')
}

/** The issues as lines for a terminal: "error /pages/0/kind: … (fix)". */
export function formatIssues(issues: Issue[]): string {
  return issues.map((i) => `${i.severity} ${i.path || '/'}: ${i.message}${i.fix ? ` (${i.fix})` : ''}`).join('\n')
}
