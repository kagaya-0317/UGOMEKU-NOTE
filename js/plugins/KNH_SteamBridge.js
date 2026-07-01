/*:
 * @plugindesc [MV] Steam bootstrap bridge for Greenworks overlay.
 * @author KNH
 *
 * @param AppId
 * @type number
 * @min 0
 * @default 0
 *
 * @param ForceRestartViaSteam
 * @type boolean
 * @on true
 * @off false
 * @default false
 *
 * @param VerboseLog
 * @type boolean
 * @on true
 * @off false
 * @default true
 *
 * @help
 * Requires Greenworks files in the game root.
 * Plugin commands:
 *   STEAM STATUS
 *   STEAM OVERLAY FRIENDS
 *   STEAM OVERLAY COMMUNITY
 *   STEAM OVERLAY PLAYERS
 *   STEAM OVERLAY SETTINGS
 *   STEAM OVERLAY OFFICIALGAMEGROUP
 *   STEAM OVERLAY STATS
 *   STEAM OVERLAY ACHIEVEMENTS
 *   STEAM WEB https://store.steampowered.com
 */
(function () {
    "use strict";

    var PLUGIN_NAME = "KNH_SteamBridge";
    var params = PluginManager.parameters(PLUGIN_NAME);
    var appId = Number(params.AppId || 0);
    var forceRestartViaSteam = String(params.ForceRestartViaSteam || "false") === "true";
    var verboseLog = String(params.VerboseLog || "true") === "true";
    var bridge = window.KNH_SteamBridge = window.KNH_SteamBridge || {};
    if (!appId && bridge.appId) {
        appId = Number(bridge.appId || 0);
    }

    function log() {
        if (!verboseLog || typeof console === "undefined" || !console.log) {
            return;
        }
        var args = Array.prototype.slice.call(arguments);
        args.unshift("[SteamBridge]");
        console.log.apply(console, args);
    }

    function warn() {
        if (typeof console === "undefined" || !console.warn) {
            return;
        }
        var args = Array.prototype.slice.call(arguments);
        args.unshift("[SteamBridge]");
        console.warn.apply(console, args);
    }

    function normalizeOverlayTarget(raw) {
        var key = String(raw || "").toUpperCase();
        var map = {
            FRIENDS: "Friends",
            COMMUNITY: "Community",
            PLAYERS: "Players",
            SETTINGS: "Settings",
            OFFICIALGAMEGROUP: "OfficialGameGroup",
            STATS: "Stats",
            ACHIEVEMENTS: "Achievements"
        };
        return map[key] || "Friends";
    }

    if (!Utils.isNwjs()) {
        return;
    }

    var greenworks = bridge.greenworks || null;
    if (!greenworks) {
        try {
            greenworks = require("./greenworks");
        } catch (e1) {
            try {
                greenworks = require("greenworks");
            } catch (e2) {
                bridge.loadError = e2 && e2.message ? e2.message : String(e2);
                warn("Failed to load greenworks.", bridge.loadError);
            }
        }
    }

    try {
        if (greenworks && forceRestartViaSteam && appId > 0 && greenworks.restartAppIfNecessary && greenworks.restartAppIfNecessary(appId)) {
            log("Restart requested via Steam.");
            if (typeof nw !== "undefined" && nw.App && nw.App.quit) {
                nw.App.quit();
            }
            return;
        }

        if (greenworks && !bridge.initialized) {
            bridge.initialized = greenworks.initAPI ? greenworks.initAPI() : greenworks.init();
        }
        if (greenworks && !bridge.initialized) {
            warn("Steam API init failed.");
        }
    } catch (e) {
        bridge.initError = e && e.message ? e.message : String(e);
        warn("Steam API init exception.", bridge.initError);
    }

    bridge.appId = appId || bridge.appId || 0;
    bridge.greenworks = greenworks;

    if (greenworks && bridge.initialized) {
        log("Steam API initialized.", "appId=", greenworks.getAppId ? greenworks.getAppId() : appId);
    }

    if (greenworks && greenworks.on) {
        greenworks.on("game-overlay-activated", function (isActive) {
            log("overlay active:", !!isActive);
        });
    }

    var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function (command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);

        if (String(command || "").toUpperCase() !== "STEAM") {
            return;
        }

        var sub = String(args[0] || "").toUpperCase();
        if (sub === "STATUS") {
            log("appId:", bridge.appId || appId || "n/a");
            log("greenworks loaded:", !!greenworks);
            log("Steam API initialized:", !!bridge.initialized);
            log("load error:", bridge.loadError || "none");
            log("init error:", bridge.initError || "none");
            log("overlay enabled:", greenworks && greenworks.isGameOverlayEnabled ? greenworks.isGameOverlayEnabled() : "n/a");
            return;
        }

        if (sub === "OVERLAY") {
            if (!greenworks || !greenworks.activateGameOverlay) {
                warn("activateGameOverlay is not available.");
                return;
            }
            greenworks.activateGameOverlay(normalizeOverlayTarget(args[1]));
            return;
        }

        if (sub === "WEB") {
            if (!greenworks || !greenworks.activateGameOverlayToWebPage) {
                warn("activateGameOverlayToWebPage is not available.");
                return;
            }
            greenworks.activateGameOverlayToWebPage(String(args[1] || "https://store.steampowered.com"));
        }
    };
})();
