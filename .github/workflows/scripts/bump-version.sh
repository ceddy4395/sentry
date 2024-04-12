set -euxo pipefail

if [ "$VERSION" = latest ]; then
VERSION="$(curl -sL https://pypi.org/pypi/$PACKAGE/json | jq -r .info.version)"
fi

git checkout -b "bot/bump-version/$PACKAGE/$VERSION"

re="$(sed 's/[_-]/[_-]/g' <<< "$PACKAGE")"
sed -i "s/^$re==.*/$PACKAGE==$VERSION/g" -- requirements*.txt
sed -i "s/^$re>=.*/$PACKAGE>=$VERSION/g" -- requirements*.txt

if git diff --exit-code; then
exit 0
fi

git \
    -c user.name=getsentry-bot \
    -c user.email='10587625+getsentry-bot@users.noreply.github.com' \
    commit \
    --all \
    --message "ref: bump $PACKAGE to $VERSION" \
    --message "Co-Authored-By: $SENDER <$SENDER_ID+$SENDER@users.noreply.github.com>"

git push origin HEAD --quiet

gh pr create --fill ${{ inputs.pr_options }}
