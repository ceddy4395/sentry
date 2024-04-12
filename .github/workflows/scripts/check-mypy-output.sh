# mypy does not have granular codes so don't allow specific messages to regress
! grep "'Settings' object has no attribute" .artifacts/mypy-all
! grep 'Cannot override class variable' .artifacts/mypy-all
! grep 'Exception type must be derived from BaseException' .artifacts/mypy-all
! grep 'Incompatible default for argument' .artifacts/mypy-all
! grep 'Incompatible return value type (got "HttpResponseBase"' .artifacts/mypy-all
! grep 'Incompatible types in "yield"' .artifacts/mypy-all
! grep 'Module "sentry.*has no attribute' .artifacts/mypy-all
! grep 'base class .* defined the type as.*Permission' .artifacts/mypy-all
! grep 'does not explicitly export attribute' .artifacts/mypy-all
