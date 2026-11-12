# Changelog

What changed in WittyDisc, newest first. What changed before it had a repository of its own is in the
[WittyMediaServer changelog](https://github.com/wittywilla/WittyMediaServer/blob/master/CHANGELOG.md).

## Unreleased

- **WittyDisc 0.2.1:** A small file that UDF keeps inside its file entry is read from where the entry holds it. It was read from the end of the entry's block, which gave the wrong bytes. It says it works with WittyMediaServer up to 0.8.x.
- **WittyDisc 0.2.1:** Discs that were burned or rewritten read too. A rewritable disc's sparable partition is read through its sparing table, and an incrementally written disc's virtual partition through the allocation table at its end; a disc that lacks one is refused with a reason rather than read wrongly. Extended allocation descriptors are read, and so are file entries that a rewritable disc replaced with newer ones.
- **WittyDisc 0.2.1:** Part of a file the disc does not record (allocated but not written, or not allocated) reads as zeros. It was read from whatever lay at that place on the disc, or left out so the rest of the file came too early. Such a part is an extent marked `Zero`, with an offset of -1, so a program handed the extents can't take it for bytes of the image. A file longer than its extents reads as zeros to its end, and extents longer than the file end where it does.
- **WittyDisc 0.2.1:** On a Blu-ray, a directory or file whose blocks lie in two pieces of the metadata file is read from both. The metadata file's mirror is used when the main copy can't be read, and also when it leads nowhere or to a damaged directory. One directory that can't be read no longer loses the rest of the disc, and an image that ends early stops a read there instead of filling in from the next extent.
- **WittyDisc 0.2.1:** Room for any real disc: directories up to 64 MB and 32 levels deep, files in any number of extents (a few million across the disc), and the reserve copy of the volume descriptors when the main one is damaged.

- Module API 3 and WittyMediaServer 0.6.0-alpha: this is how a server gets it now, with no copy compiled in.
- WittyDisc is now a project of its own, developed and released from this repository.
