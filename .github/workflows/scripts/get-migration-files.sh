echo 'added<<EOF' >> "$GITHUB_OUTPUT"
git diff --diff-filter=A --name-only origin/master HEAD -- 'src/sentry/*/migrations/*' 'src/sentry/migrations/*' >> "$GITHUB_OUTPUT"
echo 'EOF' >> "$GITHUB_OUTPUT"
