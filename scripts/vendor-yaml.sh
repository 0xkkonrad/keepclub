#!/usr/bin/env bash
set -euo pipefail

# Rebuild the browser-local YAML parser. Both the package tarball and generated
# module are pinned so a registry or toolchain change fails closed.
repo_dir=$(cd "$(dirname "$0")/.." && pwd)
vendor_dir="$repo_dir/web/lib/vendor"
tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT

package_version=2.9.0
esbuild_version=0.28.1
package_sha256=008fa204cb1ba700e0272ba045abbf09a6ffe63456e8146ba97cac6c2ad1ef91
bundle_sha256=1a39585f38b5184a2e1284d77ed10ca1f6c9413593589ef6a54eae9ed6d8fc71

npm pack "yaml@$package_version" --pack-destination "$tmp_dir" --silent >/dev/null
printf '%s  %s\n' "$package_sha256" "$tmp_dir/yaml-$package_version.tgz" | sha256sum --check --status
tar -xzf "$tmp_dir/yaml-$package_version.tgz" -C "$tmp_dir"

npx --yes "esbuild@$esbuild_version" "$tmp_dir/package/browser/dist/index.js" \
  --bundle --format=esm --platform=browser --target=es2020 --minify \
  --legal-comments=none --outfile="$tmp_dir/yaml-$package_version.min.js"

printf '%s  %s\n' "$bundle_sha256" "$tmp_dir/yaml-$package_version.min.js" \
  | sha256sum --check --status

mkdir -p "$vendor_dir"
cp "$tmp_dir/yaml-$package_version.min.js" "$vendor_dir/yaml-$package_version.min.js"
cp "$tmp_dir/package/LICENSE" "$vendor_dir/yaml-$package_version.LICENSE"

wc -c "$vendor_dir/yaml-$package_version.min.js"
sha256sum "$vendor_dir/yaml-$package_version.min.js"
