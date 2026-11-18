![SoundCloudPresence — Rich Presence for Discord](assets/banner.png)

# SoundCloudPresence

[Português (Brasil)](README.md)

Show what you’re listening to on SoundCloud in your Discord profile. The plugin displays the track and artist and adds the artwork and a **Listen on SoundCloud** button when it finds a match in SoundCloud’s public search.

## Requirements

- Windows or macOS, the Discord desktop app with [BetterDiscord](https://betterdiscord.app/), and [Node.js](https://nodejs.org/) 22 or later.
- A Last.fm account, a [Last.fm API key](https://www.last.fm/api/account/create), and the [Web Scrobbler](https://webscrobbler.com/) browser extension.

## Installation

1. Open Web Scrobbler in your browser and authorize your Last.fm account. Play a track on SoundCloud and check that it appears as currently playing on your Last.fm profile.
2. Download the repository. In Discord, go to **Settings → BetterDiscord → Plugins → Open Plugin Folder** and copy [SoundCloudPresence.plugin.js](SoundCloudPresence.plugin.js) into that folder.
3. Open PowerShell (Windows) or Terminal (macOS) in the downloaded folder and run the bridge. Keep the terminal open while using the plugin.

   ```text
   node bridge.cjs
   ```

4. Enable **SoundCloudPresence** in BetterDiscord. Open its settings, enter your Last.fm username and API key, and click **Save settings**. If needed, enable activity sharing under **Settings → Activity Privacy**.

To open the plugin folder directly, use `%APPDATA%\BetterDiscord\plugins` on Windows or `~/Library/Application Support/BetterDiscord/plugins` on macOS.

## How it works

Web Scrobbler sends browser playback to Last.fm. The plugin waits five seconds between checks and uses SoundCloud’s public search for the artwork and link. The bridge forwards the activity to the Discord desktop client over Rich Presence. The bridge uses the project’s shared Discord application with the SoundCloud badge already configured. Public search needs no SoundCloud token.

If a track appears without artwork, the upload may have no artwork or the search may have returned ambiguous results. Other services connected to your Last.fm account can also appear in your presence.

## What the command runs

The `node bridge.cjs` command runs the [bridge file](bridge.cjs) included in this repository. The bridge uses Node.js built-in modules, reads the activity written locally by the plugin, and sends it to the Discord desktop client over local IPC. It installs no packages, requires no administrator privileges, and uses no Discord account token. You can inspect the file before running it and stop it with **Ctrl+C**.

The plugin contacts Last.fm and SoundCloud separately to fetch the track and artwork. Your Last.fm API key stays in BetterDiscord’s local configuration.

## License

The source is available under the [MIT License with Commons Clause 1.0](LICENSE). You may use, modify, and redistribute the project for free while preserving the license notices. The license restricts sale of the software as defined by the Commons Clause. Versions previously released under MIT remain under that license.
