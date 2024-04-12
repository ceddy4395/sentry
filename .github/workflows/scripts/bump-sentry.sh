cd getsentry

python -S -m bin.bump_sentry $sha

# If getsentry is pushed to by any other means while we were here,
# we won't be able to push.
for i in 1 2 3 4 5; do
    git push origin master && exit 0
    # There's a little bit of network delay here that suffices
    # as a small sleep.
    git \
    -c user.name=getsentry-bot \
    -c user.email=bot@sentry.io \
    pull --rebase origin master
done

# 5th and final attempt.
git push origin master
