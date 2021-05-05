# Helix Code Bus

> Service that syncs github with the helix code bus storage

## Status
[![codecov](https://img.shields.io/codecov/c/github/adobe/helix-code-bus.svg)](https://codecov.io/gh/adobe/helix-code-bus)
[![CircleCI](https://circleci.com/gh/adobe/helix-code-bus.svg?style=svg&circle-token=e25a1785a7b3b6ccbfe20ea56733c9cd7b9aa0e2)](https://circleci.com/gh/adobe/helix-code-bus)
[![GitHub license](https://img.shields.io/github/license/adobe/helix-code-bus.svg)](https://github.com/adobe/helix-code-bus/blob/main/LICENSE.txt)
[![GitHub issues](https://img.shields.io/github/issues/adobe/helix-code-bus.svg)](https://github.com/adobe/helix-code-bus/issues)
[![LGTM Code Quality Grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/adobe/helix-code-bus.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/adobe/helix-code-bus)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

## Installation

## Usage

```bash
curl https://helix-pages.anywhere.run/helix-services/code-bus@v1
```

For more, see the [API documentation](docs/API.md).


## Initial Sync

An initial sync of repository can be done using the aws cli:

```bash
$ cd my-git-checkout
$ git pull origin main
$ aws --profile adobe s3 sync  --exclude ".git/*" --exclude ".github/*" . s3://helix-code-bus/<owner>/<repo>/main 
```

## Development

### Deploying Helix Code Bus

All commits to main that pass the testing will be deployed automatically. All commits to branches that will pass the testing will get commited as `/helix-services/code-bus@ci<num>` and tagged with the CI build number.
