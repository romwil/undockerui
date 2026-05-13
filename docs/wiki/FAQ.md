# FAQ

[← Wiki home](./README.md)

## Is UnDocker officially from Lime Technology / Unraid?

No. It is a **community plugin** maintained in this repository. It uses Unraid’s **public** web and GraphQL surfaces the same way other community tools do.

## Can I run UnDocker without the Unraid web UI?

Not meaningfully. The UI expects **same-origin** access to `/graphql` and Unraid session cookies. Standalone hosting would require reimplementing authentication and likely violate how Unraid’s API is meant to be used.

## Does UnDocker replace Docker Compose on the host?

No. It **invokes** the host’s **`docker compose`** CLI through `compose_api.php` for files you choose. Compose projects you manage outside UnDocker are unaffected unless you edit those same files.

## Will updates break my containers?

**Image updates** pull new images and recreate containers per Unraid’s update flow—same risk profile as using the stock Docker UI update actions. Always read release notes for your **application images** and take backups before bulk updates.

## Can I use Unraid Connect / remote access?

If you can reach the Unraid web UI and GraphQL through your Connect or VPN path, UnDocker should work the same, subject to Unraid’s cookie and CSRF behavior across domains.

## Where do I get releases?

The source repo is [romwil/undockerui](https://github.com/romwil/undockerui). Build `plugin/dist/` from `web/` as documented in [Installation](./Installation.md). Formal release archives may be added later on the **Releases** tab.

## Next steps

- [Troubleshooting](./Troubleshooting.md)
- [Wiki home](./README.md)
