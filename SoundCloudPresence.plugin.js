/**
 * @name SoundCloudPresence
 * @author Joao
 * @description Shows your current track on Discord, with SoundCloud artwork and a link when a match is found.
 * @version 1.0.0
 */

const fs = require("fs");
const path = require("path");

const NAME = "SoundCloudPresence";
const LEGACY = "LastFMRichPresence";
const POLL_MS = 5_000;
const REQUEST_MS = 6_000;
const LOOKUP_RETRY_MS = 120_000;
const stateFile = path.join(__dirname, "..", "lastfm-rpc", "activity.json");
const temporaryFile = path.join(path.dirname(stateFile), "soundcloud-presence.tmp");

const MESSAGES = {
    disabled: "Plugin is disabled.",
    clearError: "Could not clear Rich Presence. The bridge will expire the last update.",
    legacyActive: "Disable LastFMRichPresence to free up the bridge.",
    credentials: "Enter your Last.fm username and API key.",
    idle: "Last.fm has not detected a track yet. Play a track and check your Web Scrobbler connection.",
    lastfmError: "Last.fm did not return any tracks. Check your username and API key.",
    publicError: "SoundCloud public search returned no data.",
    publicSearch: "SoundCloud public search",
    listen: "Listen on SoundCloud",
    artFound: "Found SoundCloud artwork and link.",
    linkFound: "Found a SoundCloud link. The track has no artwork there.",
    noMatch: "SoundCloud search found no unique match.",
    published: "Sent to the bridge",
    bridgeError: "Could not write to the local bridge. Check the lastfm-rpc folder.",
    connectTitle: "1. Connect SoundCloud to Last.fm",
    connectHelp: "Install the Web Scrobbler browser extension. Open it, select Last.fm, and authorize the connection. Play a SoundCloud track and check that it appears as currently playing on your Last.fm profile.",
    install: "Install Web Scrobbler ↗",
    openLastfm: "Open Last.fm ↗",
    setupTitle: "2. Set up Last.fm",
    setupHelp: "Create an API key using the account you connected to Web Scrobbler. Enter your username and API key, then click Save settings.",
    createKey: "Create a Last.fm API key ↗",
    username: "Last.fm username",
    usernameHint: "Enter your username",
    apiKey: "Last.fm API key",
    apiKeyHint: "Paste your API key",
    save: "Save settings",
    saved: "Settings saved.",
    http: service => `${service} returned HTTP `,
    timeout: service => `${service} request timed out.`,
    requestError: service => `${service} request failed.`
};

function httpsURL(value, hosts) {
    try {
        const url = new URL(value);
        if (url.protocol === "https:" && !url.username && !url.password &&
            (!hosts || hosts.includes(url.hostname))) return url.href;
    } catch {
        return undefined;
    }
}

function normalize(value) {
    return String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

async function request(url, parentSignal, service, format) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    parentSignal.addEventListener("abort", abort, { once: true });
    if (parentSignal.aborted) abort();
    const timeout = setTimeout(abort, REQUEST_MS);
    const httpError = MESSAGES.http(service);
    try {
        const response = await BdApi.Net.fetch(url, {
            signal: controller.signal,
            redirect: "error"
        });
        if (!response.ok) throw new Error(`${httpError}${response.status}.`);
        return await response[format]();
    } catch (error) {
        if (controller.signal.aborted) throw new Error(MESSAGES.timeout(service));
        if (error.message?.startsWith(httpError)) throw error;
        throw new Error(MESSAGES.requestError(service));
    } finally {
        clearTimeout(timeout);
        parentSignal.removeEventListener("abort", abort);
    }
}

function loadLegacySettings() {
    try {
        const file = path.join(__dirname, `${LEGACY}.config.json`);
        const { settings } = JSON.parse(fs.readFileSync(file, "utf8"));
        return {
            username: settings.lastFMNickname?.trim() ?? "",
            lastfmKey: settings.lastFMKey?.trim() ?? ""
        };
    } catch {
        return {};
    }
}

module.exports = class SoundCloudPresence {
    constructor() {
        this.settings = BdApi.Data.load(NAME, "settings") ?? loadLegacySettings();
        this.status = MESSAGES.disabled;
    }

    start() {
        this.stop();
        this.session = new AbortController();
        void this.poll(this.session);
    }

    stop() {
        this.session?.abort();
        this.session = undefined;
        clearTimeout(this.timer);
        try {
            if (this.hasActivity && !BdApi.Plugins.isEnabled(LEGACY)) this.publish(null);
        } catch {
            this.setStatus(MESSAGES.clearError);
            return;
        } finally {
            this.hasActivity = false;
            this.currentTrack = undefined;
        }
        this.setStatus(MESSAGES.disabled);
    }

    setStatus(message) {
        this.status = message;
        if (this.statusElement) this.statusElement.textContent = message;
    }

    publish(activity) {
        if (!activity && !this.hasActivity) return;
        fs.writeFileSync(temporaryFile, JSON.stringify({ activity, updatedAt: Date.now() }), {
            mode: 0o600
        });
        fs.renameSync(temporaryFile, stateFile);
        this.hasActivity = Boolean(activity);
    }

    async getTrack(signal) {
        const params = new URLSearchParams({
            method: "user.getRecentTracks",
            user: this.settings.username,
            api_key: this.settings.lastfmKey,
            limit: "1",
            format: "json"
        });
        const data = await request(
            `https://ws.audioscrobbler.com/2.0/?${params}`, signal, "Last.fm", "json"
        );
        if (data.error || !Array.isArray(data.recenttracks?.track)) {
            throw new Error(MESSAGES.lastfmError);
        }
        const track = data.recenttracks.track[0];
        return track?.["@attr"]?.nowplaying === "true" && track.name?.trim() ? track : null;
    }

    async getPublicSoundCloudTracks(title, signal) {
        const params = new URLSearchParams({ q: title });
        const html = await request(`https://m.soundcloud.com/search/sounds?${params}`,
            signal, MESSAGES.publicSearch, "text");
        const payload = /<script\b[^>]*\bid="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i.exec(html);
        const entities = payload && JSON.parse(payload[1])?.props?.pageProps?.initialStoreState?.entities;
        if (!entities?.tracks) throw new Error(MESSAGES.publicError);
        return Object.values(entities.tracks).flatMap(({ data }) => {
            if (!data) return [];
            const user = typeof data.user === "string"
                ? entities.users?.[data.user]?.data
                : data.user;
            return [{ ...data, user }];
        });
    }

    findSoundCloudMatch(results, title, artist) {
        const comparableTitle = value => normalize(value)
            .replace(/\[\s*spotify\s*\]/g, " ")
            .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
        const normalizedTitle = comparableTitle(title);
        const artists = new Set([normalize(artist), ...artist.split(/[,;]/).map(normalize)]);
        artists.delete("");
        const combinedTitles = new Set([
            comparableTitle(`${artist} ${title}`),
            comparableTitle(`${title} ${artist}`)
        ]);
        const creditedMatches = new Map();
        const combinedMatches = new Map();
        const abbreviatedMatches = new Map();
        const canBeAbbreviated = normalizedTitle.split(" ").length >= 3;
        for (const item of results) {
            const url = httpsURL(item.permalink_url, ["soundcloud.com", "www.soundcloud.com"]);
            if (!url) continue;
            const candidateTitle = comparableTitle(item.title);
            const credited = [item.metadata_artist, item.user?.username, item.publisher_metadata?.artist].some(
                    name => artists.has(normalize(name))
                );
            const match = {
                url,
                artwork: httpsURL(item.artwork_url),
                avatar: httpsURL(item.user?.avatar_url)
            };
            if (credited && candidateTitle === normalizedTitle) {
                creditedMatches.set(url, match);
            } else if (combinedTitles.has(candidateTitle)) {
                combinedMatches.set(url, match);
            } else if (credited && canBeAbbreviated &&
                ` ${candidateTitle} `.includes(` ${normalizedTitle} `)) {
                abbreviatedMatches.set(url, match);
            }
        }
        const matches = [creditedMatches, combinedMatches, abbreviatedMatches].find(group => group.size);
        return matches?.size === 1 ? matches.values().next().value : undefined;
    }

    async getSoundCloudMatch(track, artist, signal) {
        if (!artist) return undefined;
        const tracks = await this.getPublicSoundCloudTracks(track.name, signal);
        return this.findSoundCloudMatch(tracks, track.name, artist);
    }

    active(session) {
        return this.session === session && !session.signal.aborted &&
            !BdApi.Plugins.isEnabled(LEGACY);
    }

    async poll(session) {
        try {
            if (BdApi.Plugins.isEnabled(LEGACY)) {
                this.hasActivity = false;
                this.currentTrack = undefined;
                this.setStatus(MESSAGES.legacyActive);
                return;
            }
            if (!this.settings.username || !this.settings.lastfmKey) {
                this.setStatus(MESSAGES.credentials);
                return;
            }
            const track = await this.getTrack(session.signal);
            if (!this.active(session)) return;
            if (!track) {
                this.publish(null);
                this.currentTrack = undefined;
                this.setStatus(MESSAGES.idle);
                return;
            }

            const artist = track.artist?.["#text"]?.trim() ?? "";
            const key = JSON.stringify([normalize(track.name), normalize(artist)]);
            if (this.currentTrack?.key !== key) {
                this.currentTrack = { key, start: Math.floor(Date.now() / 1000), retryAt: 0 };
            }
            const current = this.currentTrack;
            if (Date.now() >= current.retryAt) {
                current.retryAt = Infinity;
                try {
                    current.match = await this.getSoundCloudMatch(track, artist, session.signal);
                    current.lookupError = undefined;
                } catch (error) {
                    current.lookupError = error.message;
                    current.retryAt = Date.now() + LOOKUP_RETRY_MS;
                }
            }
            if (!this.active(session)) return;

            const match = current.match;
            const artwork = match?.artwork ||
                track.image?.map(image => httpsURL(image["#text"])).filter(Boolean).at(-1) ||
                match?.avatar;
            this.publish({
                type: 2,
                details: track.name.trim().slice(0, 128),
                state: artist.slice(0, 128) || undefined,
                timestamps: { start: current.start },
                assets: artwork || match ? {
                    large_image: artwork,
                    small_image: match ? "soundcloud" : undefined,
                    small_text: match ? "SoundCloud" : undefined
                } : undefined,
                buttons: match ? [{ label: MESSAGES.listen, url: match.url }] : undefined
            });
            let cloudStatus = current.lookupError;
            if (!cloudStatus) {
                if (match) {
                    cloudStatus = match.artwork ? MESSAGES.artFound :
                        MESSAGES.linkFound;
                } else {
                    cloudStatus = MESSAGES.noMatch;
                }
            }
            this.setStatus(`${MESSAGES.published}: ${track.name}${artist ? ` — ${artist}` : ""}. ${cloudStatus}`);
        } catch (error) {
            if (!this.active(session)) return;
            if (error.code) {
                this.setStatus(MESSAGES.bridgeError);
            } else {
                this.setStatus(error.message);
            }
        } finally {
            if (this.session === session) {
                this.timer = setTimeout(() => void this.poll(session), POLL_MS);
            }
        }
    }

    getSettingsPanel() {
        const panel = document.createElement("form");
        const inputStyles = document.createElement("style");
        inputStyles.textContent = `
            .soundcloud-presence-input {
                box-sizing: border-box;
                width: 100%;
                min-height: 42px;
                padding: 10px 12px;
                border: 1px solid var(--text-muted, #949ba4);
                border-radius: 6px;
                background-color: #24252b;
                background-color: color-mix(in srgb, var(--background-primary, #36373e) 72%, black);
                color: var(--text-normal, #f2f3f5);
                font: inherit;
                font-weight: 400;
                cursor: text;
            }
            .soundcloud-presence-input::placeholder {
                color: var(--text-muted, #949ba4);
            }
            .soundcloud-presence-input:focus {
                border-color: var(--text-link, #72aeff);
                outline: 2px solid var(--text-link, #72aeff);
                outline-offset: 2px;
            }
        `;
        panel.append(inputStyles);
        panel.style.cssText = "display:grid;gap:12px;color:var(--text-normal);max-width:560px";
        const status = document.createElement("p");
        status.setAttribute("role", "status");
        status.style.cssText = "margin:0;padding:12px;border-radius:8px;background:var(--background-secondary);line-height:1.45";
        status.textContent = this.status;
        this.statusElement = status;
        panel.append(status);

        function section(title, text, links = []) {
            const card = document.createElement("section");
            card.style.cssText = "display:grid;gap:8px;padding:14px;border:1px solid var(--background-modifier-accent);border-radius:8px";
            const heading = document.createElement("h3");
            heading.style.cssText = "margin:0;font-size:16px;font-weight:600;color:var(--header-primary)";
            heading.textContent = title;
            const description = document.createElement("p");
            description.style.cssText = "margin:0;line-height:1.45;color:var(--text-muted)";
            description.textContent = text;
            card.append(heading, description);
            const actions = document.createElement("div");
            actions.style.cssText = "display:flex;flex-wrap:wrap;gap:8px 16px";
            for (const [label, url] of links) {
                const link = document.createElement("a");
                link.textContent = label;
                link.href = url;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.style.cssText = "color:var(--text-link);text-decoration:underline";
                actions.append(link);
            }
            if (links.length) card.append(actions);
            panel.append(card);
            return card;
        }

        section(MESSAGES.connectTitle,
            MESSAGES.connectHelp,
            [[MESSAGES.install, "https://webscrobbler.com/"], [MESSAGES.openLastfm, "https://www.last.fm/"]]);

        const lastfm = section(MESSAGES.setupTitle,
            MESSAGES.setupHelp,
            [[MESSAGES.createKey, "https://www.last.fm/api/account/create"]]);

        const fields = {};
        for (const [key, label, type, placeholder] of [
            ["username", MESSAGES.username, "text", MESSAGES.usernameHint],
            ["lastfmKey", MESSAGES.apiKey, "password", MESSAGES.apiKeyHint]
        ]) {
            const row = document.createElement("label");
            row.style.cssText = "display:grid;gap:6px;margin-top:4px;font-weight:500";
            const input = document.createElement("input");
            input.type = type;
            input.value = this.settings[key] ?? "";
            input.autocomplete = "off";
            input.spellcheck = false;
            input.className = "soundcloud-presence-input";
            input.placeholder = placeholder;
            fields[key] = input;
            row.append(label, input);
            lastfm.append(row);
        }

        const save = document.createElement("button");
        save.type = "submit";
        save.textContent = MESSAGES.save;
        save.style.cssText = "padding:8px 14px;border-radius:5px;background:var(--brand-500);color:white;font-weight:600;cursor:pointer";
        panel.onsubmit = event => {
            event.preventDefault();
            this.settings = {
                username: fields.username.value.trim(),
                lastfmKey: fields.lastfmKey.value.trim()
            };
            BdApi.Data.save(NAME, "settings", this.settings);
            if (this.session) this.start();
            else this.setStatus(MESSAGES.disabled);
            BdApi.UI.showToast(MESSAGES.saved, { type: "success" });
        };
        panel.append(save);
        save.style.justifySelf = "end";
        return panel;
    }
};
