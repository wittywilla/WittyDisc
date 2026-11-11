# Changelog

What changed in WittyDisc, newest first. What changed before it had a repository of its own is in the
[WittyMediaServer changelog](https://github.com/wittywilla/WittyMediaServer/blob/master/CHANGELOG.md).

## Unreleased

- **WittyDisc 0.2.1:** A small file that UDF keeps inside its file entry is read from where the entry holds it. It was read from the end of the entry's block, which gave the wrong bytes. It says it works with WittyMediaServer up to 0.8.x.

- Module API 3 and WittyMediaServer 0.6.0-alpha: this is how a server gets it now, with no copy compiled in.
- WittyDisc is now a project of its own, developed and released from this repository.
