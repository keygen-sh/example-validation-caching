# Example Validation Caching
This is an example of caching validation responses locally. This particular
command line script caches successful validation responses to the filesystem
for 1 day, making sure a license is validated at most once per-day.

Feel free to cache to another form of local storage, e.g. registry, etc.

## Running the example

First up, configure a few environment variables:
```bash
# Your Keygen account ID (find yours at https://app.keygen.sh/settings)
export KEYGEN_ACCOUNT_ID="YOUR_KEYGEN_ACCOUNT_ID"
```

You can either run each line above within your terminal session before
starting the app, or you can add the above contents to your `~/.bashrc`
file and then run `source ~/.bashrc` after saving the file.

Next, install dependencies with [`yarn`](https://yarnpkg.comg):
```
yarn
```

Then run the script and input a license key:
```
yarn start
```

## Questions?

Reach out at [support@keygen.sh](mailto:support@keygen.sh) if you have any
questions or concerns!
