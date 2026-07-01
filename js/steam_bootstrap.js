// Steam Overlay bootstrap for NW.js/RPG Maker MV.
// Load this before Pixi/WebGL so Steam can hook the renderer during development.
(function () {
    "use strict";

    var bridge = window.KNH_SteamBridge = window.KNH_SteamBridge || {};
    bridge.appId = bridge.appId || 0;
    bridge.greenworks = bridge.greenworks || null;
    bridge.initialized = !!bridge.initialized;
    bridge.loadError = bridge.loadError || null;
    bridge.initError = bridge.initError || null;

    function readAppIdFromFile() {
        if (typeof require !== "function") return 0;
        try {
            var fs = require("fs");
            var path = require("path");
            var root = typeof process !== "undefined" && process.cwd ? process.cwd() : ".";
            var text = fs.readFileSync(path.join(root, "steam_appid.txt"), "utf8");
            return Number(String(text || "").trim()) || 0;
        } catch (e) {
            return 0;
        }
    }

    function loadGreenworks() {
        if (typeof require !== "function") return null;
        try {
            return require("./greenworks");
        } catch (e1) {
            try {
                return require("greenworks");
            } catch (e2) {
                bridge.loadError = e2 && e2.message ? e2.message : String(e2);
                return null;
            }
        }
    }

    if (!bridge.appId) {
        bridge.appId = readAppIdFromFile();
    }

    if (!bridge.greenworks) {
        bridge.greenworks = loadGreenworks();
    }

    if (bridge.greenworks && !bridge.initialized) {
        try {
            bridge.initialized = bridge.greenworks.initAPI
                ? !!bridge.greenworks.initAPI()
                : !!bridge.greenworks.init();
        } catch (e) {
            bridge.initError = e && e.message ? e.message : String(e);
            bridge.initialized = false;
        }
    }
})();
