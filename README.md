# xgif

I wanted to turn a clip from X into a GIF without opening a video editor. Paste a post or open a video, pick GIF or Sticker, and save it. The conversion runs in your browser.

Leave the trim length blank for the rest of the clip. Stickers stop at 10 seconds.

To run it locally, use Node 22.12+ and run `npm ci`, then `npm run dev`. Run `npm run dev:worker` in another terminal if you want X links to work.

The interface started from [Cobalt Web](https://github.com/imputnet/cobalt/tree/a636575/web). I adapted it for xgif. [Cobalt’s license](public/licenses/cobalt-web.txt) · [IBM Plex Mono’s license](public/licenses/ibm-plex-mono.txt).
