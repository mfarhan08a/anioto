# Contributing to Anioto

Thanks for helping improve Anioto. Use [GitHub Issues](https://github.com/mfarhan08a/anioto/issues) for bug reports, feature discussions, and documentation questions.

## Report a problem

Include the browser and OS versions, the selected recognition provider, steps to reproduce, and the exact message Anioto displayed. For a matching issue, include the recognized song title and artist, the expected anime, and a public source supporting that association. A public video link and timestamp can help reproduce a capture problem.

Keep API keys, account tokens, private recordings, and personal browsing history out of issues and screenshots. Avoid reporting security vulnerabilities in a public issue. GitHub’s private vulnerability reporting can be used once the repository owner enables it.

## Make a change

1. Fork the repository and create a focused branch.
2. Use Node.js 22.12 or newer and run `npm ci`.
3. Make a change that addresses one problem. Keep the popup, offscreen job, and helper behavior consistent with the chosen provider.
4. Build, typecheck, lint, and run the tests.

```sh
npm run build
npm run typecheck
npm run lint
npm test
```

On Windows, helper changes can also be checked with the project’s installed runtime.

```powershell
.\local-data\runtime\python.exe -m unittest discover -s helper -p 'test_*.py'
```

For a behavior change, include regression coverage for the actual failure. For a song-lookup correction, investigate spelling, normalization, aliases, artist matching, and upstream availability. Source-backed supplemental credits should include a link that establishes the song-to-anime association.

In your pull request, explain the problem, the resulting behavior, how you verified it, and any remaining limitation. Use synthetic or appropriately licensed test audio. Generated builds, helper binaries, credentials, recordings, and browser profiles belong outside Git.

## Licensing

Submit original contributions under the project’s MIT license and preserve existing third-party notices. Identify the license and source of any dependency, artwork, or data you add. Companion redistribution has separate obligations described in [the component notices](docs/COMPANION-NOTICES.md).
