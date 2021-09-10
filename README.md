# Example Validation Caching
This is an example of caching validation responses locally. This particular
command line script caches successful validation responses, along with its
cryptographic signature, to the filesystem for 1 day, making sure a license
is validated at most once per-day, and allowing temporary offline license
validation. Storing the cryptographic signature helps prevent the cached
data from being tampered with.

Feel free to cache to another form of local storage, e.g. registry, etc.

## Running the example

First up, configure a few environment variables:
```bash
# Your Keygen account's DER encoded Ed25519 verify key
export KEYGEN_VERIFY_KEY="MCowBQYDK2VwAyEA6GAeSLaTg7pSAkX9B5cemD0G0ixCV8/YIwRgFHnO54g="

# Your Keygen account ID (find yours at https://app.keygen.sh/settings)
export KEYGEN_ACCOUNT_ID="1fddcec8-8dd3-4d8d-9b16-215cac0f9b52"
```

You can either run each line above within your terminal session before
starting the app, or you can add the above contents to your `~/.bashrc`
file and then run `source ~/.bashrc` after saving the file.

Next, install dependencies with [`yarn`](https://yarnpkg.comg):

```bash
yarn
```

Then run the script and input a license key:

```bash
yarn start
# => Enter your license key: DEMO-AABCCD-7F6E4A-E64012-340C88-V3
```

## Questions?

Reach out at [support@keygen.sh](mailto:support@keygen.sh) if you have any
questions or concerns!
