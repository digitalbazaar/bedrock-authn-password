# bedrock-authn-password ChangeLog

## 4.0.1 - 2018-05-10

### Changed
- Use `brPermission.checkPermission`.

## 4.0.0 - 2017-05-11

**BREAKING**
- Removed the `postJoin` validation schema which now resides in
  `bedrock-website-user-http`.

## 3.0.5 - 2017-05-11

### Fixed
- Replace `postJoin` validation schema.

## 3.0.4 - 2017-05-11

### Fixed
- Fix uncaught exception when an identity did not have an assigned password.
- Fix race condition in legacy password routine.

## 3.0.3 - 2016-10-04

### Fixed
- Remove unused dependencies.

## 3.0.2 - 2016-06-22

### Fixed
- Only send passcodes/password reset emails to active identities.

## 3.0.1 - 2016-06-07

### Changed
- Update dependencies.

## 3.0.0 - 2016-05-25

### Changed
- Moved pseudo bower component into bedrock-angular-authn-password.

## 2.0.0 - 2016-05-24

### Changed
- Update to bedrock-angular-authn 2.0.0 which includes breaking API changes.

## 1.2.0 - 2016-05-18

### Added
- Password reset request modal.

## 1.1.0 - 2016-05-16

### Added
- Password reset with a passcode.

## 1.0.1 - 2016-04-30

## 1.0.0 - 2016-04-28

- See git history for changes.
