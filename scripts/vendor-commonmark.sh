#!/usr/bin/env bash
set -euo pipefail

# Rebuild the browser-local parser from pinned packages and toolchain.
repo_dir=$(cd "$(dirname "$0")/.." && pwd)
vendor_dir="$repo_dir/web/lib/vendor"
tmp_dir=$(mktemp -d)
npm_cache=$(mktemp -d)
trap 'rm -rf "$tmp_dir" "$npm_cache"' EXIT

commonmark_version=0.31.2
entities_version=3.0.1
mdurl_version=1.0.1
esbuild_version=0.28.1
commonmark_sha256=da3b40eb5a06824b4618ed5a2964bec3f4e6a95fd3dd904715f9293c777828f1
entities_sha256=bdddca0c11d55bab2e1192618b14efade94b2173070d67e9b096fbe6cfb63df6
mdurl_sha256=c116abcf850f97ca9dc5e153c59350e8f89a6c881c99d57adf19680f9d451e9e
bundle_sha256=71e8fc088e76312d850f05f8d7105d9d75904ded0cabd7b8b7c85e183d584dd6

export npm_config_cache="$npm_cache"
npm pack "commonmark@$commonmark_version" "entities@$entities_version" \
  "mdurl@$mdurl_version" --pack-destination "$tmp_dir" --silent >/dev/null
printf '%s  %s\n' \
  "$commonmark_sha256" "$tmp_dir/commonmark-$commonmark_version.tgz" \
  "$entities_sha256" "$tmp_dir/entities-$entities_version.tgz" \
  "$mdurl_sha256" "$tmp_dir/mdurl-$mdurl_version.tgz" \
  | sha256sum --check --status

tar -xzf "$tmp_dir/commonmark-$commonmark_version.tgz" -C "$tmp_dir"
mkdir -p "$tmp_dir/package/node_modules/entities" "$tmp_dir/package/node_modules/mdurl"
tar -xzf "$tmp_dir/entities-$entities_version.tgz" \
  -C "$tmp_dir/package/node_modules/entities" --strip-components=1
tar -xzf "$tmp_dir/mdurl-$mdurl_version.tgz" \
  -C "$tmp_dir/package/node_modules/mdurl" --strip-components=1
npx --yes "esbuild@$esbuild_version" "$tmp_dir/package/lib/blocks.js" \
  --bundle --format=esm --platform=browser --target=es2020 --minify \
  --legal-comments=none \
  --outfile="$tmp_dir/commonmark-parser-$commonmark_version.min.js"
printf '%s  %s\n' \
  "$bundle_sha256" "$tmp_dir/commonmark-parser-$commonmark_version.min.js" \
  | sha256sum --check --status

mkdir -p "$vendor_dir"
cp "$tmp_dir/commonmark-parser-$commonmark_version.min.js" \
  "$vendor_dir/commonmark-parser-$commonmark_version.min.js"
cp "$tmp_dir/package/LICENSE" \
  "$vendor_dir/commonmark-parser-$commonmark_version.LICENSE"
cp "$tmp_dir/package/node_modules/entities/LICENSE" \
  "$vendor_dir/commonmark-parser-$commonmark_version-entities.LICENSE"
cp "$tmp_dir/package/node_modules/mdurl/LICENSE" \
  "$vendor_dir/commonmark-parser-$commonmark_version-mdurl.LICENSE"
wc -c "$vendor_dir/commonmark-parser-$commonmark_version.min.js"
sha256sum "$vendor_dir/commonmark-parser-$commonmark_version.min.js"
