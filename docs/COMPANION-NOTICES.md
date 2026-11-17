# Anioto Windows companion notices

The Anioto bridge and installer source are covered by the project’s MIT license. A companion package also includes third-party software under its own terms. Preserve the license and notice files that ship with each component.

| Component | Release input | Source |
| --- | --- | --- |
| SongRec | Official Windows standalone release 0.8.2, SHA-256 pinned in `setup-songrec.ps1` | [SongRec 0.8.2 release](https://github.com/marin-m/SongRec/releases/tag/0.8.2) |
| Python | Official Windows x64 embeddable runtime 3.13.17, SHA-256 pinned in `setup-helper.ps1` | [CPython source](https://github.com/python/cpython/tree/v3.13.17) |
| ShazamIO | Version 0.9.0 and its runtime dependencies | [ShazamIO source](https://github.com/shazamio/ShazamIO) |

Before distributing a companion, inventory the actual binaries and Python wheels, verify their licenses and source provenance, and publish corresponding source and build information alongside the package wherever required. The SongRec release also includes dependencies that must be included in that review. These upstream links are starting points for that inventory.

SongRec and ShazamIO use unofficial integrations with the same Shazam service. Anioto is independently developed.
