#!/usr/bin/env bash
# 소스 조각들을 단일 HTML로 합칩니다.
#   dist/artifact.html : <head> 스켈레톤 없는 조각 (Claude Artifact 배포용)
#   index.html         : 완전한 문서 (GitHub Pages / 로컬 실행용)
set -e
cd "$(dirname "$0")"
mkdir -p dist
{ cat src/head.html
  echo '<script>'; cat src/data.js
  echo '</script><script>'; cat src/voices.js
  echo '</script><script>'; cat src/render.js
  echo '</script><script>'; cat src/game.js
  echo '</script><script>'; cat src/fx.js
  echo '</script>'; } > dist/artifact.html
{ echo '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
  sed '0,/<\/style>/s//<\/style><\/head><body>/' dist/artifact.html
  echo '</body></html>'; } > index.html
echo "built: index.html ($(wc -c < index.html) bytes), dist/artifact.html"
