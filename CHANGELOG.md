# Changelog

What changed in WittyDisc, newest first. What changed before it had a repository of its own is in the
[WittyMediaServer changelog](https://github.com/wittywilla/WittyMediaServer/blob/master/CHANGELOG.md).

## 0.3.6

- **Updated dependencies:** react-router-dom from 7.18.5 to 7.18.6; actions/setup-go from 7.0.0 to 7.1.0; esbuild from 0.27.7 to 0.28.2.

## 0.3.5

- **Back on any TV remote** closes a disc's pop-up menu or leaves the player. Some remotes' Back button did nothing.
- **On a television,** the title line says "Back closes" and "Menu button" for the pop-up menu, instead of Esc and "Menu key".

## Developer notes for 0.3.5

- `DvdPlayer.tsx`: Back is also `Back` and `XF86Back`; `onTv()` (the server's `html.tv-mode`) picks the remote's words (docs/TV-MODE.md).

## 0.3.4

- **Fixed: seeking on a Blu-ray** no longer stalls and skips ahead. A seek now waits however long the disc takes, and only steps over a real gap.

## 0.3.3

- DVD menu: Resume and Play movie are normal-sized buttons in one row with Remote and the settings, as the host's player bar lays them out (they were stretched across two rows). The web test runs on Windows.

## 0.3.2

- Signed with the module key: 0.3.1 was signed with another key, so no server could install it.

## 0.3.1

- The first published release on module API 5, with the WittyModule 0.5.4 workflows. The tag v0.3.0 was made with workflows that couldn't build it and was never published.

## 0.3.0

- Built on WittyModule 0.5.4 and module API 5.
- **WittyDisc 0.3.0: module API 5, with a web part.** The disc player WittyDVD and WittyBluray share in WittyMediaServer's web app is WittyDisc's: the player with the disc's own menus, its remote and another device steering it (`players: disc`), Settings' DVDs and Blu-rays (`settings: discs`, after Playback), and an administrator's Disc settings and "Name titles and scenes" in a title's menu. It is delivered as a web bundle (`index.js`), which WittyDVD and WittyBluray bring with them; the Go library still reaches a server inside them. The disc sessions it opens, their streams and the refusal of encrypted discs stay the server's, and so do the settings, which the server's sessions read. Its `sdui.json` carries only its theme scope: on every other app a disc plays in the app's own player.
- **WittyDisc 0.2.1:** A small file that UDF keeps inside its file entry is read from where the entry holds it. It was read from the end of the entry's block, which gave the wrong bytes. It says it works with WittyMediaServer up to 0.8.x.
- **WittyDisc 0.2.1:** Discs that were burned or rewritten read too. A rewritable disc's sparable partition is read through its sparing table, and an incrementally written disc's virtual partition through the allocation table at its end; a disc that lacks one is refused with a reason rather than read wrongly. Extended allocation descriptors are read, and so are file entries that a rewritable disc replaced with newer ones.
- **WittyDisc 0.2.1:** Part of a file the disc does not record (allocated but not written, or not allocated) reads as zeros. It was read from whatever lay at that place on the disc, or left out so the rest of the file came too early. Such a part is an extent marked `Zero`, with an offset of -1, so a program handed the extents can't take it for bytes of the image. A file longer than its extents reads as zeros to its end, and extents longer than the file end where it does.
- **WittyDisc 0.2.1:** On a Blu-ray, a directory or file whose blocks lie in two pieces of the metadata file is read from both. The metadata file's mirror is used when the main copy can't be read, and also when it leads nowhere or to a damaged directory. One directory that can't be read no longer loses the rest of the disc, and an image that ends early stops a read there instead of filling in from the next extent.
- **WittyDisc 0.2.1:** Room for any real disc: directories up to 64 MB and 32 levels deep, files in any number of extents (a few million across the disc), and the reserve copy of the volume descriptors when the main one is damaged.

- Module API 3 and WittyMediaServer 0.6.0-alpha: this is how a server gets it now, with no copy compiled in.
- WittyDisc is now a project of its own, developed and released from this repository.
