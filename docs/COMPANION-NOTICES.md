# Anioto Windows companion notices

The Anioto bridge and installer source are covered by the project’s MIT license. A companion package also includes third-party software under its own terms. Preserve the license and notice files that ship with each component.

| Component | Release input | Source |
| --- | --- | --- |
| SongRec | Official Windows standalone release 0.8.2, SHA-256 pinned in `setup-songrec.ps1` | [SongRec 0.8.2 release](https://github.com/marin-m/SongRec/releases/tag/0.8.2) |
| Python | Official Windows x64 embeddable runtime 3.13.17, SHA-256 pinned in `setup-helper.ps1` | [CPython source](https://github.com/python/cpython/tree/v3.13.17) |
| ShazamIO | Version 0.9.0 and its runtime dependencies | [ShazamIO source](https://github.com/shazamio/ShazamIO) |

The production Anioto ZIP does not redistribute SongRec's extracted Windows
runtime. Its installer downloads the pinned, unmodified official standalone
release from the SongRec project's GitHub release and verifies the SHA-256 before
extracting it locally. SongRec and its bundled libraries remain third-party
software under their respective licenses. Test archives from development may
include an extracted SongRec runtime and are not the production distribution.

The redistributed Python runtime retains `LICENSE.txt`. All 18 Python
distributions in the release runtime have their installed license/notice files
present. Exact versions, declared licenses, file paths, and upstream package
source/distribution links are recorded in
[COMPANION_PYTHON_COMPONENTS.json](COMPANION_PYTHON_COMPONENTS.json). This includes
the bundled ShazamIO core's third-party notices and pip's vendored license files.
Those files are copied intact into the companion. Python source is linked above;
Python package source files and project links are available through the pinned
version's PyPI page. Anioto installer/bridge source is included in the package
and public repository under MIT.

SongRec and ShazamIO use unofficial integrations with the same Shazam service. Anioto is independently developed.
