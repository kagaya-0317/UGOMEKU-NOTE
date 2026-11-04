/*:
 * @plugindesc Frozen character afterimages with the game's diagonal mask fade.
 * @author kagaya
 *
 * @help
 * Load after KNH_ZXC_System, KNH_ZXC_Battle and character graphic plugins.
 *
 * Map characters:
 *   $gamePlayer.startAfterimage();
 *   this.character(0).startAfterimage({ interval: 3, life: 18, startStage: 2 });
 *   $gamePlayer.stopAfterimage();   // Stop emitting; existing images fade out.
 *   $gamePlayer.clearAfterimages(); // Remove existing images immediately.
 *
 * Battle actors/enemies use the same API on their Game_Battler, or on their
 * Sprite_NewBattler. Example: $gameActors.actor(1).startAfterimage();
 *
 * Options (times are scene updates):
 *   interval: 3, life: 18, startStage: 2, maxCount: 8,
 *   movingOnly: true, minDistance: 1, teleportDistance: 192
 * minDistance and teleportDistance are in map/battle pixels. Zero disables
 * teleport clearing. Camera motion does not count as character movement.
 *
 * Afterimages keep full opacity. The nine fadeWhite mask stages erase their
 * pixels over their lifetime. startStage (0..7) controls the initial hatching;
 * larger values start with more pixels removed. Old opacity options are ignored.
 * Mask bitmaps are shared with the existing character mask fade.
 *
 * The captured pose stays frozen. Child weapons and body meshes are included;
 * particles and state icons are excluded. Set _knhAfterimageExclude = true
 * on other display objects that should not appear in an afterimage.
 * Settings can be saved; textures and sprites belong only to the scene.
 */
(function() {
    'use strict';

    var API = window.KNH_Afterimage = window.KNH_Afterimage || {};
    var MAX_ACTIVE = 128;
    var MAX_POOL = 16;
    var MAX_POOL_PIXELS = 2097152;
    var MAX_TEXTURE_SIZE = 2048;

    // Preserve the existing character fade's cell sampling and alpha inversion.
    // These nine immutable bitmaps are shared by all characters and afterimages.
    var HatchMask = API.HatchMask = {
        bitmaps: [],
        source: null,
        ready: function() {
            if (!this.source) this.source = ImageManager.loadSystem('fadeWhite');
            return this.source.isReady();
        },
        bitmap: function(stage) {
            if (!this.ready()) return null;
            stage = Math.round(number(stage, 0, 0, 8));
            if (this.bitmaps[stage]) return this.bitmaps[stage];
            var source = this.source;
            var width = Math.floor(source.width / 3), height = Math.floor(source.height / 3);
            if (width <= 0 || height <= 0) return null;
            var bitmap = new Bitmap(width, height);
            bitmap._context.imageSmoothingEnabled = false;
            bitmap.blt(source, stage % 3 * width, Math.floor(stage / 3) * height,
                width, height, 0, 0, width * 2, height * 2);
            var pixels = bitmap._context.getImageData(0, 0, width, height);
            for (var i = 0; i < pixels.data.length; i += 4) {
                pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 255;
                pixels.data[i + 3] = 255 - pixels.data[i + 3];
            }
            bitmap._context.putImageData(pixels, 0, 0);
            bitmap._setDirty();
            // These sprites are masks, so the regular Sprite render path will
            // not upload a dirty bitmap for us.
            bitmap.checkDirty();
            this.bitmaps[stage] = bitmap;
            return bitmap;
        },
        apply: function(target, rect, stage) {
            var bitmap = this.bitmap(stage);
            if (!bitmap) return false;
            var mask = target._knhAfterimageMask;
            if (!mask) {
                mask = target._knhAfterimageMask = new Sprite();
                target.addChild(mask);
            }
            if (mask.bitmap !== bitmap) mask.bitmap = bitmap;
            mask.position.set(rect.x, rect.y);
            mask.scale.set(rect.width / bitmap.width, rect.height / bitmap.height);
            mask.visible = true;
            target.mask = mask;
            mask.renderable = false;
            return true;
        },
        clear: function(target) {
            var mask = target._knhAfterimageMask;
            if (!mask) return;
            if (target.mask === mask) target.mask = null;
            mask.visible = false;
            mask.renderable = false;
        }
    };

    // Keep the character fade's timing and placement, while sharing its image
    // cache and guaranteed texture upload with the new afterimage fade.
    Sprite_Character.prototype._getMaskFadeBitmap = function(index) {
        this._maskFadeBitmaps = HatchMask.bitmaps;
        return HatchMask.bitmap(index);
    };

    function number(value, fallback, min, max) {
        var n = Number(value == null ? fallback : value);
        if (!isFinite(n)) n = fallback;
        return Math.max(min, Math.min(max, n));
    }

    function options(value) {
        var v = value || {};
        return {
            enabled: true,
            interval: Math.round(number(v.interval, 3, 1, 600)),
            life: Math.round(number(v.life, 18, 1, 600)),
            startStage: Math.round(number(v.startStage, 2, 0, 7)),
            maxCount: Math.round(number(v.maxCount, 8, 1, 64)),
            movingOnly: v.movingOnly !== false,
            minDistance: number(v.minDistance, 1, 0, 99999),
            teleportDistance: number(v.teleportDistance, 192, 0, 99999)
        };
    }

    function currentManager(create) {
        var scene = SceneManager._scene;
        if (!scene) return null;
        if (!scene._knhAfterimageManager && create) {
            scene._knhAfterimageManager = new AfterimageManager(scene);
        }
        return scene._knhAfterimageManager || null;
    }

    function startAfterimage(value) {
        this._knhAfterimage = options(value);
        return this;
    }

    function stopAfterimage() {
        if (this._knhAfterimage) this._knhAfterimage.enabled = false;
        return this;
    }

    function clearAfterimages() {
        var manager = currentManager(false);
        if (manager) manager.clearOwner(this);
        return this;
    }

    function installOwner(prototype) {
        prototype.startAfterimage = startAfterimage;
        prototype.stopAfterimage = stopAfterimage;
        prototype.clearAfterimages = clearAfterimages;
    }

    installOwner(Game_CharacterBase.prototype);
    installOwner(Game_BattlerBase.prototype);

    function touch(source, owner, map) {
        if (!owner || !owner._knhAfterimage || !owner._knhAfterimage.enabled || !source.parent) return;
        currentManager(true).touch(source, owner, map);
    }

    var characterUpdate = Sprite_Character.prototype.update;
    Sprite_Character.prototype.update = function() {
        characterUpdate.apply(this, arguments);
        touch(this, this._character, true);
    };

    if (typeof Sprite_NewBattler !== 'undefined') {
        var battlerUpdate = Sprite_NewBattler.prototype.update;
        Sprite_NewBattler.prototype.update = function() {
            battlerUpdate.apply(this, arguments);
            touch(this, this._battler, false);
        };
        ['startAfterimage', 'stopAfterimage', 'clearAfterimages'].forEach(function(name) {
            Sprite_NewBattler.prototype[name] = function(value) {
                if (this._battler) this._battler[name](value);
                return this;
            };
        });
    }

    function AfterimageManager(scene) {
        this.scene = scene;
        this.entries = new Map();
        this.trails = [];
        this.pool = [];
        this.spritePool = [];
        this.dirtyParents = [];
        this.poolPixels = 0;
        this.serial = 0;
        this.mapId = $gameMap ? $gameMap.mapId() : 0;
        this.captureTransform = new PIXI.Transform();
        this.captureMatrix = new PIXI.Matrix();
        HatchMask.ready();
    }

    AfterimageManager.prototype.touch = function(source, owner, map) {
        var entry = this.entries.get(source);
        if (!entry) {
            entry = { source: source, owner: owner, map: map, count: 0 };
            this.entries.set(source, entry);
        }
    };

    AfterimageManager.prototype.position = function(entry) {
        var c = entry.owner, s = entry.source;
        if (entry.map) return { x: c._realX, y: c._realY };
        return { x: s.x, y: s.y };
    };

    AfterimageManager.prototype.distance = function(entry, a, b) {
        var dx = a.x - b.x, dy = a.y - b.y;
        if (entry.map) {
            dx = $gameMap.deltaX(a.x, b.x) * $gameMap.tileWidth();
            dy = $gameMap.deltaY(a.y, b.y) * $gameMap.tileHeight();
        }
        return Math.sqrt(dx * dx + dy * dy);
    };

    AfterimageManager.prototype.update = function() {
        if (this.disposed) return;
        if (this.mapId !== ($gameMap ? $gameMap.mapId() : 0)) {
            this.clear();
            this.mapId = $gameMap ? $gameMap.mapId() : 0;
        }
        if ($gameSwitches && $gameSwitches.value(1)) return;

        for (var i = this.trails.length - 1; i >= 0; i--) {
            var trail = this.trails[i];
            trail.age++;
            if (trail.age >= trail.life || !trail.sprite.parent) {
                this.release(i);
            } else {
                this.updateMask(trail);
                this.place(trail);
            }
        }

        this.entries.forEach(function(entry, source) {
            var config = entry.owner._knhAfterimage;
            if (!config || !config.enabled || source._destroyed || entry.owner._erased) {
                if (!entry.count) this.entries.delete(source);
                entry.lastPosition = null;
                return;
            }
            if (!source.parent || !source.worldVisible || source.alpha <= 0 || !source.renderable) {
                entry.lastPosition = null;
                if (!entry.count) this.entries.delete(source);
                return;
            }
            var pos = this.position(entry);
            if (entry.config !== config || !entry.lastPosition) {
                entry.config = config;
                entry.lastPosition = pos;
                entry.ticks = config.interval;
                entry.distance = 0;
            }
            var moved = this.distance(entry, pos, entry.lastPosition);
            entry.lastPosition = pos;
            if (config.teleportDistance > 0 && moved > config.teleportDistance) {
                this.clearEntry(entry);
                entry.distance = 0;
                entry.ticks = 0;
                return;
            }
            entry.distance += moved;
            entry.ticks++;
            if (entry.ticks < config.interval) return;
            if (config.movingOnly && (moved < 0.0001 || entry.distance < config.minDistance)) return;
            entry.ticks = 0;
            entry.distance = 0;
            this.emit(entry, config, pos);
        }, this);
        this.dirtyParents.forEach(function(parent) {
            parent.children.sort(Tilemap.prototype._compareChildOrder.bind(parent));
        });
        this.dirtyParents.length = 0;
    };

    // The origin remains the character's origin, so texture padding and bounds
    // never change the foot position used by the game's depth comparator.
    AfterimageManager.prototype.place = function(trail) {
        var s = trail.sprite;
        if (trail.map) {
            s.x = trail.absoluteX ? trail.x : $gameMap.adjustX(trail.x) * $gameMap.tileWidth() + trail.offsetX;
            s.y = trail.absoluteY ? trail.y : $gameMap.adjustY(trail.y) * $gameMap.tileHeight() + trail.offsetY;
        }
    };

    AfterimageManager.prototype.updateMask = function(trail) {
        var stage = Math.min(8, trail.startStage + Math.floor((9 - trail.startStage) * trail.age / trail.life));
        if (stage === trail.stage) return;
        if (HatchMask.apply(trail.sprite, trail.maskRect, stage)) {
            trail.stage = stage;
            trail.sprite.visible = stage < 8;
        }
    };

    AfterimageManager.prototype.emit = function(entry, config, pos) {
        if (!HatchMask.ready()) return;
        var source = entry.source;
        var captured;
        try {
            captured = this.capture(source);
        } catch (error) {
            if (!entry.captureError) console.warn('KNH_Afterimage: capture failed', error);
            entry.captureError = true;
            return;
        }
        if (!captured) return;
        entry.captureError = false;
        while (entry.count >= config.maxCount) {
            var index = this.trails.findIndex(function(t) { return t.entry === entry; });
            if (index < 0) break;
            this.release(index);
        }
        while (this.trails.length >= MAX_ACTIVE) this.release(0);

        var sprite = this.spritePool.pop() || new PIXI.Sprite();
        sprite.texture = captured.texture;
        sprite.anchor.set(-captured.x / captured.texture.width, -captured.y / captured.texture.height);
        sprite.position.copy(source.position);
        sprite.scale.copy(source.scale);
        sprite.pivot.copy(source.pivot);
        sprite.skew.copy(source.skew);
        sprite.rotation = source.rotation;
        sprite.blendMode = source.blendMode;
        sprite.z = source.z || 0;
        sprite.spriteId = (source.spriteId || 0) - 0.5 + (++this.serial / (this.serial + 1)) * 0.25;
        sprite._jumpOffsetY = source._jumpOffsetY || 0;
        sprite._floatHeight = source._floatHeight || 0;
        sprite._knhAfterimageSprite = true;
        var trail = {
            entry: entry, sprite: sprite, texture: captured.texture,
            age: 0, life: config.life, startStage: Math.round(number(config.startStage, 2, 0, 7)),
            maskRect: { x: captured.x, y: captured.y, width: captured.texture.width, height: captured.texture.height },
            map: entry.map, x: pos.x, y: pos.y
        };
        sprite.alpha = 1;
        this.updateMask(trail);
        if (entry.map) {
            var c = entry.owner;
            trail.absoluteX = c.absoluteX && c.absoluteX() != null;
            trail.absoluteY = c.absoluteY && c.absoluteY() != null;
            trail.offsetX = source.x - $gameMap.adjustX(pos.x) * $gameMap.tileWidth();
            trail.offsetY = source.y - $gameMap.adjustY(pos.y) * $gameMap.tileHeight();
            if (trail.absoluteX) trail.x = source.x;
            if (trail.absoluteY) trail.y = source.y;
        }
        source.parent.addChild(sprite);
        this.trails.push(trail);
        entry.count++;
        this.place(trail);
        // Battle containers are sorted before this manager runs. Sort each
        // affected parent once, after all new siblings have been added.
        if (this.dirtyParents.indexOf(source.parent) < 0) this.dirtyParents.push(source.parent);
    };

    AfterimageManager.prototype.takeTexture = function(width, height) {
        for (var i = 0; i < this.pool.length; i++) {
            var texture = this.pool[i];
            if (texture.width === width && texture.height === height) {
                this.pool.splice(i, 1);
                this.poolPixels -= width * height;
                return texture;
            }
        }
        return PIXI.RenderTexture.create(width, height, PIXI.SCALE_MODES.NEAREST, 1);
    };

    AfterimageManager.prototype.returnTexture = function(texture) {
        var pixels = texture.width * texture.height;
        if (this.disposed || this.pool.length >= MAX_POOL || this.poolPixels + pixels > MAX_POOL_PIXELS) {
            texture.destroy(true);
        } else {
            this.pool.push(texture);
            this.poolPixels += pixels;
        }
    };

    function prepareCapture(node, hidden, areas, excluded) {
        if (node._knhAfterimageExclude || excluded.indexOf(node) >= 0) {
            hidden.push({ node: node, visible: node.visible });
            node.visible = false;
            return 0;
        }
        var padding = 0;
        if (node.filterArea) {
            areas.push({ node: node, value: node.filterArea });
            node.filterArea = null;
        }
        if (node.filters) node.filters.forEach(function(f) {
            if (f && f.enabled !== false) padding += Number(f.padding) || 0;
        });
        // Mask sprites can be non-renderable and miss the normal bitmap upload.
        if (node.mask && node.mask.bitmap && node.mask.bitmap.checkDirty) node.mask.bitmap.checkDirty();
        var childPadding = 0;
        (node.children || []).forEach(function(child) {
            childPadding = Math.max(childPadding, prepareCapture(child, hidden, areas, excluded));
        });
        return padding + childPadding;
    }

    function invalidateTransforms(node) {
        if (node.transform) node.transform._parentID = -1;
        (node.children || []).forEach(invalidateTransforms);
    }

    AfterimageManager.prototype.capture = function(source) {
        var renderer = Graphics._renderer;
        if (!renderer || renderer.gl && renderer.gl.isContextLost()) return null;
        var parent = source.parent, transform = source.transform;
        var alpha = source.alpha, blendMode = source.blendMode;
        var hidden = [], areas = [], texture = null, complete = false;
        var excluded = [source._particle, source._stateIconSprite, source._stateSprite, source._balloonSprite];
        try {
            var padding = 4 + prepareCapture(source, hidden, areas, excluded);
            source.transform = this.captureTransform;
            source.alpha = 1;
            source.blendMode = PIXI.BLEND_MODES.NORMAL;
            invalidateTransforms(source);
            var bounds = source.getLocalBounds();
            if (bounds.width <= 0 || bounds.height <= 0) return null;
            var x = Math.floor(bounds.x - padding), y = Math.floor(bounds.y - padding);
            var width = Math.ceil((bounds.width + padding * 2 + 1) / 32) * 32;
            var height = Math.ceil((bounds.height + padding * 2 + 1) / 32) * 32;
            if (width > MAX_TEXTURE_SIZE || height > MAX_TEXTURE_SIZE) return null;
            texture = this.takeTexture(width, height);
            this.captureMatrix.identity();
            this.captureMatrix.tx = -x;
            this.captureMatrix.ty = -y;
            renderer.render(source, texture, true, this.captureMatrix);
            complete = true;
            return { texture: texture, x: x, y: y };
        } finally {
            source.parent = parent;
            source.transform = transform;
            source.alpha = alpha;
            source.blendMode = blendMode;
            hidden.forEach(function(item) { item.node.visible = item.visible; });
            areas.forEach(function(item) { item.node.filterArea = item.value; });
            invalidateTransforms(source);
            if (parent) {
                source._recursivePostUpdateTransform();
                source.updateTransform();
            }
            if (texture && !complete) this.returnTexture(texture);
        }
    };

    AfterimageManager.prototype.release = function(index) {
        var trail = this.trails[index];
        this.trails.splice(index, 1);
        trail.entry.count--;
        if (trail.sprite.parent) trail.sprite.parent.removeChild(trail.sprite);
        HatchMask.clear(trail.sprite);
        trail.sprite.texture = PIXI.Texture.EMPTY;
        if (!this.disposed && this.spritePool.length < MAX_POOL) this.spritePool.push(trail.sprite);
        else trail.sprite.destroy({ children: true, texture: false, baseTexture: false });
        this.returnTexture(trail.texture);
    };

    AfterimageManager.prototype.clearEntry = function(entry) {
        for (var i = this.trails.length - 1; i >= 0; i--) {
            if (this.trails[i].entry === entry) this.release(i);
        }
    };

    AfterimageManager.prototype.clearOwner = function(owner) {
        this.entries.forEach(function(entry) {
            if (entry.owner !== owner) return;
            this.clearEntry(entry);
            entry.lastPosition = null;
        }, this);
    };

    AfterimageManager.prototype.clear = function() {
        while (this.trails.length) this.release(this.trails.length - 1);
        this.entries.clear();
        this.dirtyParents.length = 0;
    };

    AfterimageManager.prototype.dispose = function() {
        if (this.disposed) return;
        this.disposed = true;
        this.clear();
        this.pool.forEach(function(texture) { texture.destroy(true); });
        this.pool = [];
        this.spritePool.forEach(function(sprite) { sprite.destroy({ children: true, texture: false, baseTexture: false }); });
        this.spritePool = [];
        this.poolPixels = 0;
        this.scene = null;
    };

    // Capture once, after the entire scene has finished its normal update.
    // Never call source.update() here: it can advance actions and consume requests.
    var updateScene = SceneManager.updateScene;
    SceneManager.updateScene = function() {
        updateScene.apply(this, arguments);
        var manager = currentManager(false);
        if (manager) manager.update();
    };

    function disposeScene(scene) {
        if (scene._knhAfterimageManager) {
            scene._knhAfterimageManager.dispose();
            delete scene._knhAfterimageManager;
        }
    }

    var terminateScene = Scene_Base.prototype.terminate;
    Scene_Base.prototype.terminate = function() {
        disposeScene(this);
        terminateScene.apply(this, arguments);
    };

    var destroyScene = Scene_Base.prototype.destroy;
    Scene_Base.prototype.destroy = function() {
        disposeScene(this);
        destroyScene.apply(this, arguments);
    };

    var performTransfer = Game_Player.prototype.performTransfer;
    Game_Player.prototype.performTransfer = function() {
        if (this.isTransferring()) {
            var manager = currentManager(false);
            if (manager) manager.clear();
        }
        performTransfer.apply(this, arguments);
    };

    API.Manager = AfterimageManager;
    API.stats = function() {
        var manager = currentManager(false);
        return manager ? { sources: manager.entries.size, active: manager.trails.length,
            pooled: manager.pool.length, pooledSprites: manager.spritePool.length } :
            { sources: 0, active: 0, pooled: 0, pooledSprites: 0 };
    };
})();
