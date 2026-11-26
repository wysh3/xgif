# xgif

Convert public X videos and local clips into looping GIFs or animated WebP stickers. Conversion takes place on the device. The Cloudflare Pages resolver returns public video URLs, and the browser fetches those clips directly from X.

## Run locally

Use Node.js 22.12 or later.

```sh
npm ci
npm run dev:worker
```

In a second terminal, run `npm run dev` and open the Vite URL. The local video picker also works with only the frontend running.

## Deploy

1. Run `npx wrangler login` and select the Cloudflare account that owns the xgif Pages project. Verify with `npx wrangler whoami`.
2. Set `ALLOWED_ORIGIN` in `worker/pages/wrangler.jsonc` to the GitHub Pages origin (scheme and hostname, without the repo path). Run `npm run deploy:resolver`. The production resolver is `https://xgif-api.pages.dev/api/resolve`.
3. Set the GitHub Actions repository variable `VITE_RESOLVER_URL` to the resolver URL. In **Settings → Pages**, set the source to **GitHub Actions**.
4. Push to `main` or run the Pages workflow manually. With an unset resolver URL, the deployed site can still convert local files.

## Sharing and compatibility

- **Share** appears where the device can hand the output file to its native share menu. **Copy** appears where the clipboard supports the exact animated file type. **Save** is available on all supported browsers.
- WebP stickers use a 512 × 512 transparent canvas and stay within WhatsApp’s 500 KB size limit. xgif checks for timed animation frames before offering a sticker file. To send one as a native WhatsApp sticker, import the generated WebP using a compatible sticker app.
- The browser loads the pinned [single-threaded FFmpeg engine](https://github.com/ffmpegwasm/ffmpeg.wasm) from jsDelivr on the first conversion (roughly 32 MB uncompressed). Source clips are limited to 40 MiB and outputs to 10 seconds.
- X lookup relies on its public embed endpoint, which can change or omit media. The local picker accepts a video without uploading it.

`npm test` checks the resolver and animated WebP validation. `npm run build` creates the static site in `dist/`.
