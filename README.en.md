![SoundCloudPresence — Rich Presence for Discord](assets/banner.png)

# SoundCloudPresence

[Português (Brasil)](README.md)

Show what you’re listening to on SoundCloud in your Discord profile. The plugin displays the track and artist and adds the artwork and a **Listen on SoundCloud** button when it finds a match in SoundCloud’s public search.

## Requirements

- macOS, the Discord desktop app with [BetterDiscord](https://betterdiscord.app/), and [Node.js](https://nodejs.org/) 22 or later.
- A Last.fm account, a [Last.fm API key](https://www.last.fm/api/account/create), and the [Web Scrobbler](https://webscrobbler.com/) browser extension.
- A [Discord Application ID](https://discord.com/developers/applications) to identify your activity.

## Installation

1. Open Web Scrobbler in your browser and authorize your Last.fm account. Play a track on SoundCloud and check that it appears as currently playing on your Last.fm profile.
2. Download the repository. In Discord, go to **Settings → BetterDiscord → Plugins → Open Plugin Folder** and copy [SoundCloudPresence.plugin.js](SoundCloudPresence.plugin.js) into that folder.
3. Create an application in the [Discord Developer Portal](https://discord.com/developers/applications) and copy its **Application ID** from **General Information**. The application name appears in the activity heading. For the small SoundCloud badge, add an asset named `soundcloud` under **Rich Presence → Art Assets**.
4. Open a terminal in the downloaded folder and run the command below with your application ID. Keep the terminal open while using the plugin.

   ```sh
   node bridge.cjs YOUR_APPLICATION_ID
   ```

5. Enable **SoundCloudPresence** in BetterDiscord. Open its settings, enter your Last.fm username and API key, and click **Save settings**. If needed, enable activity sharing under **Settings → Activity Privacy**.

## How it works

Web Scrobbler sends browser playback to Last.fm. The plugin waits five seconds between checks and uses SoundCloud’s public search for the artwork and link. The bridge forwards the activity to the Discord desktop client over Rich Presence. Public search needs no SoundCloud token, and the bridge only needs the Discord Application ID.

If a track appears without artwork, the upload may have no artwork or the search may have returned ambiguous results. Other services connected to your Last.fm account can also appear in your presence.

## License

[MIT](LICENSE)
