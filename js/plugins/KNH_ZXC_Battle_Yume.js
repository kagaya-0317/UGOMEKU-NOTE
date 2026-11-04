//=============================================================================
// KNH_ZXC_Battle_Yume.js
//=============================================================================

/*:
 * @plugindesc Yume's independent battle arms and gun sprites.
 * @author kagaya
 *
 * @help
 * Place this plugin after KNH_ZXC_Battle and before KNH_ZXC_SkillEditor.
 * Actor 4 uses battler sheet 003. Each skill ID owns at most one arm.
 * Multiple skills can keep their arms on screen at the same time.
 *
 * Inside a skill's <animation: ... > note:
 *   yumeArmOut:gun1,random,12,wait
 *   yumeArmMove:random,8,wait
 *   yumeArmMoveToTarget:0,-16,12,wait
 *   yumeArmWeaponAnime:attack2,16
 *   yumeArmAnimation:12,16,-4,mirror
 *   yumeArmIn:8,10
 * Out/move pose: random.
 *
 * Complete two-shot example:
 *   <animation:
 *    yumeArmOut:gun1,random,10,wait
 *    yumeArmWeaponAnime:attack2,16
 *    yumeArmAnimation:12,16,-4
 *    apply
 *    yumeArmMove:random,8,wait
 *    yumeArmWeaponAnime:attack2,16
 *    yumeArmAnimation:12,16,-4
 *    apply
 *    yumeArmIn:8,10
 *   >
 *
 * Out/move can also include local position offsets before the duration:
 *   yumeArmOut:gun1,random,12,-6,12,wait
 *   yumeArmMove:random,12,-6,8,wait
 * A newly created arm unfolds with a swaying, nearly fixed-length chain.
 * Its weapon rises past the backpack top before moving to the requested pose.
 * Only emerged links are drawn, adding joints one at a time without clipping
 * the lower backpack area.
 * Calling Out again while that skill's arm remains visible just repositions it.
 * Gun tips choose a new spot within X -80..80 and Y -120..-100 relative
 * to Yume; the optional offsets shift that range. Repeated Out or Move calls
 * reposition the existing arm. Simultaneous guns avoid each other's current
 * and destination bounds. Only if weapon bounds cannot fit may a gun use
 * an extra row up to 48px above or below the normal band. A crowded repeat
 * may move less than 24px to avoid an unnecessary jump across Yume.
 * Joints sway independently while repositioning, without stretching links much.
 * Guns aim from their selected position toward the current enemy's center.
 * Their shared backpack root may meet, but long overlapping links are avoided.
 * MoveToTarget uses the current enemy sprite's center and battle-screen pixel
 * offsets (positive X right, positive Y down):
 *   yumeArmMoveToTarget:12,wait
 *   yumeArmMoveToTarget:0,-16,12,wait
 * Its joints ease toward an evenly extended arm; the previous bends are not
 * locked in place. A distant target may make the arm almost straight.
 *
 * gun1 / attack2 uses sheet row 9. gun2 / attack3 uses row 10.
 * Rows 9 and 10 contain an arm part, two rotor frames and a barrel.
 * All cropped weapon frames attach at the center of their original 144px cell.
 * yumeArmAnimation plays a database animation at this skill's current weapon
 * attachment point. Optional X/Y offsets are in battle-screen pixels
 * (positive X is right; positive Y is down). The effect stays at the spawn
 * position; it does not follow later arm movement. Add mirror after the ID or
 * offsets to flip this effect horizontally. Use wait:N separately.
 * WeaponAnime restarts the rotor/barrel animation immediately, even if
 * its previous playback has not finished. Out also restarts it.
 * Each of the two rotor cells lasts 8 frames (16 frames total by default).
 * An explicit WeaponAnime duration still overrides that total playback time.
 * Arm joints and weapon position/rotation advance every 6 frames, plus the
 * exact ending frame. The rotor's frame animation keeps its own timing.
 * Machine plays independently for each moving arm with a slightly varied pitch,
 * and stops as soon as that arm stops moving.
 * Arm yurayura is disabled during movement or rotor frame animation and
 * resumes only when both have stopped.
 * In waits for grace frames, then retracts via the backpack top over duration frames.
 * Backpack-side joints disappear one at a time as the arm retracts.
 * A new action of the same skill cancels its pending retraction.
 */

(function() {
    'use strict';

    if (typeof Sprite_NewActor !== 'function') return;

    var NS = window.KNH_ZXC_Battle_Yume = window.KNH_ZXC_Battle_Yume || {};
    var ACTOR_ID = 4;
    var CELL = 144;
    var ROOT = { x: -9, y: -53 };
    var BACKPACK_TOP = { x: -5, y: -101 };
    var WEAPON_BACKPACK_CLEARANCE = 24;
    var ARM_BITMAP_SIZE = 224;
    var ARM_BITMAP_OFFSET = { x: 96, y: 176 };
    var MAX_ARM_BITMAP_SIZE = 1024;
    // The battle layer inherits the actor's x2 scale: two source pixels are four screen pixels.
    var OUTLINE_WIDTH = 2;
    var ARM_HALF_WIDTH = 2.08;
    var ROOT_JOINT_RADIUS = 2.85;
    var JOINT_RADIUS = 3.2;
    var NOMINAL_LINK_LENGTH = 34;
    var MOTION_STEP_FRAMES = 6;
    var WEAPON_FRAME_FRAMES = 8;
    var DEFAULT_WEAPON_DURATION = WEAPON_FRAME_FRAMES * 2;
    var ARM_YURA_INFO = [10, 8, 8, true];
    var WEAPON_CLEARANCE = 6;
    var MOVE_SE_NAME = 'Machine';
    var MOVE_SE_VOLUME = 60;
    var MOVE_SE_PITCH_MIN = 95;
    var MOVE_SE_PITCH_RANGE = 11;
    var GUN_X_MIN = -80;
    var GUN_X_MAX = 80;
    var GUN_Y_MIN = -120;
    var GUN_Y_MAX = -100;
    var REPEAT_MIN_DISTANCE = 24;
    var REPEAT_NEAR_MAX = 44;
    var REPEAT_MID_MAX = 72;
    var RANDOM_TRIES = 48;
    var CROWD_ROWS = [0, -48, 48];
    var ALTERNATE_BENDS = [
        [[0.22, -22], [0.49, 14], [0.76, -18]],
        [[0.21, -35], [0.49, -5], [0.75, -30]],
        [[0.18, -24], [0.50, 17], [0.79, -9]]
    ];
    var FOLD = [
        { x: 0, y: 0 }, { x: 30, y: 5 }, { x: 0, y: 10 },
        { x: 30, y: 15 }, { x: 0, y: 20 }
    ];
    var RANDOM_BENDS = [[0.21, -29], [0.47, -48], [0.75, -20]];
    var WEAPONS = {
        gun1: {
            row: 8,
            rotor: { x: 66, y: 49, w: 38, h: 34 },
            barrel: { x: 67, y: 60, w: 31, h: 22 }
        },
        gun2: {
            row: 9,
            rotor: { x: 54, y: 41, w: 47, h: 39 },
            barrel: { x: 67, y: 59, w: 39, h: 23 }
        }
    };
    var COMMAND_HINTS = {
        yumeArmOut: 'gun1/gun2, random, [X offset, Y offset,] frames, [wait]',
        yumeArmMove: 'random, [X offset, Y offset,] frames, [wait]',
        yumeArmMoveToTarget: '[X offset, Y offset,] frames, [wait]',
        yumeArmWeaponAnime: 'gun1/gun2 or attack2/attack3, [frames], [wait]',
        yumeArmAnimation: 'database animation ID, [X offset, Y offset,] [mirror]',
        yumeArmIn: 'grace frames, retract frames, [wait]'
    };
    NS.actionHints = COMMAND_HINTS;
    NS.poseNames = ['random'];
    NS.outPoseNames = NS.poseNames.slice();

    function isYume(sprite) {
        return sprite && sprite._battler && sprite._battler.isActor &&
            sprite._battler.isActor() && sprite._battler.actorId() === ACTOR_ID;
    }

    function finiteNumber(value) {
        return typeof value === 'number' && Number.isFinite(value);
    }

    function nonnegativeInteger(value) {
        return finiteNumber(value) && Number.isInteger(value) && value >= 0;
    }

    function weaponName(value) {
        if (value === 'gun1' || value === 'attack2') return 'gun1';
        if (value === 'gun2' || value === 'attack3') return 'gun2';
        return null;
    }

    function copyPoints(points) {
        return points.map(function(point) { return { x: point.x, y: point.y }; });
    }

    function foldedPoints() {
        return FOLD.map(function(offset) {
            return { x: ROOT.x + offset.x, y: ROOT.y + offset.y };
        });
    }

    function turnAngle(a, joint, b) {
        var ax = joint.x - a.x, ay = joint.y - a.y;
        var bx = b.x - joint.x, by = b.y - joint.y;
        return Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
    }

    function keepBends(points, linkLength, progress) {
        var count = points.length - 1;
        var tip = points[count];
        var reach = Math.hypot(tip.x - points[0].x, tip.y - points[0].y) /
            (NOMINAL_LINK_LENGTH * count);
        // At 80% reach keep a visible corner; near full reach let the arm straighten.
        var bendStrength = Math.max(0, Math.min(1, (1 - reach) / 0.2));
        var minimumTurn = Math.PI * 2 / 9 * bendStrength * (progress === undefined ? 1 : progress);
        if (minimumTurn <= 0) return points;
        for (var pass = 0; pass < 2; pass++) {
            for (var i = 1; i < count; i++) {
                var a = points[i - 1], joint = points[i], b = points[i + 1];
                if (Math.abs(turnAngle(a, joint, b)) >= minimumTurn) continue;
                var dx = b.x - a.x, dy = b.y - a.y;
                var chord = Math.hypot(dx, dy);
                if (chord < 0.001) continue;
                var nx = -dy / chord, ny = dx / chord;
                var offset = (joint.x - a.x) * nx + (joint.y - a.y) * ny;
                var side = Math.abs(offset) > 0.001 ? Math.sign(offset) : (i % 2 ? 1 : -1);
                var moved = 0;
                var limit = Math.min(12, linkLength * 0.4);
                while (Math.abs(turnAngle(a, joint, b)) < minimumTurn && moved < limit) {
                    joint.x += side * nx * 0.5;
                    joint.y += side * ny * 0.5;
                    moved += 0.5;
                }
            }
        }
        return points;
    }

    function balanceSegmentLengths(points, bendProgress) {
        var original = copyPoints(points);
        var count = points.length - 1;
        var length = 0;
        for (var i = 0; i < count; i++) {
            length += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
        }
        var desired = length / count;
        // Keep the endpoints fixed and pull bends gently toward their authored zigzag.
        for (var pass = 0; pass < 24; pass++) {
            var forces = points.map(function() { return { x: 0, y: 0 }; });
            for (var j = 0; j < count; j++) {
                var dx = points[j + 1].x - points[j].x;
                var dy = points[j + 1].y - points[j].y;
                var current = Math.max(0.001, Math.hypot(dx, dy));
                var force = 2 * (current - desired) / current;
                forces[j].x -= force * dx;
                forces[j].y -= force * dy;
                forces[j + 1].x += force * dx;
                forces[j + 1].y += force * dy;
            }
            for (var k = 1; k < count; k++) {
                points[k].x -= 0.08 * (forces[k].x + 0.3 * (points[k].x - original[k].x));
                points[k].y -= 0.08 * (forces[k].y + 0.3 * (points[k].y - original[k].y));
            }
        }
        return keepBends(points, desired, bendProgress);
    }

    function snapArmPixels(context, bitmap, points, offset) {
        var padding = Math.ceil(Math.max(JOINT_RADIUS, ARM_HALF_WIDTH) + OUTLINE_WIDTH + 1);
        var left = bitmap.width, top = bitmap.height, right = 0, bottom = 0;
        points.forEach(function(point) {
            var x = point.x + offset.x;
            var y = point.y + offset.y;
            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x);
            bottom = Math.max(bottom, y);
        });
        left = Math.max(0, Math.floor(left - padding));
        top = Math.max(0, Math.floor(top - padding));
        right = Math.min(bitmap.width, Math.ceil(right + padding));
        bottom = Math.min(bitmap.height, Math.ceil(bottom + padding));
        if (right <= left || bottom <= top) return;
        var pixels = context.getImageData(left, top, right - left, bottom - top);
        var data = pixels.data;
        for (var i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 128) {
                data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0;
            } else if (data[i] + data[i + 1] + data[i + 2] < 500) {
                data[i] = 71;
                data[i + 1] = 78;
                data[i + 2] = 81;
                data[i + 3] = 255;
            } else {
                data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 255;
            }
        }
        context.putImageData(pixels, left, top);
    }

    function easeOutCubic(t) {
        return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
    }

    function shortestAngleDelta(from, to) {
        return Math.atan2(Math.sin(to - from), Math.cos(to - from));
    }

    function tipViaBackpackTop(start, end, progress) {
        var firstLeg = 0.55;
        var above = { x: BACKPACK_TOP.x,
            y: Math.min(BACKPACK_TOP.y, start.y, end.y) - 16 };
        var from = progress <= firstLeg ? start : above;
        var to = progress <= firstLeg ? above : end;
        var step = progress <= firstLeg ? progress / firstLeg :
            (progress - firstLeg) / (1 - firstLeg);
        var eased = easeOutCubic(step);
        return {
            x: from.x + (to.x - from.x) * eased,
            y: from.y + (to.y - from.y) * eased
        };
    }

    function constrainLinkLengths(points, lengths) {
        var last = points.length - 1;
        for (var pass = 0; pass < 48; pass++) {
            for (var step = 0; step < last; step++) {
                var i = pass % 2 ? last - step - 1 : step;
                var a = points[i], b = points[i + 1];
                var dx = b.x - a.x, dy = b.y - a.y;
                var distance = Math.max(0.001, Math.hypot(dx, dy));
                var correction = (distance - lengths[i]) / distance;
                if (i === 0) {
                    b.x -= dx * correction;
                    b.y -= dy * correction;
                } else if (i === last - 1) {
                    a.x += dx * correction;
                    a.y += dy * correction;
                } else {
                    a.x += dx * correction * 0.5;
                    a.y += dy * correction * 0.5;
                    b.x -= dx * correction * 0.5;
                    b.y -= dy * correction * 0.5;
                }
            }
        }
        return points;
    }

    function keepJointsAboveOpening(points) {
        for (var i = 1; i < points.length - 1; i++)
            points[i].y = Math.min(points[i].y, ROOT.y - 1);
        return points;
    }

    function parseMoveArgs(args, includesWeapon) {
        var parts = args.slice();
        var wait = parts[parts.length - 1] === 'wait';
        if (wait) parts.pop();
        var weapon = includesWeapon ? weaponName(parts.shift()) : null;
        var pose = parts.shift();
        if (includesWeapon && !weapon) return null;
        if (pose !== 'random' || (parts.length !== 1 && parts.length !== 3)) return null;
        var duration = parts[parts.length - 1];
        if (!nonnegativeInteger(duration)) return null;
        var x = parts.length === 3 ? parts[0] : 0;
        var y = parts.length === 3 ? parts[1] : 0;
        if (!finiteNumber(x) || !finiteNumber(y)) return null;
        return { weapon: weapon, pose: pose, x: x, y: y, duration: duration, wait: wait };
    }

    function parseTargetMoveArgs(args) {
        var parts = args.slice();
        var wait = parts[parts.length - 1] === 'wait';
        if (wait) parts.pop();
        if (parts.length !== 1 && parts.length !== 3) return null;
        var duration = parts[parts.length - 1];
        var x = parts.length === 3 ? parts[0] : 0;
        var y = parts.length === 3 ? parts[1] : 0;
        if (!nonnegativeInteger(duration) || !finiteNumber(x) || !finiteNumber(y)) return null;
        return { x: x, y: y, duration: duration, wait: wait };
    }

    function parseInArgs(args) {
        var parts = args.slice();
        var wait = parts[parts.length - 1] === 'wait';
        if (wait) parts.pop();
        if (parts.length !== 2 || !nonnegativeInteger(parts[0]) || !nonnegativeInteger(parts[1])) return null;
        return { grace: parts[0], duration: parts[1], wait: wait };
    }

    function parseWeaponAnimeArgs(args) {
        var parts = args.slice();
        var wait = parts[parts.length - 1] === 'wait';
        if (wait) parts.pop();
        if (parts.length < 1 || parts.length > 2) return null;
        var weapon = weaponName(parts[0]);
        if (!weapon) return null;
        var duration = parts.length === 2 ? parts[1] : DEFAULT_WEAPON_DURATION;
        if (!nonnegativeInteger(duration)) return null;
        return { weapon: weapon, duration: duration, wait: wait };
    }

    function parseArmAnimationArgs(args) {
        var parts = args.slice();
        var mirror = parts[parts.length - 1] === 'mirror';
        if (mirror) parts.pop();
        if (parts.length !== 1 && parts.length !== 3) return null;
        var id = parts[0], x = parts.length === 3 ? parts[1] : 0;
        var y = parts.length === 3 ? parts[2] : 0;
        if (!Number.isInteger(id) || id <= 0 || !$dataAnimations || !$dataAnimations[id] ||
            !finiteNumber(x) || !finiteNumber(y)) return null;
        return { id: id, x: x, y: y, mirror: mirror };
    }

    function parseActionCommand(name, args) {
        switch (name) {
        case 'yumeArmOut': return parseMoveArgs(args, true);
        case 'yumeArmMove': return parseMoveArgs(args, false);
        case 'yumeArmMoveToTarget': return parseTargetMoveArgs(args);
        case 'yumeArmWeaponAnime': return parseWeaponAnimeArgs(args);
        case 'yumeArmAnimation': return parseArmAnimationArgs(args);
        case 'yumeArmIn': return parseInArgs(args);
        default: return null;
        }
    }

    NS.validateActionLine = function(name, args) {
        if (!Object.prototype.hasOwnProperty.call(COMMAND_HINTS, name)) return null;
        var values = args.map(function(value) {
            return typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)) ?
                Number(value) : value;
        });
        var parsed = parseActionCommand(name, values);
        return parsed ? { valid: true, name: name } :
            { valid: false, name: name, reason: 'ゆめちゃんのアーム引数が未完成または不正' };
    };

    function YumeArm(manager, skillId, weapon, routeStyle) {
        this.manager = manager;
        this.skillId = skillId;
        this.routeStyle = routeStyle;
        this.ownerSequence = 0;
        this.weapon = null;
        this.phase = 'active';
        this.points = foldedPoints();
        this.fromPoints = null;
        this.toPoints = null;
        this.fromAngle = -Math.PI * 1.5;
        this.angle = this.fromAngle;
        this.toAngle = 0;
        this.angleDelta = 0;
        this.moveElapsed = 0;
        this.moveDuration = 0;
        this.preserveBends = true;
        this.hasDeployed = false;
        this.unfolding = false;
        this.retractingViaTop = false;
        this.retractTrim = 0;
        this.grace = 0;
        this.retractDuration = 0;
        this.useCount = 0;
        this.wigglePhase = 0;
        this.wiggleAmplitude = 0;
        this.weaponElapsed = 0;
        this.weaponDuration = 0;
        this.moveSeBuffer = null;
        this.rotorFrame = -1;
        this.armBitmap = new Bitmap(ARM_BITMAP_SIZE, ARM_BITMAP_SIZE);
        this.armBitmap.smooth = false;
        this.bitmapOffset = { x: ARM_BITMAP_OFFSET.x, y: ARM_BITMAP_OFFSET.y };
        this.armSprite = new Sprite(this.armBitmap);
        this.armSprite.x = -this.bitmapOffset.x;
        this.armSprite.y = -this.bitmapOffset.y;
        this.armSprite._yuraInfo = ARM_YURA_INFO;
        this.armSprite._yuraDirect = true;
        this.armSprite._yuraLockGeometry = true;
        this.weaponRoot = new Sprite();
        this.rotorSprite = new Sprite();
        this.barrelSprite = new Sprite();
        this.barrelSprite._yuraDirect = true;
        this.barrelSprite._yuraLockGeometry = true;
        this.weaponRoot.addChild(this.rotorSprite);
        this.weaponRoot.addChild(this.barrelSprite);
        manager.backLayer.addChild(this.armSprite);
        manager.frontLayer.addChild(this.weaponRoot);
        this.setWeapon(weapon);
        this.render();
    }

    function setSpriteYuraEnabled(sprite, enabled) {
        var info = enabled ? ARM_YURA_INFO : null;
        if (sprite._yuraInfo === info) return;
        sprite._yuraInfo = info;
        if (!enabled) {
            if (sprite._meshSprite) sprite._meshSprite.visible = false;
            if (sprite._baseBitmap) {
                var frame = sprite._frame;
                sprite.bitmap = sprite._baseBitmap;
                sprite._baseBitmap = null;
                if (frame) sprite.setFrame(frame.x, frame.y, frame.width, frame.height);
            }
        }
        sprite._lastFrame = null;
    }

    YumeArm.prototype.setYuraEnabled = function(enabled) {
        setSpriteYuraEnabled(this.armSprite, enabled);
        setSpriteYuraEnabled(this.barrelSprite, enabled && this.barrelSprite.visible);
    };

    YumeArm.prototype.updateYuraState = function() {
        this.setYuraEnabled(!this.toPoints && this.weaponElapsed >= this.weaponDuration);
    };

    YumeArm.prototype.setWeapon = function(name) {
        if (name === this.weapon) return;
        setSpriteYuraEnabled(this.barrelSprite, false);
        this.weapon = name;
        var info = WEAPONS[name];
        var bitmap = this.manager.owner._bitmaps && this.manager.owner._bitmaps[0];
        if (!bitmap) bitmap = ImageManager.loadSvActor(this.manager.owner._battler.battlerName());
        this.rotorSprite.bitmap = bitmap;
        var cached = this.manager.barrelBitmaps[name];
        var needsBlit = !cached || cached.source !== bitmap;
        var barrelBitmap;
        if (needsBlit) {
            barrelBitmap = new Bitmap(info.barrel.w, info.barrel.h);
            barrelBitmap.smooth = false;
            cached = { source: bitmap, bitmap: barrelBitmap };
            this.manager.barrelBitmaps[name] = cached;
        }
        barrelBitmap = cached.bitmap;
        this.barrelSprite.bitmap = barrelBitmap;
        // Both cropped frames still rotate around the center of their 144px cell.
        this.rotorSprite.anchor.set((CELL / 2 - info.rotor.x) / info.rotor.w,
            (CELL / 2 - info.rotor.y) / info.rotor.h);
        this.barrelSprite.anchor.set((CELL / 2 - info.barrel.x) / info.barrel.w,
            (CELL / 2 - info.barrel.y) / info.barrel.h);
        this.rotorSprite.x = this.rotorSprite.y = 0;
        this.barrelSprite.x = this.barrelSprite.y = 0;
        this.rotorFrame = -1;
        this.rotorSprite.setFrame(CELL + info.rotor.x, info.row * CELL + info.rotor.y,
            info.rotor.w, info.rotor.h);
        this.barrelSprite.setFrame(0, 0, info.barrel.w, info.barrel.h);
        if (needsBlit) bitmap.addLoadListener(function() {
            barrelBitmap.blt(bitmap, CELL * 3 + info.barrel.x, info.row * CELL + info.barrel.y,
                info.barrel.w, info.barrel.h, 0, 0);
            barrelBitmap._setDirty();
            barrelBitmap.checkDirty();
        });
        this.updateWeaponFrame();
    };

    function posePoints(shape, target, routeStyle) {
        var dx = target.x - ROOT.x;
        var dy = target.y - ROOT.y;
        var length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        var normalX = -dy / length;
        var normalY = dx / length;
        var points = [{ x: ROOT.x, y: ROOT.y }];
        var bends = routeStyle ? ALTERNATE_BENDS[(routeStyle - 1) % ALTERNATE_BENDS.length] :
            shape.bends;
        var bendSide = dx < 0 ? -1 : 1;
        bends.forEach(function(bend) {
            points.push({
                x: ROOT.x + dx * bend[0] + normalX * bend[1] * bendSide,
                y: ROOT.y + dy * bend[0] + normalY * bend[1] * bendSide
            });
        });
        points.push(target);
        return balanceSegmentLengths(points);
    }

    function tipLinkOverlapDepth(points, angle, weapon) {
        var tip = points[points.length - 1];
        var joint = points[points.length - 2];
        var dx = joint.x - tip.x, dy = joint.y - tip.y;
        var length = Math.hypot(dx, dy);
        if (length < 0.001) return Infinity;
        var cos = Math.cos(angle), sin = Math.sin(angle);
        var localX = (dx * cos + dy * sin) / length;
        var localY = (-dx * sin + dy * cos) / length;
        var depth = 0;
        [WEAPONS[weapon].rotor, WEAPONS[weapon].barrel].forEach(function(frame) {
            var left = frame.x - CELL / 2 - ARM_HALF_WIDTH;
            var top = frame.y - CELL / 2 - ARM_HALF_WIDTH;
            var right = left + frame.w + ARM_HALF_WIDTH * 2;
            var bottom = top + frame.h + ARM_HALF_WIDTH * 2;
            var exitX = localX > 0.001 ? right / localX :
                localX < -0.001 ? left / localX : Infinity;
            var exitY = localY > 0.001 ? bottom / localY :
                localY < -0.001 ? top / localY : Infinity;
            depth = Math.max(depth, Math.min(length, exitX, exitY));
        });
        return depth;
    }

    function tipRouteHasVisibleBends(points) {
        var last = points.length - 1;
        var reach = Math.hypot(points[last].x - points[0].x,
            points[last].y - points[0].y) / (NOMINAL_LINK_LENGTH * last);
        var strength = Math.max(0, Math.min(1, (1 - reach) / 0.2));
        var minimumTurn = Math.PI * 2 / 9 * strength - 0.01;
        for (var i = 1; i < last; i++) {
            if (Math.abs(turnAngle(points[i - 1], points[i], points[i + 1])) < minimumTurn)
                return false;
        }
        return true;
    }

    function orientTipLink(points, angle, weapon) {
        // A small overlap at the attachment joint is intentional; the rest of the link stays clear.
        var attachmentDepth = 14;
        if (tipLinkOverlapDepth(points, angle, weapon) <= attachmentDepth) return points;
        var last = points.length - 1;
        var tip = points[last], joint = points[last - 1];
        var linkLengths = [];
        for (var i = 0; i < last; i++)
            linkLengths.push(Math.hypot(points[i + 1].x - points[i].x,
                points[i + 1].y - points[i].y));
        var linkX = (tip.x - joint.x) / linkLengths[last - 1];
        var linkY = (tip.y - joint.y) / linkLengths[last - 1];
        var best = null, bestShift = Infinity;
        var available = linkLengths.slice(0, last - 1).reduce(function(sum, link) {
            return sum + link;
        }, 0);
        for (var step = 1; step <= 12; step++) {
            var turn = step * Math.PI / 12;
            for (var sign = -1; sign <= 1; sign += 2) {
                var rotatedX = linkX * Math.cos(turn) - linkY * Math.sin(turn) * sign;
                var rotatedY = linkX * Math.sin(turn) * sign + linkY * Math.cos(turn);
                var candidate = copyPoints(points);
                var nextJoint = candidate[last - 1];
                nextJoint.x = tip.x - linkLengths[last - 1] * rotatedX;
                nextJoint.y = tip.y - linkLengths[last - 1] * rotatedY;
                if (tipLinkOverlapDepth(candidate, angle, weapon) > attachmentDepth ||
                    nextJoint.y > ROOT.y - 1 ||
                    Math.hypot(nextJoint.x - ROOT.x, nextJoint.y - ROOT.y) > available * 1.02)
                    continue;
                constrainLinkLengths(candidate.slice(0, last), linkLengths.slice(0, last - 1));
                if (candidate.slice(1, last).some(function(point) { return point.y > ROOT.y - 1; }))
                    continue;
                if (!tipRouteHasVisibleBends(candidate)) continue;
                var shift = Math.hypot(nextJoint.x - joint.x, nextJoint.y - joint.y);
                if (shift < bestShift) {
                    best = candidate;
                    bestShift = shift;
                }
            }
            if (best) break;
        }
        return best;
    }

    function swayMovingJoints(points, progress, phase, amplitude) {
        var tip = points[points.length - 1];
        var dx = tip.x - points[0].x, dy = tip.y - points[0].y;
        var reach = Math.max(1, Math.hypot(dx, dy));
        var envelope = Math.sin(Math.PI * progress);
        var wave = (0.8 + 0.2 * Math.sin(progress * Math.PI * 3 + phase)) *
            envelope * amplitude;
        for (var i = 1; i < points.length - 1; i++) {
            var weight = i % 2 ? 1 : -0.85;
            points[i].x -= dy / reach * wave * weight;
            points[i].y += dx / reach * wave * weight;
        }
    }

    YumeArm.prototype.randomTarget = function(x, y, enemyPoint) {
        var layout = this.manager.separateTarget(this, x, y, enemyPoint);
        this.routeStyle = layout.routeStyle;
        return layout;
    };

    YumeArm.prototype.ensureArmBitmapFits = function(points, extraPadding) {
        var padding = Math.ceil(Math.max(JOINT_RADIUS, ARM_HALF_WIDTH) + OUTLINE_WIDTH + 8 +
            (extraPadding || 0));
        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        this.points.concat(points).forEach(function(point) {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
        });
        var offset = this.bitmapOffset;
        var oldWidth = this.armBitmap.width, oldHeight = this.armBitmap.height;
        var growLeft = Math.max(0, Math.ceil((padding - minX - offset.x) / 64) * 64);
        var growTop = Math.max(0, Math.ceil((padding - minY - offset.y) / 64) * 64);
        var growRight = Math.max(0, Math.ceil((maxX + offset.x + growLeft + padding - oldWidth) / 64) * 64);
        var growBottom = Math.max(0, Math.ceil((maxY + offset.y + growTop + padding - oldHeight) / 64) * 64);
        if (!growLeft && !growTop && !growRight && !growBottom) return false;
        if (oldWidth + growLeft + growRight > MAX_ARM_BITMAP_SIZE ||
            oldHeight + growTop + growBottom > MAX_ARM_BITMAP_SIZE) return false;
        this.setYuraEnabled(false);
        offset.x += growLeft;
        offset.y += growTop;
        this.armBitmap = new Bitmap(oldWidth + growLeft + growRight,
            oldHeight + growTop + growBottom);
        this.armBitmap.smooth = false;
        this.armSprite.bitmap = this.armBitmap;
        this.armSprite.setFrame(0, 0, this.armBitmap.width, this.armBitmap.height);
        this.armSprite.x = -offset.x;
        this.armSprite.y = -offset.y;
        this.armSprite._lastFrame = null;
        if (this.armSprite._meshSprite) this.armSprite._meshSprite._meshDirty = true;
        this.updateYuraState();
        return true;
    };

    YumeArm.prototype.backpackPathPoints = function(progress) {
        if (progress >= 1) return copyPoints(this.toPoints);
        var last = this.fromPoints.length - 1;
        var startTip = this.fromPoints[last], endTip = this.toPoints[last];
        var guideTip = this.retractingViaTop ? startTip : endTip;
        var dx = guideTip.x - ROOT.x, dy = guideTip.y - ROOT.y;
        var reach = Math.max(1, Math.hypot(dx, dy));
        var normalX = -dy / reach, normalY = dx / reach;
        var eased = easeOutCubic(progress);
        var envelope = Math.sin(Math.PI * progress);
        var points = [], lengths = [], totalLength = 0;
        for (var i = 0; i <= last; i++) {
            if (i === last) {
                points.push(tipViaBackpackTop(startTip, endTip, progress));
            } else {
                var lag = this.retractingViaTop ? (last - i) / last * 0.12 : i / last * 0.18;
                var staged = Math.max(0, (progress - lag) / (1 - lag));
                var blend = easeOutCubic(staged);
                var sway = i === 0 ? 0 : (this.retractingViaTop ? 7 : 12) * envelope *
                    Math.sin(progress * Math.PI * 3 - i * 1.15);
                points.push({
                    x: this.fromPoints[i].x + (this.toPoints[i].x - this.fromPoints[i].x) * blend +
                        normalX * sway,
                    y: this.fromPoints[i].y + (this.toPoints[i].y - this.fromPoints[i].y) * blend +
                        normalY * sway
                });
            }
            if (i > 0) {
                var from = Math.hypot(this.fromPoints[i].x - this.fromPoints[i - 1].x,
                    this.fromPoints[i].y - this.fromPoints[i - 1].y);
                var to = Math.hypot(this.toPoints[i].x - this.toPoints[i - 1].x,
                    this.toPoints[i].y - this.toPoints[i - 1].y);
                lengths.push(from + (to - from) * eased);
                totalLength += lengths[i - 1];
            }
        }
        var needed = Math.hypot(points[last].x - points[0].x, points[last].y - points[0].y);
        if (needed > totalLength) {
            var stretch = needed / totalLength;
            lengths = lengths.map(function(length) { return length * stretch; });
        }
        return constrainLinkLengths(points, lengths);
    };

    YumeArm.prototype.retractDrawPoints = function(tip) {
        var source = this.fromPoints;
        if (!source) return this.points;
        var last = source.length - 1;
        var trim = Math.min(last - 0.001, this.retractTrim);
        var first = Math.floor(trim);
        var fraction = trim - first;
        var start = {
            x: source[first].x + (source[first + 1].x - source[first].x) * fraction,
            y: source[first].y + (source[first + 1].y - source[first].y) * fraction
        };
        var remaining = [start].concat(source.slice(first + 1));
        if (remaining.length > 2 &&
            Math.hypot(remaining[1].x - start.x, remaining[1].y - start.y) < JOINT_RADIUS * 2)
            remaining.shift();
        start = remaining[0];
        var end = remaining[remaining.length - 1];
        var sourceDx = end.x - start.x, sourceDy = end.y - start.y;
        var sourceReach = Math.max(0.001, Math.hypot(sourceDx, sourceDy));
        var targetDx = tip.x - ROOT.x, targetDy = tip.y - ROOT.y;
        var targetReach = Math.hypot(targetDx, targetDy);
        var sourceNormalX = -sourceDy / sourceReach, sourceNormalY = sourceDx / sourceReach;
        var targetNormalX = targetReach > 0.001 ? -targetDy / targetReach : 0;
        var targetNormalY = targetReach > 0.001 ? targetDx / targetReach : 0;
        return keepJointsAboveOpening(remaining.map(function(point) {
            var dx = point.x - start.x, dy = point.y - start.y;
            var along = (dx * sourceDx + dy * sourceDy) / (sourceReach * sourceReach);
            var side = dx * sourceNormalX + dy * sourceNormalY;
            return {
                x: ROOT.x + targetDx * along + targetNormalX * side,
                y: ROOT.y + targetDy * along + targetNormalY * side
            };
        }));
    };

    YumeArm.prototype.unfoldDrawPoints = function(tip) {
        var progress = this.moveDuration > 0 ? this.moveElapsed / this.moveDuration : 1;
        var last = this.points.length - 1;
        var links = Math.min(last, Math.ceil(progress * last));
        if (links <= 0) return [{ x: ROOT.x, y: ROOT.y }];
        if (links === last) return keepJointsAboveOpening(copyPoints(this.points));
        // Only the links already pulled through the opening are drawn. Use the
        // matching end of the deployed route, anchored at the backpack mouth.
        var source = this.toPoints.slice(last - links);
        var start = source[0], end = source[source.length - 1];
        var sourceDx = end.x - start.x, sourceDy = end.y - start.y;
        var sourceReach = Math.max(0.001, Math.hypot(sourceDx, sourceDy));
        var sourceNormalX = -sourceDy / sourceReach, sourceNormalY = sourceDx / sourceReach;
        var targetDx = tip.x - ROOT.x, targetDy = tip.y - ROOT.y;
        var targetReach = Math.hypot(targetDx, targetDy);
        var targetNormalX = targetReach > 0.001 ? -targetDy / targetReach : 0;
        var targetNormalY = targetReach > 0.001 ? targetDx / targetReach : 0;
        var points = source.map(function(point, index) {
            var dx = point.x - start.x, dy = point.y - start.y;
            var along = (dx * sourceDx + dy * sourceDy) / (sourceReach * sourceReach);
            var side = dx * sourceNormalX + dy * sourceNormalY;
            if (index > 0 && index < links)
                side += Math.sin(progress * Math.PI * 3 - index * 1.15) *
                    Math.sin(Math.PI * progress) * 5;
            return {
                x: ROOT.x + targetDx * along + targetNormalX * side,
                y: ROOT.y + targetDy * along + targetNormalY * side
            };
        });
        var lengths = [], totalLength = 0;
        for (var i = 0; i < links; i++) {
            var length = Math.hypot(source[i + 1].x - source[i].x,
                source[i + 1].y - source[i].y);
            lengths.push(length);
            totalLength += length;
        }
        var stretch = Math.max(1, (targetReach + 1) / Math.max(1, totalLength));
        return keepJointsAboveOpening(constrainLinkLengths(points,
            lengths.map(function(length) { return length * stretch; })));
    };

    YumeArm.prototype.stopMoveSe = function() {
        if (this.moveSeBuffer && this.moveSeBuffer.stop) this.moveSeBuffer.stop();
        this.moveSeBuffer = null;
    };

    YumeArm.prototype.startMoveSe = function() {
        if (typeof AudioManager === 'undefined' || !AudioManager.playSe) return;
        var before = AudioManager._seBuffers ? AudioManager._seBuffers.slice() : [];
        AudioManager.playSe({
            name: MOVE_SE_NAME,
            volume: MOVE_SE_VOLUME,
            pitch: MOVE_SE_PITCH_MIN + Math.floor(this.manager.random() * MOVE_SE_PITCH_RANGE),
            pan: 0
        });
        var buffers = AudioManager._seBuffers || [];
        for (var i = buffers.length - 1; i >= 0; i--) {
            if (before.indexOf(buffers[i]) < 0) {
                this.moveSeBuffer = buffers[i];
                break;
            }
        }
    };

    YumeArm.prototype.moveTo = function(points, angle, duration, phase, preserveBends, pathMode) {
        this.stopMoveSe();
        this.fromPoints = copyPoints(this.points);
        this.toPoints = copyPoints(points);
        this.fromAngle = this.angle;
        this.toAngle = angle;
        this.angleDelta = shortestAngleDelta(this.fromAngle, angle);
        this.moveElapsed = 0;
        this.moveDuration = Math.max(0, duration);
        if (this.moveDuration > 0) this.startMoveSe();
        this.phase = phase;
        this.preserveBends = preserveBends !== false;
        this.wigglePhase = this.manager.random() * Math.PI * 2;
        this.wiggleAmplitude = (10 + this.manager.random() * 5) *
            (this.manager.random() < 0.5 ? -1 : 1);
        this.unfolding = pathMode === 'out' && this.moveDuration > 0;
        this.retractingViaTop = pathMode === 'in' && this.moveDuration > 0;
        this.retractTrim = 0;
        if (this.moveDuration === 0) {
            this.points = copyPoints(points);
            this.angle = angle;
            this.fromPoints = this.toPoints = null;
        }
        this.updateYuraState();
        var viaTop = this.unfolding || this.retractingViaTop;
        var bounds = viaTop ? points.concat([BACKPACK_TOP]) : points;
        var resized = this.ensureArmBitmapFits(bounds, viaTop ? 16 : 0);
        if (this.moveDuration === 0 || resized || viaTop) this.render();
    };

    YumeArm.prototype.out = function(weapon, pose, x, y, duration, sequence, enemyPoint) {
        var unfold = !this.hasDeployed;
        this.hasDeployed = true;
        this.ownerSequence = sequence;
        this.grace = 0;
        this.useCount++;
        this.setWeapon(weapon);
        var layout = this.randomTarget(x, y, enemyPoint);
        this.moveTo(layout.points, layout.angle,
            duration, 'active', true, unfold ? 'out' : null);
        this.restartWeaponAnimation(DEFAULT_WEAPON_DURATION);
    };

    YumeArm.prototype.move = function(pose, x, y, duration, enemyPoint) {
        this.grace = 0;
        this.useCount++;
        var layout = this.randomTarget(x, y, enemyPoint);
        this.moveTo(layout.points, layout.angle,
            duration, 'active');
    };

    YumeArm.prototype.moveToTarget = function(target, duration) {
        this.grace = 0;
        var count = this.points.length - 1;
        var points = [];
        for (var i = 0; i <= count; i++) {
            var ratio = i / count;
            points.push({
                x: ROOT.x + (target.x - ROOT.x) * ratio,
                y: ROOT.y + (target.y - ROOT.y) * ratio
            });
        }
        this.moveTo(points, this.angle, duration, 'active', false);
    };

    YumeArm.prototype.restartWeaponAnimation = function(duration) {
        this.weaponElapsed = 0;
        this.weaponDuration = Math.max(1, duration);
        this.updateYuraState();
        this.updateWeaponFrame();
    };

    YumeArm.prototype.scheduleIn = function(grace, duration) {
        this.grace = grace;
        this.retractDuration = duration;
        this.phase = 'pending';
        if (grace === 0) this.beginRetract();
    };

    YumeArm.prototype.beginRetract = function() {
        this.grace = 0;
        this.moveTo(foldedPoints(), this.angle + Math.PI, this.retractDuration,
            'retracting', true, 'in');
    };

    YumeArm.prototype.updateWeaponFrame = function() {
        var info = WEAPONS[this.weapon];
        var active = this.weaponElapsed < this.weaponDuration;
        this.rotorSprite.visible = active;
        this.barrelSprite.visible = !active;
        var frame = active ? Math.floor(this.weaponElapsed / WEAPON_FRAME_FRAMES) % 2 : 0;
        if (this.rotorFrame !== frame) {
            this.rotorFrame = frame;
            this.rotorSprite.setFrame(CELL * (frame + 1) + info.rotor.x,
                info.row * CELL + info.rotor.y, info.rotor.w, info.rotor.h);
        }
    };

    YumeArm.prototype.update = function() {
        var moved = false;
        if (this.moveDuration > 0 && this.toPoints) {
            this.moveElapsed = Math.min(this.moveDuration, this.moveElapsed + 1);
            if (this.moveElapsed % MOTION_STEP_FRAMES === 0 ||
                this.moveElapsed === this.moveDuration) {
                var progress = this.moveElapsed / this.moveDuration;
                var t = easeOutCubic(progress);
                if (this.unfolding || this.retractingViaTop) {
                    this.points = this.backpackPathPoints(progress);
                    if (this.retractingViaTop) {
                        var desiredTrim = progress * (this.points.length - 1);
                        this.retractTrim = Math.min(desiredTrim, this.retractTrim + 1);
                        this.ensureArmBitmapFits(this.retractDrawPoints(this.points[this.points.length - 1]), 8);
                    }
                } else {
                    for (var i = 0; i < this.points.length; i++) {
                        this.points[i].x = this.fromPoints[i].x + (this.toPoints[i].x - this.fromPoints[i].x) * t;
                        this.points[i].y = this.fromPoints[i].y + (this.toPoints[i].y - this.fromPoints[i].y) * t;
                    }
                    if (this.preserveBends && this.phase === 'active')
                        swayMovingJoints(this.points, progress, this.wigglePhase, this.wiggleAmplitude);
                }
                if (!this.unfolding && !this.retractingViaTop && this.preserveBends &&
                    (this.phase === 'active' || this.phase === 'retracting')) {
                    var startTip = this.fromPoints[this.fromPoints.length - 1];
                    var startReach = Math.hypot(startTip.x - this.fromPoints[0].x,
                        startTip.y - this.fromPoints[0].y);
                    var currentTip = this.points[this.points.length - 1];
                    var currentReach = Math.hypot(currentTip.x - this.points[0].x,
                        currentTip.y - this.points[0].y);
                    var bendProgress = Math.min(1, currentReach / 25) *
                        (startReach < 25 ? Math.min(1, t * 3) : 1);
                    balanceSegmentLengths(this.points, bendProgress);
                    // Bend correction can shorten one link; settle the live shape once more.
                    balanceSegmentLengths(this.points, bendProgress);
                    var lengths = [];
                    for (var link = 0; link < this.points.length - 1; link++) {
                        var fromLength = Math.hypot(this.fromPoints[link + 1].x - this.fromPoints[link].x,
                            this.fromPoints[link + 1].y - this.fromPoints[link].y);
                        var toLength = Math.hypot(this.toPoints[link + 1].x - this.toPoints[link].x,
                            this.toPoints[link + 1].y - this.toPoints[link].y);
                        lengths.push(fromLength + (toLength - fromLength) * t);
                    }
                    constrainLinkLengths(this.points, lengths);
                }
                this.angle = progress >= 1 ? this.toAngle : this.fromAngle + this.angleDelta * t;
                moved = true;
            }
            if (this.moveElapsed === this.moveDuration) {
                this.fromPoints = this.toPoints = null;
                this.unfolding = false;
                this.retractingViaTop = false;
                this.stopMoveSe();
            }
        }
        if (this.weaponElapsed < this.weaponDuration) this.weaponElapsed++;
        this.updateWeaponFrame();
        if (this.phase === 'pending' && --this.grace <= 0) this.beginRetract();
        this.updateYuraState();
        if (moved) this.render();
        return this.phase === 'retracting' && !this.toPoints;
    };

    YumeArm.prototype.render = function() {
        var bitmap = this.armBitmap;
        var context = bitmap._context;
        var points = this.points;
        var progress = this.moveDuration > 0 ? this.moveElapsed / this.moveDuration : 1;
        var tip = points[points.length - 1];
        var drawPoints = this.retractingViaTop ? this.retractDrawPoints(tip) :
            this.unfolding ? this.unfoldDrawPoints(tip) : points;
        var fullyRetracted = this.phase === 'retracting' && !this.toPoints;
        var unfoldedStepVisible = !this.unfolding || this.moveElapsed >= MOTION_STEP_FRAMES;
        context.clearRect(0, 0, bitmap.width, bitmap.height);
        context.save();
        context.imageSmoothingEnabled = false;
        context.translate(this.bitmapOffset.x, this.bitmapOffset.y);
        context.lineJoin = 'round';
        context.lineCap = 'round';
        var returningInsideBackpack = this.retractingViaTop && progress > 0.55 &&
            tip.y > ROOT.y - WEAPON_BACKPACK_CLEARANCE;
        this.armSprite.visible = !fullyRetracted && !returningInsideBackpack && unfoldedStepVisible;
        for (var i = 0; this.armSprite.visible && i < drawPoints.length - 1; i++) {
            var a = drawPoints[i], b = drawPoints[i + 1];
            var dx = b.x - a.x, dy = b.y - a.y;
            var length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
            var nx = -dy / length * ARM_HALF_WIDTH, ny = dx / length * ARM_HALF_WIDTH;
            context.beginPath();
            context.moveTo(a.x + nx, a.y + ny);
            context.lineTo(b.x + nx, b.y + ny);
            context.lineTo(b.x - nx, b.y - ny);
            context.lineTo(a.x - nx, a.y - ny);
            context.closePath();
            context.fillStyle = '#ffffff';
            context.fill();
            context.strokeStyle = '#474e51';
            context.lineWidth = OUTLINE_WIDTH;
            context.stroke();
        }
        for (var j = 0; this.armSprite.visible && j < drawPoints.length - 1; j++) {
            var p = drawPoints[j];
            context.beginPath();
            context.arc(p.x, p.y, j === 0 ? ROOT_JOINT_RADIUS : JOINT_RADIUS, 0, Math.PI * 2);
            context.fillStyle = '#ffffff';
            context.fill();
            context.lineWidth = OUTLINE_WIDTH;
            context.strokeStyle = '#474e51';
            context.stroke();
        }
        context.restore();
        snapArmPixels(context, bitmap, drawPoints, this.bitmapOffset);
        bitmap._setDirty();
        bitmap.checkDirty();
        if (this.armSprite._yuraInfo && this.armSprite._meshSprite) {
            this.armSprite._meshSprite._meshDirty = true;
            this.armSprite._meshSprite.updateMesh();
        }
        this.weaponRoot.x = tip.x;
        this.weaponRoot.y = tip.y;
        this.weaponRoot.rotation = this.angle;
        var insideBackpack = tip.y > ROOT.y - WEAPON_BACKPACK_CLEARANCE;
        var emergingInsideBackpack = this.unfolding && progress <= 0.55 && insideBackpack;
        this.weaponRoot.visible = !fullyRetracted && !returningInsideBackpack &&
            unfoldedStepVisible && !emergingInsideBackpack;
    };

    YumeArm.prototype.dispose = function() {
        this.stopMoveSe();
        if (this.armSprite.parent) this.armSprite.parent.removeChild(this.armSprite);
        if (this.weaponRoot.parent) this.weaponRoot.parent.removeChild(this.weaponRoot);
    };

    function YumeArmManager(owner) {
        this.owner = owner;
        this.random = Math.random;
        this.arms = Object.create(null);
        this.barrelBitmaps = Object.create(null);
        this.nextSequence = 0;
        this.latestSequenceBySkill = Object.create(null);
        this.backLayer = new Sprite();
        this.frontLayer = new Sprite();
        this.backLayer.z = 2.9;
        this.frontLayer.z = 2.95;
    }

    YumeArmManager.prototype.hasArms = function() {
        return Object.keys(this.arms).length > 0;
    };

    YumeArmManager.prototype.isAnimating = function() {
        var keys = Object.keys(this.arms);
        return keys.some(function(key) {
            var arm = this.arms[key];
            return !!arm.toPoints || arm.phase !== 'active' ||
                arm.weaponElapsed < arm.weaponDuration;
        }, this);
    };

    YumeArmManager.prototype.armFor = function(skillId) {
        return this.arms[String(skillId)] || null;
    };

    YumeArmManager.prototype.playAnimationAtWeapon = function(arm, animationId, offsetX, offsetY, mirror) {
        var scene = SceneManager._scene;
        if (!scene || !scene._battleContainer || typeof scene.playAnimation !== 'function') return;
        var tip = arm.points[arm.points.length - 1];
        var global = this.owner.toGlobal({ x: tip.x, y: tip.y });
        var position = scene._battleContainer.toLocal(global);
        scene.playAnimation($dataAnimations[animationId], position.x + offsetX, position.y + offsetY, mirror);
    };

    YumeArmManager.prototype.enemyCenterLocal = function(target, offsetX, offsetY) {
        if (!target || typeof target.toGlobal !== 'function' ||
            typeof this.owner.toLocal !== 'function') return null;
        var width = target.width || target._frameSize || 0;
        var height = target.height || target._frameSize || 0;
        var anchorX = target.anchor && finiteNumber(target.anchor.x) ? target.anchor.x : 0.5;
        var anchorY = target.anchor && finiteNumber(target.anchor.y) ? target.anchor.y : 1;
        var global = target.toGlobal({
            x: (0.5 - anchorX) * width,
            y: (0.5 - anchorY) * height
        });
        if (!global || !finiteNumber(global.x) || !finiteNumber(global.y)) return null;
        var local = this.owner.toLocal({ x: global.x + offsetX, y: global.y + offsetY });
        return local && finiteNumber(local.x) && finiteNumber(local.y) ? local : null;
    };

    YumeArmManager.prototype.ensureArm = function(skillId, weapon) {
        var key = String(skillId);
        if (!this.arms[key]) {
            this.attach();
            var occupied = Object.keys(this.arms).map(function(otherKey) {
                return this.arms[otherKey].routeStyle;
            }, this);
            var routeStyle = 0;
            while (occupied.indexOf(routeStyle) >= 0) routeStyle++;
            this.arms[key] = new YumeArm(this, skillId, weapon, routeStyle);
        }
        return this.arms[key];
    };

    function weaponBounds(weapon, point, angle) {
        var info = WEAPONS[weapon];
        var cos = Math.cos(angle), sin = Math.sin(angle);
        var bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
        [info.rotor, info.barrel].forEach(function(frame) {
            var left = frame.x - CELL / 2, top = frame.y - CELL / 2;
            [left, left + frame.w].forEach(function(x) {
                [top, top + frame.h].forEach(function(y) {
                    var px = point.x + x * cos - y * sin;
                    var py = point.y + x * sin + y * cos;
                    bounds.left = Math.min(bounds.left, px);
                    bounds.right = Math.max(bounds.right, px);
                    bounds.top = Math.min(bounds.top, py);
                    bounds.bottom = Math.max(bounds.bottom, py);
                });
            });
        });
        bounds.left -= WEAPON_CLEARANCE;
        bounds.right += WEAPON_CLEARANCE;
        bounds.top -= WEAPON_CLEARANCE;
        bounds.bottom += WEAPON_CLEARANCE;
        return bounds;
    }

    function boundsOverlap(a, b) {
        return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    }

    function pointSegmentDistance(point, a, b) {
        var dx = b.x - a.x, dy = b.y - a.y;
        var lengthSquared = dx * dx + dy * dy;
        var t = lengthSquared > 0 ? Math.max(0, Math.min(1,
            ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)) : 0;
        return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
    }

    function routeClearance(points, others) {
        var minimum = Infinity;
        for (var o = 0; o < others.length; o++) {
            var other = others[o].toPoints || others[o].points;
            for (var i = 1; i < points.length - 1; i++) {
                for (var j = 1; j < other.length - 1; j++) {
                    minimum = Math.min(minimum,
                        Math.hypot(points[i].x - other[j].x, points[i].y - other[j].y) - 12);
                }
            }
            // Sharp crossings are intentional; long, nearly parallel overlaps are not.
            for (var a = 1; a < points.length - 1; a++) {
                var p = points[a], q = points[a + 1];
                var pdx = q.x - p.x, pdy = q.y - p.y;
                for (var b = 1; b < other.length - 1; b++) {
                    var r = other[b], s = other[b + 1];
                    var rdx = s.x - r.x, rdy = s.y - r.y;
                    var product = Math.hypot(pdx, pdy) * Math.hypot(rdx, rdy);
                    if (product < 0.001 || Math.abs(pdx * rdy - pdy * rdx) / product >= 0.4) continue;
                    var gap = Math.min(pointSegmentDistance(p, r, s),
                        pointSegmentDistance(q, r, s), pointSegmentDistance(r, p, q),
                        pointSegmentDistance(s, p, q));
                    minimum = Math.min(minimum, gap - 7);
                }
            }
        }
        return minimum;
    }

    YumeArmManager.prototype.weaponBounds = weaponBounds;

    YumeArmManager.prototype.separateTarget = function(arm, offsetX, offsetY, enemyPoint) {
        var others = Object.keys(this.arms).map(function(key) { return this.arms[key]; }, this)
            .filter(function(other) { return other !== arm && other.hasDeployed; });
        var occupiedBounds = [];
        others.forEach(function(other) {
            var tip = other.points[other.points.length - 1];
            occupiedBounds.push(weaponBounds(other.weapon, tip, other.angle));
            if (other.toPoints) {
                var destination = other.toPoints[other.toPoints.length - 1];
                occupiedBounds.push(weaponBounds(other.weapon, destination, other.toAngle));
            }
        });
        var styles = [arm.routeStyle];
        for (var style = 0; style <= ALTERNATE_BENDS.length; style++) {
            if (style !== arm.routeStyle) styles.push(style);
        }
        var previousTips = arm.useCount > 1 ? [arm.points[arm.points.length - 1]] : [];
        if (arm.useCount > 1 && arm.toPoints)
            previousTips.push(arm.toPoints[arm.toPoints.length - 1]);
        var best = null, bestClearance = -Infinity;
        var manager = this;
        function candidate(x, y, minimumTravel, maximumTravel) {
            var target = { x: Math.round(x + offsetX), y: Math.round(y + offsetY) };
            if (maximumTravel !== undefined && Math.hypot(target.x - previousTips[0].x,
                target.y - previousTips[0].y) > maximumTravel + 0.001) return null;
            if (previousTips.some(function(previous) {
                return Math.hypot(target.x - previous.x, target.y - previous.y) < minimumTravel;
            }))
                return null;
            var angle = enemyPoint && Math.hypot(enemyPoint.x - target.x,
                enemyPoint.y - target.y) > 0.001 ?
                Math.atan2(enemyPoint.y - target.y, enemyPoint.x - target.x) : 0;
            var bounds = weaponBounds(arm.weapon, target, angle);
            if (occupiedBounds.some(function(otherBounds) { return boundsOverlap(bounds, otherBounds); }))
                return null;
            var shape = { bends: RANDOM_BENDS.map(function(bend) {
                return [bend[0] + (manager.random() - 0.5) * 0.06,
                    bend[1] + (manager.random() - 0.5) * 10];
            }) };
            for (var s = 0; s < styles.length; s++) {
                var points = orientTipLink(posePoints(shape, target, styles[s]), angle, arm.weapon);
                if (!points) continue;
                var clearance = routeClearance(points, others);
                var layout = { points: points, angle: angle, routeStyle: styles[s] };
                if (clearance >= 0) return layout;
                if (clearance > bestClearance) {
                    best = layout;
                    bestClearance = clearance;
                }
            }
            return null;
        }
        if (arm.useCount > 1 && arm.phase !== 'retracting') {
            var current = arm.points[arm.points.length - 1];
            var relativeY = current.y - offsetY;
            var localRow = CROWD_ROWS[0];
            for (var rowIndex = 1; rowIndex < CROWD_ROWS.length; rowIndex++) {
                if (Math.abs(relativeY - (GUN_Y_MIN + GUN_Y_MAX) / 2 - CROWD_ROWS[rowIndex]) <
                    Math.abs(relativeY - (GUN_Y_MIN + GUN_Y_MAX) / 2 - localRow))
                    localRow = CROWD_ROWS[rowIndex];
            }
            var localMinY = GUN_Y_MIN + localRow;
            var localMaxY = GUN_Y_MAX + localRow;
            var limits = [REPEAT_NEAR_MAX, REPEAT_MID_MAX];
            for (var tier = 0; tier < limits.length; tier++) {
                var maxStep = limits[tier];
                var minimums = [REPEAT_MIN_DISTANCE, 12, 4, 0];
                for (var minimum = 0; minimum < minimums.length; minimum++) {
                    var minStep = tier === 0 ? minimums[minimum] : REPEAT_NEAR_MAX;
                    for (var nearAttempt = 0; nearAttempt < RANDOM_TRIES; nearAttempt++) {
                        var direction = manager.random() < 0.5 ? -1 : 1;
                        var nearX = current.x - offsetX + direction *
                            (minStep + manager.random() * (maxStep - minStep));
                        if (nearX < GUN_X_MIN || nearX > GUN_X_MAX) continue;
                        var nearY = Math.max(localMinY, Math.min(localMaxY,
                            current.y - offsetY + (manager.random() - 0.5) * 20));
                        var nearLayout = candidate(nearX, nearY, minimums[minimum], maxStep);
                        if (nearLayout) return nearLayout;
                    }
                    // Keep a short move possible even when the random source repeats.
                    for (var sign = -1; sign <= 1; sign += 2) {
                        for (var step = minStep; step <= maxStep; step += 4) {
                            var gridX = current.x - offsetX + sign * step;
                            if (gridX < GUN_X_MIN || gridX > GUN_X_MAX) continue;
                            for (var yStep = -8; yStep <= 8; yStep += 8) {
                                var gridY = Math.max(localMinY, Math.min(localMaxY,
                                    current.y - offsetY + yStep));
                                var nearby = candidate(gridX, gridY, minimums[minimum], maxStep);
                                if (nearby) return nearby;
                            }
                        }
                    }
                    // Joint clearance is a preference, not a reason to move a clear gun farther away.
                    if (best) return best;
                }
            }
        }
        for (var row = 0; row < CROWD_ROWS.length; row++) {
            for (var distance = REPEAT_MIN_DISTANCE; distance >= 0; distance -= 12) {
                for (var attempt = 0; attempt < RANDOM_TRIES; attempt++) {
                    var x = GUN_X_MIN + manager.random() * (GUN_X_MAX - GUN_X_MIN);
                    var y = GUN_Y_MIN + manager.random() * (GUN_Y_MAX - GUN_Y_MIN) + CROWD_ROWS[row];
                    var randomLayout = candidate(x, y, distance);
                    if (randomLayout) return randomLayout;
                }
                // Grid fallback also handles low-entropy random sources.
                for (var column = 0; column <= 8; column++) {
                    for (var level = 0; level <= 2; level++) {
                        var gridLayout = candidate(GUN_X_MIN + column * 20,
                            GUN_Y_MIN + level * 10 + CROWD_ROWS[row], distance);
                        if (gridLayout) return gridLayout;
                    }
                }
                if (best) return best;
            }
        }
        var fallback = { x: offsetX, y: GUN_Y_MIN + offsetY };
        var fallbackAngle = enemyPoint ? Math.atan2(enemyPoint.y - fallback.y,
            enemyPoint.x - fallback.x) : 0;
        var fallbackPoints = posePoints({ bends: RANDOM_BENDS }, fallback, arm.routeStyle);
        return { points: orientTipLink(fallbackPoints, fallbackAngle, arm.weapon) || fallbackPoints,
            angle: fallbackAngle, routeStyle: arm.routeStyle };
    };

    YumeArmManager.prototype.attach = function() {
        var parent = this.owner.parent;
        if (!parent) return;
        if (this.backLayer.parent !== parent) {
            if (this.backLayer.parent) this.backLayer.parent.removeChild(this.backLayer);
            if (this.frontLayer.parent) this.frontLayer.parent.removeChild(this.frontLayer);
            parent.addChild(this.backLayer);
            parent.addChild(this.frontLayer);
        }
    };

    YumeArmManager.prototype.syncTransform = function() {
        var actor = this.owner;
        [this.backLayer, this.frontLayer].forEach(function(layer) {
            layer.x = actor.x;
            layer.y = actor.y;
            layer.scale.x = actor.scale.x;
            layer.scale.y = actor.scale.y;
            layer.rotation = actor.rotation;
            layer.visible = actor.visible;
            layer.alpha = actor.alpha;
        });
        // The weapon stays in front of the arm, but both stay behind Yume.
        this.backLayer.z = actor.z - 0.1;
        this.frontLayer.z = actor.z - 0.05;
    };

    YumeArmManager.prototype.update = function() {
        var actor = this.owner;
        if (!isYume(actor) || actor._battler.isDead()) {
            this.clear();
            return;
        }
        if (!this.hasArms()) return;
        this.attach();
        this.syncTransform();
        var keys = Object.keys(this.arms);
        for (var i = 0; i < keys.length; i++) {
            var arm = this.arms[keys[i]];
            if (arm.update()) {
                arm.dispose();
                delete this.arms[keys[i]];
            }
        }
        if (this.hasArms()) {
            if (actor._animationType === actor.getAnimationType('wait'))
                actor.setAnimation('attack1', true, 0, Infinity);
        } else {
            this.detach();
            if (actor._animationType === actor.getAnimationType('attack1'))
                actor.setAnimation('', true);
        }
    };

    YumeArmManager.prototype.detach = function() {
        if (this.backLayer.parent) this.backLayer.parent.removeChild(this.backLayer);
        if (this.frontLayer.parent) this.frontLayer.parent.removeChild(this.frontLayer);
    };

    YumeArmManager.prototype.clear = function() {
        var keys = Object.keys(this.arms);
        for (var i = 0; i < keys.length; i++) this.arms[keys[i]].dispose();
        this.arms = Object.create(null);
        this.detach();
    };

    var _startAction = Sprite_NewActor.prototype.startAction;
    Sprite_NewActor.prototype.startAction = function(skillId, actionInfo, judgment, buttonSprite) {
        var action = _startAction.call(this, skillId, actionInfo, judgment, buttonSprite);
        if (!isYume(this) || action.test) return action;
        var hasArmOut = action.list.some(function(line) { return /^\s*yumeArmOut\s*:/.test(line); });
        if (!hasArmOut) return action;
        var manager = this._yumeArmManager || (this._yumeArmManager = new YumeArmManager(this));
        action._yumeSequence = ++manager.nextSequence;
        manager.latestSequenceBySkill[String(skillId)] = action._yumeSequence;
        var arm = manager.armFor(skillId);
        if (arm) {
            arm.ownerSequence = action._yumeSequence;
            if (arm.phase === 'pending' || arm.phase === 'retracting') {
                arm.phase = 'active';
                arm.grace = 0;
                arm.fromPoints = arm.toPoints = null;
                arm.stopMoveSe();
            }
        }
        return action;
    };

    Sprite_NewActor.prototype.keepAnimationOnActionStart = function() {
        return isYume(this) && this._yumeArmManager && this._yumeArmManager.hasArms();
    };

    Sprite_NewActor.prototype.processExtraActionCommand = function(name, args, action, isLast) {
        if (!Object.prototype.hasOwnProperty.call(COMMAND_HINTS, name)) return false;
        var parsed = parseActionCommand(name, args);
        if (!parsed) return true;
        if (name !== 'yumeArmAnimation') {
            var duration = name === 'yumeArmIn' ? parsed.grace + parsed.duration : parsed.duration;
            if (parsed.wait || isLast) action.wait = duration;
        }
        if (!isYume(this) || action.test) return true;
        var manager = this._yumeArmManager || (this._yumeArmManager = new YumeArmManager(this));
        // Effects already queued by an earlier action keep their own timing.
        if (name !== 'yumeArmAnimation' && action._yumeSequence &&
            action._yumeSequence < (manager.latestSequenceBySkill[String(action.skillId)] || 0)) return true;
        var arm = name === 'yumeArmOut' ? manager.ensureArm(action.skillId, parsed.weapon) :
            manager.armFor(action.skillId);
        if (!arm) return true;
        if (!action._yumeSequence) action._yumeSequence = ++manager.nextSequence;
        if (name !== 'yumeArmOut' && name !== 'yumeArmAnimation' &&
            arm.ownerSequence !== action._yumeSequence) return true;
        if (name === 'yumeArmOut') {
            if (arm.ownerSequence > action._yumeSequence) return true;
            var outTarget = this.targetSprite && this.targetSprite();
            var outPoint = manager.enemyCenterLocal(outTarget, 0, 0);
            arm.out(parsed.weapon, parsed.pose, parsed.x, parsed.y, parsed.duration,
                action._yumeSequence, outPoint);
        } else if (name === 'yumeArmMove') {
            var moveTarget = this.targetSprite && this.targetSprite();
            var movePoint = manager.enemyCenterLocal(moveTarget, 0, 0);
            arm.move(parsed.pose, parsed.x, parsed.y, parsed.duration, movePoint);
        } else if (name === 'yumeArmMoveToTarget') {
            var target = this.targetSprite && this.targetSprite();
            var point = manager.enemyCenterLocal(target, parsed.x, parsed.y);
            if (point) arm.moveToTarget(point, parsed.duration);
        } else if (name === 'yumeArmWeaponAnime') {
            arm.setWeapon(parsed.weapon);
            arm.restartWeaponAnimation(parsed.duration);
        } else if (name === 'yumeArmAnimation') {
            manager.playAnimationAtWeapon(arm, parsed.id, parsed.x, parsed.y, parsed.mirror);
        } else if (name === 'yumeArmIn') {
            arm.scheduleIn(parsed.grace, parsed.duration);
        }
        return true;
    };

    var _updateActor = Sprite_NewActor.prototype.update;
    Sprite_NewActor.prototype.update = function() {
        _updateActor.call(this);
        if (this._yumeArmManager) this._yumeArmManager.update();
    };

    Sprite_NewActor.prototype.clearYumeArms = function() {
        if (!this._yumeArmManager) return;
        this._yumeArmManager.clear();
        if (isYume(this) && this._animationType === this.getAnimationType('attack1'))
            this.setAnimation('', true);
    };

    var _terminateBattle = Scene_NewBattle.prototype.terminate;
    var _updateVictory = Scene_NewBattle.prototype.updateVictory;
    Scene_NewBattle.prototype.updateVictory = function() {
        if (BattleManager._phase === 'battleEnd' && this._actorSprites) {
            this._actorSprites.forEach(function(sprite) {
                if (sprite && sprite.clearYumeArms) sprite.clearYumeArms();
            });
        }
        return _updateVictory.call(this);
    };

    Scene_NewBattle.prototype.terminate = function() {
        if (this._actorSprites) this._actorSprites.forEach(function(sprite) {
            if (sprite && sprite.clearYumeArms) sprite.clearYumeArms();
        });
        _terminateBattle.call(this);
    };
})();
