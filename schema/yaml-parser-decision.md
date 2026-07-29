# YAML parser decision

Decision: vendor and lazily import `yaml` 2.9.0 by Eemeli Aro (ISC).

Compared on 29 July 2026:

| Candidate | Result |
| --- | --- |
| `yaml` 2.9.0 | Chosen. Maintained YAML 1.2 parser, dependency-free, browser ESM distribution, document/AST API, source ranges, `LineCounter`, strict duplicate-key errors, and explicit conversion to plain JS. npm unpacked size: 685,953 bytes. |
| `js-yaml` 5.2.2 | Capable safe YAML parser, but its public API focuses on values rather than a ranged document tree; producing stable field locations and reliably identifying every forbidden anchor/tag would require lower-level work. npm unpacked size: 1,442,014 bytes. |
| `yaml-eslint-parser` 2.1.0 | Excellent ranged ESLint AST, but it depends on `yaml` plus ESLint visitor machinery. It adds an unnecessary parser layer for runtime import. |

The app is static ESM and must work offline, so it does not import a CDN or
`node_modules`. `scripts/vendor-yaml.sh` downloads the pinned npm tarball,
checks its SHA-256, bundles the package's supplied browser entry with pinned
esbuild 0.28.1, checks the deterministic output SHA-256, and copies the module
and license into `web/lib/vendor/`.

Distributed parser:

- `web/lib/vendor/yaml-2.9.0.min.js`
- 103,322 bytes raw; 31,975 bytes with gzip `-9`
- SHA-256
  `1a39585f38b5184a2e1284d77ed10ca1f6c9413593589ef6a54eae9ed6d8fc71`
- dynamically imported only when `parseCourseYaml()` is called

The bundle contains upstream parser code only. keep club's security policy,
limits, diagnostics, and conversion boundary remain readable in
`web/lib/course-yaml.js`.
