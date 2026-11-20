//=============================================================================
// KNH_ZXC_Battle_Yume.js
//=============================================================================

/*:
 * @plugindesc Yume's independent battle arms and weapons.
 * @author kagaya
 *
 * @help
 * Place this plugin after KNH_ZXC_Battle and before KNH_ZXC_SkillEditor.
 * Actor 4 uses battler sheets 003 and 003_1. Each skill ID owns one weapon rig.
 * Multiple skills can keep their arms on screen at the same time.
 *
 * Inside a skill's <animation: ... > note:
 *   yumeArmOut:gun1,random,12,wait
 *   yumeArmMove:random,8,wait
 *   yumeArmMoveToTarget:0,-16,12,wait
 *   yumeArmWeaponAnime:attack2,16
 *   yumeArmAnimation:12,16,-4,mirror
 *   yumeArmIn:8,10
 *
 * Cannon (003_1, row 1):
 *   yumeArmOut:cannon,overhead,36,wait
 *   yumeArmWeaponAnime:cannon,36
 *   wait:6
 *   playSe:Explosion2,30,92
 *   yumeArmBullet:artilleryShell,36,wait
 *   apply
 *   wait:24
 *   yumeArmIn:8,36
 * Cannon waits on cell 1 with yurayura, plays cells 1..6 once when fired,
 * then loops cells 4..6. Before packing, it returns to cell 1 with yurayura.
 * Smoke cells 4..6 use the regular yurayura interval, independently of firing.
 * Cell 1 keeps yurayura while moving or starting fire. The deployed arm keeps
 * swaying through firing and smoke; the other body cells use their authored poses.
 * Bullet launches from the current weapon muzzle, including its recoil,
 * and follows an arc toward the current enemy over the given flight frames.
 * Put apply immediately after a waiting Bullet command to hit on arrival.
 * Drill (003_1, row 2):
 *   yumeArmOut:drill,targetUpperLeft,30,wait
 *   yumeArmDrill:60,24,apply,wait
 *   yumeArmIn:6,36
 * Drill idles on cells 1..3 and cuts on cells 4..6. Drill arguments are
 * duration in game frames and forward travel in battle-screen pixels.
 * Cutting shakes horizontally by one battle-screen pixel and stops after
 * the requested duration, including its sound. The return uses idle cells.
 * A drill deployed toward targetUpperLeft emerges upward, then curves toward
 * the enemy's upper-left side in one continuous movement without a waypoint stop.
 * The optional apply flag applies damage on the exact tick cutting starts.
 * Flamethrower (003_1, row 3):
 *   yumeArmOut:flamethrower,targetLeft,36,wait
 *   yumeArmFlame:60,apply,wait
 *   yumeArmIn:6,36
 * Two arm tips follow the nozzle-base and tank-top circles. The body loops
 * cells 1..3 independently; flame enters through 4..5, loops 5..7, and exits
 * through 8. apply hits once on visible flame contact, including timing probes.
 * The body quickly grows from 50% storage size and shrinks on return.
 * It is stored nozzle-up, turning sideways after emergence and upright on return.
 * Charge cannon (003_1, row 4):
 *   yumeArmOut:chargeCannon,overhead,10,56,36,wait
 *   yumeArmCharge:36
 *   waitRelease
 *   yumeArmChargeShot:chargedShot,18,apply,wait
 *   wait:12
 *   yumeArmIn:6,36
 * Body cells 1..3 and charge cells 4..6 loop independently. The charge grows
 * from 0.5 to 1.5, holds at maximum, and transfers its visible diameter to
 * the projectile on release. apply hits once on actual projectile impact.
 * Charge growth, weapon poses, flight and impact share a six-frame cadence.
 * At maximum charge, a quiet owned loop continues until release or cancellation.
 * Machine gun (003_1, row 5):
 *   yumeArmMachineGun
 * One large attack fires all five belt rounds automatically, then packs upright.
 * Shots are 6f apart and apply damage 6f after the shared gun animation 54.
 * Gatling (003_1, row 6): <rush> and yumeArmGatling.
 * Each rush press queues one shot. The six-link arm zigzags near the backpack;
 * its upper links form a simple hanger over the top circle.
 * Cells 1..3 are idle. Rotation follows 4,5,6,5 to avoid holding the matching
 * barrel poses at 6 and 4 across the loop seam. Only firing displays rotation;
 * gaps between shots use the idle cells, with no empty startup or coast.
 * Homing missile (003_1, row 7):
 *   yumeArmOut:missile,overhead,-60,36,36,wait
 *   wait:12
 *   yumeArmMissile:66,apply,wait
 *   yumeArmIn:6,36
 * The compact zigzag rear arm holds a launcher stored upright at 50% size. Body cells
 * 1..3 idle; 4..6 play once with recoil on launch. The missile rises first,
 * makes two searching detours above the enemy, then descends into the live target.
 * Translation, steering and subtle yaw all share six-frame poses.
 * apply hits once at contact. wait follows actual flight, not a damage timer.
 * The projectile's lower six cells explode while the launcher packs away.
 * Out/move pose: random, or overhead for a fixed position above Yume.
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
 * Arm movement shares one sound across all rigs. A new movement sound stops
 * the previous one; drilling, charging, spraying and firing stay independent.
 * Moving arm geometry and rotor cells supply their own poses. Static gun art
 * keeps yurayura during transport; both flamethrower arms sway while spraying.
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
    var GATLING_LINK_LENGTH = 20;
    var MOTION_STEP_FRAMES = 6;
    var WEAPON_FRAME_FRAMES = 8;
    var DEFAULT_WEAPON_DURATION = WEAPON_FRAME_FRAMES * 2;
    var ARM_YURA_INFO = [10, 8, 8, true];
    var WEAPON_CLEARANCE = 6;
    var MOVE_SE_NAME = 'Machine';
    var MOVE_SE_VOLUME = 8;
    var MOVE_SE_PITCH_MIN = 96;
    var MOVE_SE_PITCH_RANGE = 9;
    var movementSeArm = null;
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
            shotSe: { name: '00_shot1', volume: 24, pitch: 106 },
            hitSe: { name: 'Blow1', volume: 14, pitch: 112 },
            rotor: { x: 66, y: 49, w: 38, h: 34 },
            barrel: { x: 67, y: 60, w: 31, h: 22 }
        },
        gun2: {
            row: 9,
            shotSe: { name: '00_shot1', volume: 26, pitch: 96 },
            hitSe: { name: 'Blow1', volume: 15, pitch: 104 },
            rotor: { x: 54, y: 41, w: 47, h: 39 },
            barrel: { x: 67, y: 59, w: 39, h: 23 }
        },
        cannon: {
            sheet: 1,
            row: 0,
            sequence: { x: 0, y: 0, w: CELL, h: CELL },
            bounds: { x: 61, y: 23, w: 63, h: 63 },
            muzzle: { x: 108, y: 60.5 },
            axis: -Math.atan2(16, 42),
            cells: 6,
            loopStart: 3,
            loopFrameWait: ARM_YURA_INFO[2],
            duration: 36,
            retractScale: 0.5,
            retractAngle: -Math.PI / 2 + Math.atan2(16, 42),
            impactSe: { name: 'Explosion1', volume: 30, pitch: 88 }
        },
        drill: {
            sheet: 1,
            row: 1,
            sequence: { x: 64, y: 64, w: 60, h: 52 },
            pivot: { x: 76, y: 80 },
            axis: Math.atan2(30, 28),
            cells: 6,
            idleCells: [0, 1, 2],
            activeCells: [3, 4, 5],
            frontOfTarget: true,
            frameWait: 6,
            duration: 60,
            cuttingSe: { name: '00_drill', volume: 42, pitch: 96 }
        },
        machineGun: {
            sheet: 1, row: 4,
            sequence: { x: 0, y: 0, w: CELL, h: CELL },
            bounds: { x: 63, y: 54, w: 63, h: 37 },
            pivot: { x: 73, y: 76 }, muzzle: { x: 124, y: 65 },
            cells: 3, idleCells: [0, 1, 2], frameWait: 6, machineGun: true,
            belt: { x: 86, y: 78, w: 16, h: 12, step: 3, links: 5,
                head: { x: 86, y: 75, w: 10, h: 3 } },
            burst: 5, deployFrames: 20, retractFrames: 30, shotVolume: 12, shotPitch: 96,
            packedAngle: -Math.PI / 2,
            moveSe: { name: 'Equip1', volume: 18, pitch: 90 }
        },
        gatling: {
            sheet: 1, row: 5,
            sequence: { x: 0, y: 0, w: CELL, h: CELL },
            bounds: { x: 27, y: 52, w: 100, h: 47 },
            pivot: { x: 49, y: 58 }, muzzle: { x: 126, y: 75 },
            cells: 6, idleCells: [0, 1, 2], activeCells: [3, 4, 5, 4],
            frameWait: 6, machineGun: true,
            deployFrames: 36, retractFrames: 36, shotVolume: 9, shotPitch: 106,
            staging: { pose: 'overhead', x: -36, y: 20 },
            packedScale: 0.5, packedAngle: -Math.PI / 2,
            moveSe: { name: 'Equip1', volume: 18, pitch: 84 }
        },
        missile: {
            sheet: 1, row: 6,
            sequence: { x: 0, y: 0, w: CELL, h: CELL },
            bounds: { x: 23, y: 24, w: 92, h: 60 },
            pivot: { x: 27, y: 62 }, muzzle: { x: 110, y: 43 },
            axis: -Math.atan2(19, 83),
            cells: 6, idleCells: [0, 1, 2], activeCells: [3, 4, 5], frameWait: 6,
            packedScale: 0.5, packedAngle: -Math.PI / 2 + Math.atan2(19, 83),
            moveSe: { name: 'Equip1', volume: 18, pitch: 88 },
            shotSe: { name: 'Launch', volume: 18, pitch: 108 },
            impactSe: { name: 'Explosion1', volume: 24, pitch: 108 }
        },
        chargeCannon: {
            sheet: 1, row: 3,
            sequence: { x: 0, y: 0, w: CELL, h: CELL },
            bounds: { x: 68, y: 36, w: 50, h: 41 },
            pivot: { x: 73, y: 74 }, muzzle: { x: 120, y: 54 },
            cells: 6, idleCells: [0, 1, 2], chargeCells: [3, 4, 5],
            frameWait: 6, duration: 36, chargeDiameter: 44,
            packedScale: 0.5, packedAngle: -Math.PI / 2,
            moveSe: { name: 'Equip1', volume: 18, pitch: 88 },
            chargeSe: { name: 'Magic1', volume: 18, pitch: 90 },
            holdSe: { name: 'YumeChargeHold', volume: 12, pitch: 100 },
            shotSe: { name: 'Shot2', volume: 26, pitch: 88 },
            impactSe: { name: 'Thunder3', volume: 18, pitch: 112 }
        },
        flamethrower: {
            sheet: 1, row: 2,
            sequence: { x: 0, y: 0, w: CELL, h: CELL },
            bounds: { x: 4, y: 64, w: 139, h: 58 },
            cells: 8, idleCells: [0, 1, 2], frameWait: 6,
            muzzle: { x: 142, y: 69 },
            support: { x: 24, y: 80 },
            separateFlame: true, flameScale: 0.75, frontOfTarget: true, duration: 60,
            spraySe: { name: 'Fire2', volume: 16, pitch: 96 },
            packedScale: 0.5, packedAngle: -Math.PI / 2,
            flameBounds: [
                { x: 0, y: 63, w: 28, h: 20 },
                { x: 0, y: 53, w: 141, h: 33 },
                { x: 0, y: 54, w: 138, h: 33 },
                { x: 0, y: 51, w: 137, h: 35 },
                { x: 28, y: 56, w: 107, h: 29 }
            ]
        }
    };

    function animationWithSe(source, se) {
        if (!source || !se || !(source.timings || []).some(function(timing) {
            return timing.se && timing.se.name;
        })) return source;
        var animation = Object.assign({}, source);
        animation.timings = (source.timings || []).map(function(timing) {
            var copy = Object.assign({}, timing);
            if (timing.se && timing.se.name) copy.se = Object.assign({}, timing.se, se);
            return copy;
        });
        return animation;
    }

    NS.damageAnimation = function(subject, skill, animation) {
        if (!isYume(subject)) return animation;
        var manager = subject._yumeArmManager, arm = manager && manager.armFor(skill.id);
        return animationWithSe(animation, arm && WEAPONS[arm.weapon].hitSe);
    };

    NS.playLoopSe = function(se) {
        var buffer = AudioManager.createBuffer('se', se.name);
        AudioManager.updateSeParameters(buffer, se);
        buffer.play(true);
        AudioManager._seBuffers.push(buffer);
        return buffer;
    };
    var COMMAND_HINTS = {
        yumeArmOut: 'gun1/gun2/cannon/drill/flamethrower/chargeCannon/machineGun/gatling/missile, random/overhead/targetUpperLeft/targetLeft, [X offset, Y offset,] frames, [wait]',
        yumeArmMove: 'random/overhead/targetUpperLeft/targetLeft, [X offset, Y offset,] frames, [wait]',
        yumeArmMoveToTarget: '[X offset, Y offset,] frames, [wait]',
        yumeArmWeaponAnime: 'gun1/gun2/cannon/drill/flamethrower/chargeCannon/machineGun/gatling/missile, [frames], [wait]',
        yumeArmDrill: 'positive duration frames, forward distance in screen pixels, [apply], [wait]',
        yumeArmFlame: 'spray frames (at least 12), [apply], [wait]',
        yumeArmCharge: 'positive frames to reach full charge',
        yumeArmChargeShot: 'chargedShot, flight frames (at least 2), [apply], [wait]',
        yumeArmMachineGun: 'no arguments; fire one full automatic belt burst',
        yumeArmGatling: 'no arguments; queue one gatling shot per rush press',
        yumeArmMissile: 'nominal flight frames (24..120, multiple of 6), [apply], [wait for contact]',
        yumeArmBullet: 'bullet image name, flight frames (at least 2), [wait]',
        yumeArmAnimation: 'database animation ID, [X offset, Y offset,] [mirror]',
        yumeArmIn: 'grace frames, retract frames, [wait]'
    };
    NS.actionHints = COMMAND_HINTS;
    NS.poseNames = ['random', 'overhead', 'targetUpperLeft', 'targetLeft'];
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
        if (value === 'cannon' || value === 'attack4') return 'cannon';
        if (value === 'drill' || value === 'attack5') return 'drill';
        if (value === 'flamethrower' || value === 'attack6') return 'flamethrower';
        if (value === 'chargeCannon' || value === 'attack7') return 'chargeCannon';
        if (value === 'machineGun' || value === 'attack8') return 'machineGun';
        if (value === 'gatling' || value === 'attack9') return 'gatling';
        if (value === 'missile' || value === 'attack10') return 'missile';
        return null;
    }

    function weaponRects(info) {
        // Layout bounds never crop the rendered cell or its animated smoke.
        if (info.bounds) return [info.bounds];
        return info.sequence ? [info.sequence] : [info.rotor, info.barrel];
    }

    function weaponPivot(info) {
        return info.pivot || { x: CELL / 2, y: CELL / 2 };
    }

    function clearSheetGuides(bitmap) {
        // The artist's translucent actor guides must not travel with a weapon.
        var context = bitmap._context;
        var pixels = context.getImageData(0, 0, bitmap.width, bitmap.height);
        for (var i = 0; i < pixels.data.length; i += 4) {
            if (pixels.data[i + 3] < 128) pixels.data[i + 3] = 0;
        }
        context.putImageData(pixels, 0, 0);
    }

    function transformedBounds(rect, transform) {
        var result = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
        [rect.x, rect.x + rect.w].forEach(function(x) {
            [rect.y, rect.y + rect.h].forEach(function(y) {
                var point = transform({ x: x, y: y });
                result.left = Math.min(result.left, point.x);
                result.top = Math.min(result.top, point.y);
                result.right = Math.max(result.right, point.x);
                result.bottom = Math.max(result.bottom, point.y);
            });
        });
        return result;
    }

    function enemyOpaqueBounds(manager, target) {
        var bitmap = target && (target._baseBitmap || target.bitmap), frame = target && target._frame;
        if (bitmap && bitmap.isReady() && frame && frame.width > 0 && frame.height > 0 && bitmap._context) {
            var key = [frame.x, frame.y, frame.width, frame.height].join(',');
            var cache = bitmap._yumeHitBounds || (bitmap._yumeHitBounds = Object.create(null));
            if (!Object.prototype.hasOwnProperty.call(cache, key)) {
                var data = bitmap._context.getImageData(frame.x, frame.y, frame.width, frame.height).data;
                var left = frame.width, top = frame.height, right = -1, bottom = -1;
                for (var i = 3; i < data.length; i += 4) {
                    if (data[i] < 128) continue;
                    var pixel = (i - 3) / 4, x = pixel % frame.width, y = Math.floor(pixel / frame.width);
                    left = Math.min(left, x); top = Math.min(top, y);
                    right = Math.max(right, x); bottom = Math.max(bottom, y);
                }
                cache[key] = right >= left ? { x: left, y: top, w: right - left + 1, h: bottom - top + 1 } : null;
            }
            var bounds = cache[key];
            if (bounds) return transformedBounds({
                x: bounds.x - target.anchor.x * frame.width,
                y: bounds.y - target.anchor.y * frame.height, w: bounds.w, h: bounds.h
            }, function(point) { return target.toGlobal(point); });
        }
        var center = manager.enemyCenterLocal(target, 0, 0);
        if (!center) return null;
        var global = manager.owner.toGlobal(center);
        return { left: global.x, right: global.x, top: global.y, bottom: global.y };
    }

    function newMissileFlight(launch, target, duration) {
        var dx = target.x - launch.x, dy = target.y - launch.y;
        var distance = Math.max(1, Math.hypot(dx, dy)), pace = distance / duration;
        var rise = Math.min(60, Math.max(24, distance * 0.18));
        var sky = Math.min(launch.y, target.bounds.top);
        return { x: launch.x, y: launch.y, angle: launch.angle, heading: launch.angle, elapsed: 0,
            speed: pace * 0.35, acceleration: pace * 0.18, topSpeed: pace * 1.5,
            searchSpeed: pace * 0.95, duration: duration, detourIndex: 0,
            detours: [
                { x: launch.x + dx * 0.4, y: sky - rise },
                { x: launch.x + dx * 0.46, y: sky - rise * 0.35 }
            ],
            limit: duration * 3, hit: false };
    }

    function segmentBoundsContact(from, to, bounds) {
        var enter = 0, leave = 1;
        var axes = [['x', 'left', 'right'], ['y', 'top', 'bottom']];
        for (var i = 0; i < axes.length; i++) {
            var axis = axes[i], delta = to[axis[0]] - from[axis[0]];
            if (Math.abs(delta) < 1e-9) {
                if (from[axis[0]] < bounds[axis[1]] || from[axis[0]] > bounds[axis[2]]) return null;
            } else {
                var a = (bounds[axis[1]] - from[axis[0]]) / delta;
                var b = (bounds[axis[2]] - from[axis[0]]) / delta;
                enter = Math.max(enter, Math.min(a, b));
                leave = Math.min(leave, Math.max(a, b));
                if (enter > leave) return null;
            }
        }
        return { x: from.x + (to.x - from.x) * enter, y: from.y + (to.y - from.y) * enter };
    }

    function stepMissileFlight(state, target) {
        state.elapsed += MOTION_STEP_FRAMES;
        var guide = state.detours[state.detourIndex];
        if (guide && (Math.hypot(guide.x - state.x, guide.y - state.y) < Math.max(24, state.searchSpeed * 6) ||
            state.elapsed >= state.duration * (state.detourIndex === 0 ? 0.55 : 1.65)))
            guide = state.detours[++state.detourIndex];
        var turn = 0;
        if (state.elapsed > MOTION_STEP_FRAMES * 2) {
            var aim = guide || target;
            var desired = Math.atan2(aim.y - state.y, aim.x - state.x);
            turn = shortestAngleDelta(state.angle, desired);
            state.angle += Math.max(-0.55, Math.min(0.55, turn));
        }
        // Ease through wide searching turns, then accelerate into the live target.
        var speedLimit = guide ? state.searchSpeed : state.topSpeed;
        if (Math.abs(turn) > 0.7) speedLimit *= 0.65;
        state.speed = Math.min(speedLimit, state.speed + state.acceleration);
        // A gentle yaw shares the flight poses and the actual contact path.
        var sway = Math.sin(state.elapsed * Math.PI / 24) * 0.065 * Math.min(1, state.elapsed / 12);
        state.heading = state.angle + sway;
        var next = { x: state.x + Math.cos(state.heading) * state.speed * MOTION_STEP_FRAMES,
            y: state.y + Math.sin(state.heading) * state.speed * MOTION_STEP_FRAMES };
        var contact = segmentBoundsContact(state, next, target.bounds);
        if (contact && target.pixelContact) {
            contact = null;
            var samples = Math.max(1, Math.ceil(Math.hypot(next.x - state.x, next.y - state.y)));
            for (var sample = 0; sample <= samples; sample++) {
                var point = { x: state.x + (next.x - state.x) * sample / samples,
                    y: state.y + (next.y - state.y) * sample / samples };
                if (target.pixelContact(point)) { contact = point; break; }
            }
        }
        state.x = contact ? contact.x : next.x;
        state.y = contact ? contact.y : next.y;
        state.hit = !!contact;
        return state.hit;
    }

    function flameTouches(arm, cell) {
        var info = WEAPONS.flamethrower, manager = arm.manager;
        var target = manager.owner.targetSprite && manager.owner.targetSprite();
        var enemy = enemyOpaqueBounds(manager, target);
        if (!enemy) return false;
        var rect = info.flameBounds[cell - 3];
        var source = manager.owner._bitmaps && manager.owner._bitmaps[info.sheet];
        if (source && source.isReady && !source.isReady()) return false;
        if (source && source.isReady && source._context) {
            var cache = source._yumeFlameBounds || (source._yumeFlameBounds = Object.create(null));
            if (!Object.prototype.hasOwnProperty.call(cache, cell)) {
                var data = source._context.getImageData(cell * CELL, info.row * CELL, CELL, CELL).data;
                var left = CELL, top = CELL, right = -1, bottom = -1;
                for (var i = 3; i < data.length; i += 4) {
                    if (data[i] < 128) continue;
                    var pixel = (i - 3) / 4, x = pixel % CELL, y = Math.floor(pixel / CELL);
                    left = Math.min(left, x); top = Math.min(top, y);
                    right = Math.max(right, x); bottom = Math.max(bottom, y);
                }
                cache[cell] = right >= left ? { x: left, y: top, w: right - left + 1, h: bottom - top + 1 } : null;
            }
            rect = cache[cell];
            if (!rect) return false;
        }
        var tip = arm.points[arm.points.length - 1], pivot = weaponPivot(info);
        var cos = Math.cos(arm.angle), sin = Math.sin(arm.angle);
        var flame = transformedBounds(rect, function(point) {
            var scale = finiteNumber(arm.weaponScale) ? arm.weaponScale : 1;
            var x = (info.muzzle.x - pivot.x + point.x * info.flameScale) * scale;
            var y = (info.muzzle.y - pivot.y + (point.y - CELL / 2) * info.flameScale) * scale;
            return manager.owner.toGlobal({ x: tip.x + x * cos - y * sin, y: tip.y + x * sin + y * cos });
        });
        return flame.left <= enemy.right && flame.right >= enemy.left &&
            flame.top <= enemy.bottom && flame.bottom >= enemy.top;
    }

    function copyPoints(points) {
        return points.map(function(point) { return { x: point.x, y: point.y }; });
    }

    function resizeArmPoints(points, count) {
        if (points.length === count) return copyPoints(points);
        var distances = [0];
        for (var i = 1; i < points.length; i++) distances.push(distances[i - 1] +
            Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
        var result = [], segment = 1;
        for (var index = 0; index < count; index++) {
            var distance = distances[distances.length - 1] * index / (count - 1);
            while (segment < points.length - 1 && distances[segment] < distance) segment++;
            var from = points[segment - 1], to = points[segment];
            var span = distances[segment] - distances[segment - 1];
            var t = span > 0 ? (distance - distances[segment - 1]) / span : 0;
            result.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
        }
        return result;
    }

    function foldedPoints(weapon, linkLength) {
        if (weapon === 'gatling') {
            var length = linkLength || GATLING_LINK_LENGTH, rise = (length + 20) / 4;
            var width = Math.sqrt(length * length - rise * rise), folded = [];
            for (var i = 0; i <= 4; i++) folded.push({
                x: ROOT.x + (i % 2 ? width : 0), y: ROOT.y + rise * i
            });
            folded.push({ x: ROOT.x, y: ROOT.y + 20 });
            return folded;
        }
        var points = FOLD.map(function(offset) {
            return { x: ROOT.x + offset.x, y: ROOT.y + offset.y };
        });
        return points;
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

    function smoothStep(t) {
        t = Math.max(0, Math.min(1, t));
        return t * t * (3 - 2 * t);
    }

    function gatlingPackProgress(elapsed, duration) {
        var packAt = duration * 0.5;
        var shrinkFrames = Math.min(MOTION_STEP_FRAMES, packAt);
        return duration > 0 ? smoothStep((elapsed - packAt + shrinkFrames) /
            Math.max(1, shrinkFrames)) : 1;
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

    function drillDeployCurve(end) {
        var side = end.x >= ROOT.x ? 1 : -1;
        var rise = Math.min(BACKPACK_TOP.y - 12, ROOT.y - 60);
        return [ROOT, { x: ROOT.x, y: rise }, {
            x: end.x - side * Math.min(48, Math.abs(end.x - ROOT.x) * 0.35),
            y: Math.min(end.y - 60, rise - 12)
        }, end];
    }

    function cubicPoint(points, progress) {
        var t = progress, u = 1 - t;
        var weights = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
        var point = { x: 0, y: 0 };
        for (var i = 0; i < 4; i++) {
            point.x += points[i].x * weights[i];
            point.y += points[i].y * weights[i];
        }
        return point;
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
        if (NS.poseNames.indexOf(pose) < 0 || (parts.length !== 1 && parts.length !== 3)) return null;
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

    function parseDrillArgs(args) {
        var parts = args.slice();
        var wait = parts[parts.length - 1] === 'wait';
        if (wait) parts.pop();
        var apply = parts[parts.length - 1] === 'apply';
        if (apply) parts.pop();
        if (parts.length !== 2 || !nonnegativeInteger(parts[0]) || parts[0] === 0 ||
            !finiteNumber(parts[1]) || parts[1] < 0) return null;
        return { duration: parts[0], distance: parts[1], apply: apply, wait: wait };
    }

    function parseBulletArgs(args) {
        var parts = args.slice();
        var wait = parts[parts.length - 1] === 'wait';
        if (wait) parts.pop();
        if (parts.length !== 2 || typeof parts[0] !== 'string' || !parts[0].trim() ||
            !nonnegativeInteger(parts[1]) || parts[1] < 2) return null;
        return { image: parts[0].trim(), duration: parts[1], wait: wait };
    }

    function parseFlameArgs(args) {
        var parts = args.slice();
        var wait = parts[parts.length - 1] === 'wait';
        if (wait) parts.pop();
        var apply = parts[parts.length - 1] === 'apply';
        if (apply) parts.pop();
        if (parts.length !== 1 || !nonnegativeInteger(parts[0]) || parts[0] < 12) return null;
        return { burnFrames: parts[0], duration: parts[0] + 6, apply: apply, wait: wait };
    }

    function parseChargeArgs(args) {
        if (args.length !== 1 || !nonnegativeInteger(args[0]) || args[0] === 0) return null;
        return { duration: args[0] };
    }

    function parseChargeShotArgs(args) {
        var parts = args.slice();
        var wait = parts[parts.length - 1] === 'wait';
        if (wait) parts.pop();
        var apply = parts[parts.length - 1] === 'apply';
        if (apply) parts.pop();
        if (parts.length !== 2 || parts[0] !== 'chargedShot' ||
            !nonnegativeInteger(parts[1]) || parts[1] < 2) return null;
        return { image: parts[0], duration: parts[1], apply: apply, wait: wait };
    }

    function parseWeaponAnimeArgs(args) {
        var parts = args.slice();
        var wait = parts[parts.length - 1] === 'wait';
        if (wait) parts.pop();
        if (parts.length < 1 || parts.length > 2) return null;
        var weapon = weaponName(parts[0]);
        if (!weapon) return null;
        var duration = parts.length === 2 ? parts[1] :
            (WEAPONS[weapon].duration || DEFAULT_WEAPON_DURATION);
        if (!nonnegativeInteger(duration)) return null;
        return { weapon: weapon, duration: duration, wait: wait };
    }

    function parseMissileArgs(args) {
        var parts = args.slice();
        var wait = parts[parts.length - 1] === 'wait';
        if (wait) parts.pop();
        var apply = parts[parts.length - 1] === 'apply';
        if (apply) parts.pop();
        if (parts.length !== 1 || !nonnegativeInteger(parts[0]) ||
            parts[0] < 24 || parts[0] > 120 || parts[0] % MOTION_STEP_FRAMES) return null;
        return { duration: parts[0], apply: apply, wait: wait };
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
        case 'yumeArmDrill': return parseDrillArgs(args);
        case 'yumeArmBullet': return parseBulletArgs(args);
        case 'yumeArmFlame': return parseFlameArgs(args);
        case 'yumeArmCharge': return parseChargeArgs(args);
        case 'yumeArmChargeShot': return parseChargeShotArgs(args);
        case 'yumeArmMachineGun':
        case 'yumeArmGatling':
            // The battle interpreter converts a missing argument to numeric zero.
            return args.length === 0 || args.length === 1 && (args[0] === 0 || String(args[0]).trim() === '') ?
                { duration: 0 } : null;
        case 'yumeArmMissile': return parseMissileArgs(args);
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
        this.points = foldedPoints(weapon);
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
        this.unfoldDirect = false;
        this.retractingViaTop = false;
        this.retractTrim = 0;
        this.grace = 0;
        this.retractDuration = 0;
        this.useCount = 0;
        this.wigglePhase = 0;
        this.wiggleAmplitude = 0;
        this.weaponElapsed = 0;
        this.weaponDuration = 0;
        this.weaponFiring = false;
        this.idleElapsed = 0;
        this.drillMotion = null;
        this.drillShakeX = 0;
        this.flameMotion = null;
        this.flameFrame = -1;
        this.chargeMotion = null;
        this.chargeScale = 0.5;
        this.chargeFrame = -1;
        this.recoilMotion = null;
        this.machineGunMotion = null;
        this.machineBeltUsed = 0;
        this.beltBitmaps = null;
        this.supportPoints = null;
        this.weaponScale = 1;
        this.fromWeaponScale = 1;
        this.sequenceBitmaps = null;
        this.sequenceFrame = -1;
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
        this.flameSprite = new Sprite();
        this.flameSprite.visible = false;
        this.flameSprite.anchor.set(0, 0.5);
        this.weaponRoot.addChild(this.flameSprite);
        this.chargeSprite = new Sprite();
        this.chargeSprite.visible = false;
        this.chargeSprite.anchor.set(0.5, 0.5);
        this.weaponRoot.addChild(this.chargeSprite);
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
        var info = WEAPONS[this.weapon];
        var bodyYura = this.weapon === 'cannon' ? this.sequenceFrame === 0 :
            !info.sequence ? this.weaponElapsed >= this.weaponDuration : enabled;
        // Authored multi-cell idle loops already supply their own hand-drawn wobble.
        setSpriteYuraEnabled(this.barrelSprite, bodyYura && this.barrelSprite.visible &&
            !info.idleCells);
    };

    YumeArm.prototype.updateYuraState = function() {
        // Stationary spraying and charging arms sway; moving geometry supplies poses.
        this.setYuraEnabled(!this.toPoints && (this.weapon === 'cannon' || this.flameMotion || this.chargeMotion ||
            this.machineGunMotion && !this.machineGunMotion.closing ||
            !this.weaponFiring && this.weaponElapsed >= this.weaponDuration));
    };

    YumeArm.prototype.setWeapon = function(name) {
        if (name === this.weapon) return;
        this.stopDrill();
        this.stopFlame();
        this.stopCharge();
        this.stopRecoil();
        this.stopMachineGun();
        setSpriteYuraEnabled(this.barrelSprite, false);
        this.weapon = name;
        var info = WEAPONS[name];
        this.machineBeltUsed = 0;
        this.beltBitmaps = null;
        if (!info.packedScale) {
            this.weaponScale = 1;
            this.weaponRoot.scale.x = this.weaponRoot.scale.y = 1;
        }
        var sheet = info.sheet || 0;
        var bitmap = this.manager.owner._bitmaps && this.manager.owner._bitmaps[sheet];
        if (!bitmap) bitmap = ImageManager.loadSvActor(this.manager.owner._battler.battlerName() +
            (sheet ? '_' + sheet : ''));
        this.weaponFiring = false;
        this.idleElapsed = 0;
        this.sequenceBitmaps = null;
        this.sequenceFrame = -1;
        if (info.sequence) {
            var frame = info.sequence;
            var cachedSequence = this.manager.sequenceBitmaps[name];
            if (!cachedSequence || cachedSequence.source !== bitmap) {
                var cells = [];
                for (var cell = 0; cell < info.cells; cell++) cells.push(new Bitmap(frame.w, frame.h));
                var beltCells = info.belt ? [cells] : null;
                if (beltCells) {
                    for (var used = 1; used <= info.belt.links; used++) {
                        var variants = [];
                        for (var index = 0; index < info.cells; index++) variants.push(new Bitmap(frame.w, frame.h));
                        beltCells.push(variants);
                    }
                }
                cachedSequence = { source: bitmap, cells: cells, beltCells: beltCells };
                this.manager.sequenceBitmaps[name] = cachedSequence;
                bitmap.addLoadListener(function() {
                    cells.forEach(function(cropped, index) {
                        cropped.smooth = false;
                        cropped.blt(bitmap, CELL * index + frame.x, info.row * CELL + frame.y,
                            frame.w, frame.h, 0, 0);
                        clearSheetGuides(cropped);
                        cropped._setDirty();
                        cropped.checkDirty();
                    });
                    if (beltCells) {
                        beltCells.forEach(function(variants, used) {
                            if (!used) return;
                            var belt = info.belt, cutHeight = Math.min(belt.h, used * belt.step);
                            variants.forEach(function(cropped, index) {
                                cropped.smooth = false;
                                cropped.blt(cells[index], 0, 0, frame.w, frame.h, 0, 0);
                                // The final round clears the narrow feed segment without touching the receiver.
                                cropped._context.clearRect(belt.x, belt.y + belt.h - cutHeight, belt.w, cutHeight);
                                if (used === belt.links && belt.head) {
                                    var head = belt.head;
                                    cropped._context.clearRect(head.x, head.y, head.w, head.h);
                                }
                                cropped._setDirty();
                                cropped.checkDirty();
                            });
                        });
                    }
                });
            }
            this.sequenceBitmaps = cachedSequence.cells;
            this.beltBitmaps = cachedSequence.beltCells;
            var pivot = weaponPivot(info);
            this.barrelSprite.anchor.set((pivot.x - frame.x) / frame.w,
                (pivot.y - frame.y) / frame.h);
            this.barrelSprite.x = this.barrelSprite.y = 0;
            if (info.separateFlame) {
                this.flameSprite.x = info.muzzle.x - pivot.x;
                this.flameSprite.y = info.muzzle.y - pivot.y;
                this.flameSprite.scale.x = this.flameSprite.scale.y = info.flameScale;
            }
            if (info.chargeCells) {
                this.chargeSprite.x = info.muzzle.x - pivot.x;
                this.chargeSprite.y = info.muzzle.y - pivot.y;
                ImageManager.loadBitmap('img/bullets/', 'chargedShot');
            }
            this.weaponElapsed = this.weaponDuration = 0;
            this.updateWeaponFrame();
            return;
        }
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

    function cannonPosePoints(target) {
        // Keep the final link horizontal, entering the cannon from its left.
        // Balance the remaining links with that rear joint held in place.
        var rear = { x: target.x - NOMINAL_LINK_LENGTH, y: target.y };
        var left = Math.min(ROOT.x - 30, rear.x - 12);
        var points = [
            { x: ROOT.x, y: ROOT.y },
            { x: left + 8, y: ROOT.y - 10 },
            { x: left - 8, y: (ROOT.y + target.y) / 2 - 8 },
            rear
        ];
        return balanceSegmentLengths(points).concat([{ x: target.x, y: target.y }]);
    }

    function gatlingPosePoints(target, angle) {
        // Five short, equal rods support the socket from below. Two folded pairs
        // keep the added joints compact; the final rod follows the receiver axis.
        var downX = -Math.sin(angle), downY = Math.cos(angle);
        var dx = target.x - ROOT.x, dy = target.y - ROOT.y;
        var along = dx * downX + dy * downY;
        var minLength = (along + Math.sqrt(along * along + 15 * (dx * dx + dy * dy))) / 15;
        var length = Math.max(GATLING_LINK_LENGTH, minLength * 1.25);
        var lower = { x: target.x + downX * length, y: target.y + downY * length };
        dx = lower.x - ROOT.x;
        dy = lower.y - ROOT.y;
        var span = Math.max(0.001, Math.hypot(dx, dy));
        var axisX = dx / span, axisY = dy / span, normalX = -axisY, normalY = axisX;
        var pairReach = span / (2 * length);
        var firstCos = Math.max(pairReach - 0.9, Math.min(0.5, pairReach * 0.4));
        var secondCos = pairReach - firstCos;
        var firstSide = Math.sqrt(Math.max(0, 1 - firstCos * firstCos));
        var secondSide = Math.sqrt(Math.max(0, 1 - secondCos * secondCos));
        var elbow = { x: ROOT.x + length * (axisX * firstCos - normalX * firstSide),
            y: ROOT.y + length * (axisY * firstCos - normalY * firstSide) };
        var middle = { x: ROOT.x + 2 * length * axisX * firstCos,
            y: ROOT.y + 2 * length * axisY * firstCos };
        // Fold the third intermediate joint left of the middle-to-lower span.
        var upper = { x: middle.x + length * (axisX * secondCos - normalX * secondSide),
            y: middle.y + length * (axisY * secondCos - normalY * secondSide) };
        return [{ x: ROOT.x, y: ROOT.y }, elbow, middle, upper, lower,
            { x: target.x, y: target.y }];
    }

    function missilePosePoints(target) {
        // Fold back toward the body between outward elbows, keeping a short rear link.
        return [
            { x: ROOT.x, y: ROOT.y },
            { x: ROOT.x + (target.x - ROOT.x) * 0.8, y: ROOT.y - 8 },
            { x: target.x + 20, y: (ROOT.y + target.y) / 2 - 5 },
            { x: target.x - 14, y: target.y + 13 },
            { x: target.x, y: target.y }
        ];
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
        var info = WEAPONS[weapon], pivot = weaponPivot(info);
        weaponRects(info).forEach(function(frame) {
            var left = frame.x - pivot.x - ARM_HALF_WIDTH;
            var top = frame.y - pivot.y - ARM_HALF_WIDTH;
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

    YumeArm.prototype.poseTarget = function(pose, x, y, enemyPoint) {
        if (pose === 'targetLeft') {
            if (!enemyPoint) return this.poseTarget('overhead', x, y, null);
            // Keep the tank above Yume and leave a gap beyond the muzzle.
            var left = this.manager.offsetLocalPoint(enemyPoint, -288 + x, -74 + y);
            return { points: posePoints({ bends: RANDOM_BENDS }, left, this.routeStyle),
                angle: Math.atan2(enemyPoint.y - left.y, enemyPoint.x - left.x) };
        }
        if (pose === 'targetUpperLeft') {
            if (!enemyPoint) return this.poseTarget('overhead', x, y, null);
            var target = this.manager.offsetLocalPoint(enemyPoint, -64 + x, -48 + y);
            var axis = WEAPONS[this.weapon].axis || 0;
            return {
                points: posePoints({ bends: RANDOM_BENDS }, target, this.routeStyle),
                angle: Math.atan2(enemyPoint.y - target.y, enemyPoint.x - target.x) - axis
            };
        }
        if (pose !== 'overhead') return this.randomTarget(x, y, enemyPoint);
        var overhead = { x: 12 + x, y: -142 + y };
        var overheadAngle = 0;
        if ((this.weapon === 'chargeCannon' || this.weapon === 'gatling') && enemyPoint) {
            var dx = enemyPoint.x - overhead.x, dy = enemyPoint.y - overhead.y;
            var info = WEAPONS[this.weapon];
            var offsetY = info.muzzle.y - info.pivot.y;
            overheadAngle = Math.atan2(dy, dx) - Math.asin(Math.max(-1, Math.min(1,
                offsetY / Math.max(1, Math.hypot(dx, dy)))));
        }
        return {
            points: this.weapon === 'cannon' ? cannonPosePoints(overhead) :
                this.weapon === 'missile' ? missilePosePoints(overhead) :
                this.weapon === 'gatling' ? gatlingPosePoints(overhead, overheadAngle) :
                posePoints({ bends: RANDOM_BENDS }, overhead, this.routeStyle),
            angle: overheadAngle
        };
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
                if ((this.weapon === 'gatling' || this.weapon === 'cannon') && this.retractingViaTop) {
                    // Lower early as the full-size barrel turns upward, keeping
                    // its muzzle low while the final shrink remains delayed.
                    var returnStep = this.weapon === 'cannon' ? smoothStep(progress) :
                        1 - Math.pow(1 - progress, 2);
                    points.push({ x: startTip.x + (endTip.x - startTip.x) * returnStep,
                        y: startTip.y + (endTip.y - startTip.y) * returnStep });
                } else points.push(this.unfoldDirect ? cubicPoint(drillDeployCurve(endTip), progress) :
                    tipViaBackpackTop(startTip, endTip, progress));
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

    YumeArm.prototype.unfoldDrawPoints = function(tip, currentPoints, destinationPoints) {
        currentPoints = currentPoints || this.points;
        destinationPoints = destinationPoints || this.toPoints;
        var progress = this.moveDuration > 0 ? this.moveElapsed / this.moveDuration : 1;
        var last = currentPoints.length - 1;
        var links = Math.min(last, Math.ceil(progress * last));
        if (links <= 0) return [{ x: ROOT.x, y: ROOT.y }];
        if (links === last) return keepJointsAboveOpening(copyPoints(currentPoints));
        // Only the links already pulled through the opening are drawn. Use the
        // matching end of the deployed route, anchored at the backpack mouth.
        var source = destinationPoints.slice(last - links);
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
        if (movementSeArm === this) movementSeArm = null;
        if (this.moveSeBuffer && this.moveSeBuffer.stop) this.moveSeBuffer.stop();
        this.moveSeBuffer = null;
    };

    YumeArm.prototype.startMoveSe = function(name, volume, pitch) {
        if (typeof AudioManager === 'undefined' || !AudioManager.playSe) return;
        this.stopMoveSe();
        var movement = !name;
        var moveSe = !name && WEAPONS[this.weapon].moveSe;
        if (moveSe) {
            name = moveSe.name;
            volume = moveSe.volume;
            pitch = moveSe.pitch;
        }
        var before = AudioManager._seBuffers ? AudioManager._seBuffers.slice() : [];
        AudioManager.playSe({
            name: name || MOVE_SE_NAME,
            volume: volume === undefined ? MOVE_SE_VOLUME : volume,
            pitch: pitch || MOVE_SE_PITCH_MIN + Math.floor(this.manager.random() * MOVE_SE_PITCH_RANGE),
            pan: 0
        });
        var buffers = AudioManager._seBuffers || [];
        for (var i = buffers.length - 1; i >= 0; i--) {
            if (before.indexOf(buffers[i]) < 0) {
                // Explicit names are weapon actions, not the shared movement voice.
                if (movement && movementSeArm) movementSeArm.stopMoveSe();
                this.moveSeBuffer = buffers[i];
                if (movement) movementSeArm = this;
                break;
            }
        }
    };

    YumeArm.prototype.moveTo = function(points, angle, duration, phase, preserveBends, pathMode) {
        this.stopDrill();
        this.stopFlame();
        this.stopCharge();
        this.stopRecoil();
        this.stopMoveSe();
        var pointCount = this.weapon === 'gatling' ? 6 : FOLD.length;
        this.points = resizeArmPoints(this.points, pointCount);
        this.fromPoints = copyPoints(this.points);
        this.toPoints = resizeArmPoints(points, pointCount);
        if (this.weapon === 'gatling' && phase === 'active')
            this.gatlingLinkLength = Math.hypot(this.toPoints[1].x - this.toPoints[0].x,
                this.toPoints[1].y - this.toPoints[0].y);
        this.fromWeaponScale = this.weaponScale;
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
        this.unfoldDirect = pathMode === 'outDirect' && this.moveDuration > 0;
        this.unfolding = (pathMode === 'out' || this.unfoldDirect) && this.moveDuration > 0;
        this.retractingViaTop = pathMode === 'in' && this.moveDuration > 0;
        this.retractTrim = 0;
        if (this.moveDuration === 0) {
            this.points = copyPoints(this.toPoints);
            this.angle = angle;
            this.fromPoints = this.toPoints = null;
        }
        this.updateYuraState();
        var viaTop = this.unfolding || this.retractingViaTop;
        var bounds = viaTop ? points.concat([BACKPACK_TOP]) : points;
        if (this.unfoldDirect) bounds = bounds.concat(drillDeployCurve(points[points.length - 1]));
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
        if (unfold && WEAPONS[weapon].packedScale) this.weaponScale = WEAPONS[weapon].packedScale;
        if (unfold && finiteNumber(WEAPONS[weapon].packedAngle)) this.angle = WEAPONS[weapon].packedAngle;
        var layout = this.poseTarget(pose, x, y, enemyPoint);
        var outPath = (weapon === 'drill' && pose === 'targetUpperLeft' ||
            weapon === 'flamethrower' && pose === 'targetLeft' ||
            weapon === 'chargeCannon' || weapon === 'gatling' || weapon === 'missile') ? 'outDirect' : 'out';
        this.moveTo(layout.points, layout.angle,
            duration, 'active', true, unfold ? outPath : null);
        if (WEAPONS[this.weapon].sequence) {
            this.weaponFiring = false;
            this.idleElapsed = 0;
            this.weaponElapsed = this.weaponDuration = 0;
            this.updateWeaponFrame();
            this.updateYuraState();
        } else this.restartWeaponAnimation(DEFAULT_WEAPON_DURATION);
    };

    YumeArm.prototype.move = function(pose, x, y, duration, enemyPoint) {
        this.grace = 0;
        this.useCount++;
        var layout = this.poseTarget(pose, x, y, enemyPoint);
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
        if (this.weapon === 'chargeCannon') {
            this.startCharge(duration);
            return;
        }
        if (this.weapon === 'flamethrower') {
            this.startFlame(duration, null);
            return;
        }
        if (this.weapon === 'drill') {
            this.startDrill(duration, 24);
            return;
        }
        this.weaponElapsed = 0;
        this.weaponDuration = Math.max(1, duration);
        this.weaponFiring = !!WEAPONS[this.weapon].sequence;
        this.updateYuraState();
        this.updateWeaponFrame();
    };

    YumeArm.prototype.startDrill = function(duration, distance) {
        if (this.weapon !== 'drill') return;
        this.stopDrill();
        this.stopMoveSe();
        this.fromPoints = this.toPoints = null;
        this.moveDuration = 0;
        this.unfolding = this.retractingViaTop = false;
        this.unfoldDirect = false;
        this.phase = 'active';
        this.grace = 0;
        var tip = this.points[this.points.length - 1];
        var axis = this.angle + WEAPONS.drill.axis;
        var global = this.manager.owner.toGlobal(tip);
        var forward = this.manager.owner.toGlobal({ x: tip.x + Math.cos(axis), y: tip.y + Math.sin(axis) });
        var length = Math.max(0.001, Math.hypot(forward.x - global.x, forward.y - global.y));
        var end = this.manager.offsetLocalPoint(tip,
            (forward.x - global.x) / length * distance, (forward.y - global.y) / length * distance);
        this.drillMotion = {
            elapsed: 0, duration: Math.max(1, duration), from: copyPoints(this.points),
            dx: end.x - tip.x, dy: end.y - tip.y
        };
        this.ensureArmBitmapFits([end], 4);
        this.weaponFiring = true;
        this.weaponElapsed = 0;
        this.weaponDuration = Math.max(1, duration);
        var cuttingSe = WEAPONS.drill.cuttingSe;
        this.startMoveSe(cuttingSe.name, cuttingSe.volume, cuttingSe.pitch);
        this.updateYuraState();
        this.updateWeaponFrame();
    };

    YumeArm.prototype.stopDrill = function() {
        if (!this.drillMotion) return;
        this.drillMotion = null;
        this.drillShakeX = 0;
        this.weaponFiring = false;
        this.weaponElapsed = this.weaponDuration = this.idleElapsed = 0;
        this.stopMoveSe();
    };

    YumeArm.prototype.startFlame = function(burnFrames, onHit) {
        if (this.weapon !== 'flamethrower') return;
        this.stopFlame();
        this.stopMoveSe();
        this.flameMotion = { elapsed: 0, burnFrames: burnFrames, hit: false, onHit: onHit };
        this.weaponFiring = true;
        this.weaponElapsed = 0;
        this.weaponDuration = burnFrames + 6;
        var spraySe = WEAPONS.flamethrower.spraySe;
        this.startMoveSe(spraySe.name, spraySe.volume, spraySe.pitch);
        this.updateYuraState();
        this.updateFlame(false);
    };

    YumeArm.prototype.startCharge = function(duration) {
        if (this.weapon !== 'chargeCannon') return;
        this.stopCharge();
        this.stopRecoil();
        this.stopMoveSe();
        this.chargeMotion = { elapsed: 0, duration: Math.max(1, duration) };
        this.weaponFiring = true;
        this.weaponElapsed = this.weaponDuration = 0;
        this.idleElapsed = 0;
        this.updateWeaponFrame();
        var chargeSe = WEAPONS[this.weapon].chargeSe;
        this.startMoveSe(chargeSe.name, chargeSe.volume, chargeSe.pitch);
        this.updateCharge(false);
        this.updateYuraState();
    };

    YumeArm.prototype.updateCharge = function(advance) {
        var state = this.chargeMotion, info = WEAPONS[this.weapon];
        if (advance) state.elapsed++;
        var atMaximum = state.elapsed >= state.duration && this.chargeScale < 1.5;
        if (state.elapsed >= state.duration && !state.humming) {
            state.humming = true;
            this.stopMoveSe();
            this.moveSeBuffer = NS.playLoopSe(info.holdSe);
        }
        if (advance && state.elapsed % MOTION_STEP_FRAMES !== 0 && !atMaximum) return;
        var progress = Math.min(1, state.elapsed / state.duration);
        this.chargeScale = 0.5 + smoothStep(progress);
        this.chargeFrame = info.chargeCells[Math.floor(state.elapsed / info.frameWait) % info.chargeCells.length];
        this.chargeSprite.bitmap = this.sequenceBitmaps[this.chargeFrame];
        this.chargeSprite.setFrame(0, 0, CELL, CELL);
        this.chargeSprite.visible = true;
        this.chargeSprite.scale.x = this.chargeSprite.scale.y = this.chargeScale;
        var shake = (Math.floor(state.elapsed / MOTION_STEP_FRAMES) % 2 ? 0.5 : -0.5) * progress;
        this.barrelSprite.x = shake;
        this.chargeSprite.x = info.muzzle.x - info.pivot.x + shake;
        this.chargeSprite.y = info.muzzle.y - info.pivot.y;
    };

    YumeArm.prototype.stopCharge = function() {
        if (!this.chargeMotion) return;
        this.chargeMotion = null;
        this.chargeFrame = -1;
        this.chargeSprite.visible = false;
        this.barrelSprite.x = 0;
        this.weaponFiring = false;
        this.weaponElapsed = this.weaponDuration = 0;
        this.stopMoveSe();
    };

    YumeArm.prototype.startRecoil = function(duration, distance) {
        this.stopRecoil();
        this.recoilMotion = { elapsed: 0, duration: duration || 18,
            distance: distance === undefined ? 8 : distance, from: copyPoints(this.points) };
        if (this.weapon === 'gatling') {
            var from = this.recoilMotion.from;
            this.recoilMotion.lengths = from.slice(1).map(function(point, index) {
                return Math.hypot(point.x - from[index].x, point.y - from[index].y);
            });
        }
        this.weaponFiring = true;
        if (!WEAPONS[this.weapon].machineGun) this.idleElapsed = 0;
        this.updateWeaponFrame();
        this.updateRecoil(false);
        this.updateYuraState();
        this.render();
    };

    YumeArm.prototype.updateRecoil = function(advance) {
        var state = this.recoilMotion;
        if (advance) state.elapsed++;
        if (state.elapsed % MOTION_STEP_FRAMES !== 0 && state.elapsed < state.duration) return false;
        var kick = state.distance * Math.max(0, 1 - state.elapsed / state.duration);
        var last = this.points.length - 1;
        for (var i = 1; i <= last; i++) {
            this.points[i].x = state.from[i].x - Math.cos(this.angle) * kick * i / last;
            this.points[i].y = state.from[i].y - Math.sin(this.angle) * kick * i / last;
        }
        if (state.lengths) constrainLinkLengths(this.points, state.lengths);
        if (state.elapsed >= state.duration) this.stopRecoil();
        return true;
    };

    YumeArm.prototype.stopRecoil = function() {
        if (!this.recoilMotion) return;
        this.points = copyPoints(this.recoilMotion.from);
        this.recoilMotion = null;
        this.weaponFiring = false;
        this.weaponElapsed = this.weaponDuration = 0;
        if (WEAPONS[this.weapon].activeCells) this.updateWeaponFrame();
    };

    YumeArm.prototype.queueMachineGun = function(action) {
        this.queueRapidGun(action, 'machineGun');
    };

    YumeArm.prototype.queueGatling = function(action) {
        this.queueRapidGun(action, 'gatling');
    };

    YumeArm.prototype.queueRapidGun = function(action, weapon) {
        if (action._yumeMachineQueued) return;
        var state = this.machineGunMotion, info = WEAPONS[weapon];
        if (!state || state.closing) {
            var target = this.manager.owner.targetSprite && this.manager.owner.targetSprite();
            var point = this.manager.enemyCenterLocal(target, 0, 0);
            var staging = info.staging || { pose: 'random', x: -32, y: 0 };
            this.out(weapon, staging.pose, staging.x, staging.y,
                this.hasDeployed ? 12 : info.deployFrames, 0, point);
            if (state) state.cooldown = 0;
        }
        if (!state) state = { queue: [], hits: [], cooldown: 0, quiet: 0, fired: 0,
            anchor: action, burstAction: null };
        state.closing = false;
        state.button = info.burst ? null : action.buttonSprite || null;
        state.quiet = 0;
        for (var shot = 0; shot < (info.burst || 1); shot++) state.queue.push(action);
        this.machineGunMotion = state;
        action._yumeMachineQueued = true;
        action.wait = 1;
    };

    YumeArm.prototype.updateMachineGun = function() {
        var state = this.machineGunMotion, owner = this.manager.owner, info = WEAPONS[this.weapon];
        state.anchor.wait = 1;
        state.queue.forEach(function(action) { action.wait = 1; });
        state.hits.forEach(function(hit) { hit.action.wait = 1; });
        if (state.closing) return;
        var open = state.button && !state.button._judged;
        state.quiet++;
        if (state.cooldown > 0) state.cooldown--;
        for (var i = state.hits.length - 1; i >= 0; i--) {
            var hit = state.hits[i];
            if (--hit.remaining <= 0) {
                owner.actionApply(hit.action);
                if (hit.action !== state.anchor) hit.action.wait = 0;
                state.hits.splice(i, 1);
            }
        }
        if (!this.toPoints && state.cooldown === 0 && state.queue.length) {
            var action = state.queue.shift();
            state.fired++;
            if (info.belt) {
                if (state.burstAction !== action) {
                    state.burstAction = action;
                    this.machineBeltUsed = 0;
                }
                this.machineBeltUsed = Math.min(info.belt.links, this.machineBeltUsed + 1);
            }
            state.quiet = 0;
            state.cooldown = 6;
            this.startRecoil(6, state.fired % 2 ? 3 : 2);
            this.manager.playMachineGunShot(this, state.fired);
            state.hits.push({ action: action, remaining: 6 });
        }
        if (!open && !this.toPoints && !state.queue.length && !state.hits.length &&
            state.quiet >= 12) {
            state.closing = true;
            this.scheduleIn(0, info.retractFrames);
        }
    };

    YumeArm.prototype.stopMachineGun = function() {
        var state = this.machineGunMotion;
        if (!state) return;
        state.anchor.wait = 0;
        state.queue.forEach(function(action) { action.wait = 0; });
        state.hits.forEach(function(hit) { hit.action.wait = 0; });
        this.machineGunMotion = null;
    };

    YumeArm.prototype.stopFlame = function() {
        if (!this.flameMotion) return;
        this.flameMotion = null;
        this.flameFrame = -1;
        this.flameSprite.visible = false;
        this.weaponFiring = false;
        this.weaponElapsed = this.weaponDuration = 0;
        this.stopMoveSe();
    };

    YumeArm.prototype.updateFlame = function(advance) {
        var state = this.flameMotion;
        if (advance) state.elapsed++;
        if (state.elapsed >= state.burnFrames + 6) { this.stopFlame(); return; }
        var cell = state.elapsed >= state.burnFrames ? 7 :
            state.elapsed < 6 ? 3 : 4 + Math.floor((state.elapsed - 6) / 6) % 3;
        if (state.elapsed === state.burnFrames) this.stopMoveSe();
        this.flameSprite.visible = true;
        this.flameSprite.bitmap = this.sequenceBitmaps[cell];
        this.flameSprite.setFrame(0, 0, CELL, CELL);
        this.flameFrame = cell;
        if (!state.hit && flameTouches(this, cell)) {
            state.hit = true;
            if (state.onHit) state.onHit();
        }
    };

    YumeArm.prototype.updateWeaponScale = function() {
        var info = WEAPONS[this.weapon];
        var packed = info.packedScale || info.retractScale;
        var progress = this.moveDuration > 0 ?
            this.moveElapsed / Math.min(MOTION_STEP_FRAMES, this.moveDuration) : 1;
        var scale = 1;
        if (packed) {
            if (this.retractingViaTop || this.phase === 'retracting') {
                // Pack in one pose step, before the backpack occludes the rig.
                var shrink = this.weapon === 'gatling' ?
                    gatlingPackProgress(this.moveElapsed, this.moveDuration) : smoothStep(progress);
                if (this.weapon === 'cannon') {
                    var returnProgress = this.moveDuration > 0 ? this.moveElapsed / this.moveDuration : 1;
                    shrink = smoothStep((returnProgress - 0.25) / 0.6);
                }
                scale = this.fromWeaponScale + (packed - this.fromWeaponScale) * shrink;
            } else if (this.toPoints && (this.unfolding || this.fromWeaponScale < 1)) {
                // Show the packed body emerging, then expand in one pose step.
                var grow = this.unfolding ? progress - 1 : progress;
                scale = this.fromWeaponScale + (1 - this.fromWeaponScale) * smoothStep(grow);
            }
        }
        this.weaponScale = scale;
        this.weaponRoot.scale.x = this.weaponRoot.scale.y = scale;
    };

    YumeArm.prototype.supportTarget = function(tip, angle, scale) {
        var info = WEAPONS[this.weapon], pivot = weaponPivot(info);
        scale = scale === undefined ? this.weaponScale : scale;
        var x = (info.support.x - pivot.x) * scale, y = (info.support.y - pivot.y) * scale;
        return { x: tip.x + x * Math.cos(angle) - y * Math.sin(angle),
            y: tip.y + x * Math.sin(angle) + y * Math.cos(angle) };
    };

    YumeArm.prototype.updateDrill = function() {
        var motion = this.drillMotion;
        var progress = ++motion.elapsed / motion.duration;
        var last = this.points.length - 1;
        this.drillShakeX = progress < 1 ? (Math.floor((motion.elapsed - 1) / 2) % 2 ? 1 : -1) : 0;
        var shake = this.manager.offsetLocalPoint({ x: 0, y: 0 }, this.drillShakeX, 0);
        for (var i = 1; i <= last; i++) {
            var weight = i / last;
            this.points[i].x = motion.from[i].x + (motion.dx * progress + shake.x) * weight;
            this.points[i].y = motion.from[i].y + (motion.dy * progress + shake.y) * weight;
        }
        if (progress >= 1) this.stopDrill();
    };

    YumeArm.prototype.scheduleIn = function(grace, duration) {
        this.stopDrill();
        this.stopFlame();
        this.stopCharge();
        this.stopRecoil();
        this.grace = grace;
        this.retractDuration = duration;
        this.phase = 'pending';
        if (this.weapon === 'cannon') {
            this.weaponFiring = false;
            this.weaponElapsed = this.weaponDuration = 0;
            this.updateWeaponFrame();
            this.updateYuraState();
        }
        if (grace === 0) this.beginRetract();
    };

    YumeArm.prototype.beginRetract = function() {
        this.grace = 0;
        var info = WEAPONS[this.weapon];
        var storedAngle = finiteNumber(info.retractAngle) ? info.retractAngle : info.packedAngle;
        var angle = finiteNumber(storedAngle) ? storedAngle :
            info.sequence ? this.angle : this.angle + Math.PI;
        this.moveTo(foldedPoints(this.weapon, this.gatlingLinkLength), angle, this.retractDuration,
            'retracting', true, 'in');
    };

    YumeArm.prototype.updateWeaponFrame = function() {
        var info = WEAPONS[this.weapon];
        if (info.sequence) {
            this.rotorSprite.visible = false;
            this.barrelSprite.visible = true;
            var step = this.weaponFiring ? Math.floor(this.weaponElapsed * info.cells / this.weaponDuration) : 0;
            var cell;
            if (info.idleCells) {
                var spinning = this.weaponFiring;
                var cells = spinning && info.activeCells ? info.activeCells : info.idleCells;
                var clock = info.separateFlame || info.chargeCells || info.machineGun ? this.idleElapsed :
                    (this.weaponFiring ? this.weaponElapsed : this.idleElapsed);
                cell = cells[Math.floor(clock / info.frameWait) % cells.length];
            } else if (info.loopFrameWait && this.weaponFiring && step >= info.loopStart) {
                var loopAge = this.weaponElapsed - info.loopStart * this.weaponDuration / info.cells;
                cell = info.loopStart + Math.floor(loopAge / info.loopFrameWait) % (info.cells - info.loopStart);
            } else cell = step < info.cells ? step :
                info.loopStart + (step - info.cells) % (info.cells - info.loopStart);
            var frameBitmap = info.belt && this.beltBitmaps ?
                this.beltBitmaps[this.machineBeltUsed][cell] : this.sequenceBitmaps[cell];
            if (this.sequenceFrame !== cell || info.belt && this.barrelSprite.bitmap !== frameBitmap) {
                setSpriteYuraEnabled(this.barrelSprite, false);
                this.barrelSprite.bitmap = frameBitmap;
                this.barrelSprite.setFrame(0, 0, info.sequence.w, info.sequence.h);
                this.sequenceFrame = cell;
            }
            // A short kick at the expanded second cell settles before the smoke loop.
            var kick = !info.idleCells && this.weaponFiring && step >= 1 ?
                Math.max(0, 1 - (this.weaponElapsed - this.weaponDuration / info.cells) / 12) : 0;
            if (!this.chargeMotion) {
                this.barrelSprite.x = -7 * kick;
                this.barrelSprite.y = 3 * kick;
            }
            return;
        }
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
            var poseStep = this.weapon === 'chargeCannon' ?
                (this.idleElapsed + 1) % MOTION_STEP_FRAMES === 0 :
                this.moveElapsed % MOTION_STEP_FRAMES === 0;
            if (poseStep ||
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
                var angleT = t;
                if (finiteNumber(WEAPONS[this.weapon].packedAngle) ||
                    this.retractingViaTop && finiteNumber(WEAPONS[this.weapon].retractAngle)) {
                    if (this.unfolding) {
                        // Clear the opening vertically, then turn while approaching.
                        angleT = smoothStep((this.moveElapsed - MOTION_STEP_FRAMES) /
                            Math.max(1, this.moveDuration - MOTION_STEP_FRAMES * 2));
                    } else if (this.retractingViaTop) {
                        // Start turning during the approach, independently of shrinking.
                        angleT = this.weapon === 'gatling' ?
                            Math.min(1, progress / 0.5) : smoothStep(progress /
                                (this.weapon === 'cannon' ? 0.75 : 0.5));
                    }
                }
                this.angle = progress >= 1 ? this.toAngle : this.fromAngle + this.angleDelta * angleT;
                moved = true;
            }
            if (this.moveElapsed === this.moveDuration) {
                this.fromPoints = this.toPoints = null;
                this.unfolding = false;
                this.unfoldDirect = false;
                this.retractingViaTop = false;
                this.stopMoveSe();
            }
        }
        if (this.weaponFiring || this.weaponElapsed < this.weaponDuration) this.weaponElapsed++;
        if (WEAPONS[this.weapon].idleCells && (!this.weaponFiring || WEAPONS[this.weapon].separateFlame ||
            WEAPONS[this.weapon].chargeCells || WEAPONS[this.weapon].machineGun)) this.idleElapsed++;
        if (this.drillMotion) {
            this.updateDrill();
            moved = true;
        }
        this.updateWeaponFrame();
        if (this.flameMotion) this.updateFlame(true);
        if (this.chargeMotion) this.updateCharge(true);
        if (this.recoilMotion && this.updateRecoil(true)) moved = true;
        if (this.machineGunMotion) this.updateMachineGun();
        if (this.phase === 'pending' && --this.grace <= 0) this.beginRetract();
        this.updateYuraState();
        if (moved) this.render();
        return this.phase === 'retracting' && !this.toPoints;
    };

    YumeArm.prototype.render = function() {
        this.updateWeaponScale();
        var points = this.points;
        var progress = this.moveDuration > 0 ? this.moveElapsed / this.moveDuration : 1;
        var tip = points[points.length - 1];
        var drawPoints = this.retractingViaTop ? this.retractDrawPoints(tip) :
            this.unfolding ? this.unfoldDrawPoints(tip) : points;
        var paths = [drawPoints];
        var info = WEAPONS[this.weapon];
        if (info.support) {
            var supportTip = this.supportTarget(tip, this.angle);
            var support = keepJointsAboveOpening(posePoints({ bends: RANDOM_BENDS }, supportTip, this.routeStyle + 1));
            this.supportPoints = support;
            if (this.unfolding) {
                var endTip = this.toPoints[this.toPoints.length - 1];
                var endSupport = this.supportTarget(endTip, this.toAngle, 1);
                var destination = posePoints({ bends: RANDOM_BENDS }, endSupport, this.routeStyle + 1);
                support = this.unfoldDrawPoints(supportTip, support, destination);
            } else if (this.retractingViaTop) {
                var remaining = Math.max(1, Math.ceil((1 - progress) * (support.length - 1)));
                support = [support[0]].concat(support.slice(-remaining));
            }
            paths.push(support);
        } else this.supportPoints = null;
        var allPoints = [].concat.apply([], paths);
        this.ensureArmBitmapFits(allPoints, 4);
        var bitmap = this.armBitmap;
        var context = bitmap._context;
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
        // The broad cannon must finish folding into the pack before disappearing.
        // Its final poses dissolve the smoke instead of removing the whole rig at once.
        if (this.weapon === 'cannon' && this.retractingViaTop) returningInsideBackpack = progress >= 1;
        var retractAlpha = this.weapon === 'cannon' && this.retractingViaTop ?
            1 - smoothStep((progress - 0.5) / 0.5) : 1;
        this.weaponRoot.alpha = this.armSprite.alpha = retractAlpha;
        this.armSprite.visible = !fullyRetracted && !returningInsideBackpack && unfoldedStepVisible;
        for (var pathIndex = 0; this.armSprite.visible && pathIndex < paths.length; pathIndex++) {
            var path = paths[pathIndex];
            for (var i = 0; i < path.length - 1; i++) {
                var a = path[i], b = path[i + 1];
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
            for (var j = 0; j < path.length - 1; j++) {
                var p = path[j];
                context.beginPath();
                context.arc(p.x, p.y, j === 0 ? ROOT_JOINT_RADIUS : JOINT_RADIUS, 0, Math.PI * 2);
                context.fillStyle = '#ffffff';
                context.fill();
                context.lineWidth = OUTLINE_WIDTH;
                context.strokeStyle = '#474e51';
                context.stroke();
            }
        }
        context.restore();
        snapArmPixels(context, bitmap, allPoints, this.bitmapOffset);
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
        var emergingInsideBackpack = this.unfolding && !this.unfoldDirect && progress <= 0.55 && insideBackpack;
        this.weaponRoot.visible = !fullyRetracted && !returningInsideBackpack &&
            unfoldedStepVisible && !emergingInsideBackpack;
        // Keep the backpack emergence occluded by Yume, then bring the drill
        // in front of the enemy through contact and the outward part of return.
        var inFront = WEAPONS[this.weapon].frontOfTarget && !this.unfolding &&
            (!this.retractingViaTop || progress <= 0.55);
        var weaponLayer = inFront ? this.manager.foregroundLayer : this.manager.frontLayer;
        if (this.weaponRoot.parent !== weaponLayer) weaponLayer.addChild(this.weaponRoot);
    };

    YumeArm.prototype.dispose = function() {
        this.stopDrill();
        this.stopFlame();
        this.stopCharge();
        this.stopRecoil();
        this.stopMachineGun();
        this.stopMoveSe();
        if (this.armSprite.parent) this.armSprite.parent.removeChild(this.armSprite);
        if (this.weaponRoot.parent) this.weaponRoot.parent.removeChild(this.weaponRoot);
    };

    function YumeArmManager(owner) {
        this.owner = owner;
        this.random = Math.random;
        this.arms = Object.create(null);
        this.barrelBitmaps = Object.create(null);
        this.sequenceBitmaps = Object.create(null);
        this.nextSequence = 0;
        this.latestSequenceBySkill = Object.create(null);
        this.missileFlights = [];
        this.backLayer = new Sprite();
        this.frontLayer = new Sprite();
        this.foregroundLayer = new Sprite();
        this.backLayer.z = 2.9;
        this.frontLayer.z = 2.95;
        this.foregroundLayer.z = 3.05;
    }

    YumeArmManager.prototype.hasArms = function() {
        return Object.keys(this.arms).length > 0;
    };

    YumeArmManager.prototype.isAnimating = function() {
        if (this.missileFlights.length) return true;
        var keys = Object.keys(this.arms);
        return keys.some(function(key) {
            var arm = this.arms[key];
            return !!arm.toPoints || !!arm.machineGunMotion || arm.phase !== 'active' ||
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
        scene.playAnimation(animationWithSe($dataAnimations[animationId], WEAPONS[arm.weapon].shotSe),
            position.x + offsetX, position.y + offsetY, mirror);
    };

    YumeArmManager.prototype.playMachineGunShot = function(arm, shotNumber) {
        var scene = SceneManager._scene, source = $dataAnimations && $dataAnimations[54];
        if (!scene || !scene._battleContainer || !scene.playAnimation || !source) return;
        var info = WEAPONS[arm.weapon], tip = arm.points[arm.points.length - 1];
        var x = info.muzzle.x - info.pivot.x, y = info.muzzle.y - info.pivot.y;
        var cos = Math.cos(arm.angle), sin = Math.sin(arm.angle);
        var position = scene._battleContainer.toLocal(this.owner.toGlobal({
            x: tip.x + x * cos - y * sin, y: tip.y + x * sin + y * cos
        }));
        // Reuse the gun animation without changing its shared database sound.
        var animation = Object.assign({}, source);
        animation.timings = (source.timings || []).map(function(timing) {
            var copy = Object.assign({}, timing);
            if (timing.se && timing.se.name) copy.se = Object.assign({}, timing.se,
                { volume: info.shotVolume, pitch: info.shotPitch + (shotNumber % 3 - 1) * 2 });
            return copy;
        });
        // Animation 54's mirrored 200% art starts at (4,-22), not its origin.
        // Align that attachment with the muzzle before rotating along the barrel.
        var flash = scene.playAnimation(animation,
            position.x - 4 * cos - 22 * sin, position.y - 4 * sin + 22 * cos, true);
        if (flash) flash.rotation = arm.angle;
    };

    function centerShellSprite(sprite) {
        var bitmap = sprite._baseBitmap || sprite.bitmap;
        if (!bitmap || !bitmap.isReady() || !bitmap._context) return;
        var width = bitmap.width / 6, height = bitmap.height / 2;
        var centers = bitmap._yumeShellCenters;
        if (!centers) {
            var pixels = bitmap._context.getImageData(0, 0, bitmap.width, height).data;
            centers = [];
            for (var cell = 0; cell < 6; cell++) {
                var left = width, right = -1, top = height, bottom = -1;
                for (var y = 0; y < height; y++) for (var x = 0; x < width; x++) {
                    if (pixels[(y * bitmap.width + cell * width + x) * 4 + 3] < 128) continue;
                    left = Math.min(left, x); right = Math.max(right, x);
                    top = Math.min(top, y); bottom = Math.max(bottom, y);
                }
                centers.push(right < 0 ? { x: 0.5, y: 0.5 } : {
                    x: (left + right + 1) / (2 * width), y: (top + bottom + 1) / (2 * height)
                });
            }
            bitmap._yumeShellCenters = centers;
        }
        var index = sprite._frame ? Math.round(sprite._frame.x / width) % 6 : 0;
        var anchor = sprite._finish ? { x: 0.5, y: 0.5 } : centers[index];
        if (sprite.anchor.x !== anchor.x || sprite.anchor.y !== anchor.y) {
            sprite.anchor.x = anchor.x; sprite.anchor.y = anchor.y;
            if (sprite._yuraInfo && sprite.refreshYurayura) {
                sprite._lastFrame = null;
                sprite.refreshYurayura();
            }
        }
    }

    YumeArmManager.prototype.fireBullet = function(arm, image, duration) {
        var scene = SceneManager._scene;
        var target = this.owner.targetSprite && this.owner.targetSprite();
        var targetLocal = this.enemyCenterLocal(target, 0, 0);
        if (!scene || !scene._battleContainer || !scene.newBullet || !targetLocal) return;
        var info = WEAPONS[arm.weapon], pivot = weaponPivot(info);
        var muzzle = info.muzzle || pivot;
        var scale = finiteNumber(arm.weaponScale) ? arm.weaponScale : 1;
        var mx = (muzzle.x - pivot.x + arm.barrelSprite.x) * scale;
        var my = (muzzle.y - pivot.y + arm.barrelSprite.y) * scale;
        var cos = Math.cos(arm.angle), sin = Math.sin(arm.angle);
        var tip = arm.points[arm.points.length - 1];
        var local = { x: tip.x + mx * cos - my * sin, y: tip.y + mx * sin + my * cos };
        var origin = scene._battleContainer.toLocal(this.owner.toGlobal(local));
        var end = scene._battleContainer.toLocal(this.owner.toGlobal(targetLocal));
        var axis = arm.angle + (info.axis || 0);
        var ahead = scene._battleContainer.toLocal(this.owner.toGlobal({
            x: local.x + Math.cos(axis), y: local.y + Math.sin(axis)
        }));
        var dx = end.x - origin.x, dy = end.y - origin.y;
        var headingX = ahead.x - origin.x, headingY = ahead.y - origin.y;
        var height = Math.abs(headingX) > 0.001 && headingX * dx > 0 ?
            (headingY / headingX * dx - dy) / 4 : -64;
        height = Math.max(-160, Math.min(-24, height));
        // Sprite_Bullet samples count 0 before moving, so N updates span N-1 steps.
        // The small margin prevents floating-point rounding delaying the impact.
        var speed = Math.max(0.001, Math.hypot(dx, dy)) / (duration - 1) / 3 * (1 + 1e-9);
        var bullet = scene.newBullet(image, origin.x, origin.y, end.x, end.y,
            'parabola', speed, height, 0);
        var centeredShell = arm.weapon === 'cannon' && image === 'artilleryShell';
        if (bullet && centeredShell && bullet.bitmap) {
            bullet.bitmap.addLoadListener(function() { centerShellSprite(bullet); });
        }
        if (bullet && (info.impactSe || centeredShell)) {
            var update = bullet.update, sounded = false;
            bullet.update = function() {
                var wasFinished = this._finish;
                update.call(this);
                if (centeredShell) centerShellSprite(this);
                if (!sounded && !wasFinished && this._finish === 1) {
                    sounded = true;
                    if (info.impactSe) AudioManager.playSe(Object.assign({ pan: 0 }, info.impactSe));
                }
            };
        }
        return bullet;
    };

    YumeArmManager.prototype.missileTargetInfo = function() {
        var target = this.owner.targetSprite && this.owner.targetSprite();
        var scene = SceneManager._scene;
        if (!target || !scene || !scene._battleContainer) return null;
        if (target._battler && target._battler.isDead && target._battler.isDead()) return null;
        var bounds = enemyOpaqueBounds(this, target);
        if (!bounds) return null;
        var box = transformedBounds({ x: bounds.left, y: bounds.top,
            w: bounds.right - bounds.left, h: bounds.bottom - bounds.top },
            function(point) { return scene._battleContainer.toLocal(point); });
        if (box.left === box.right) { box.left -= 8; box.right += 8; }
        if (box.top === box.bottom) { box.top -= 8; box.bottom += 8; }
        var result = { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2, bounds: box };
        var bitmap = target._baseBitmap || target.bitmap, frame = target._frame;
        if (target.toLocal && scene._battleContainer.toGlobal && bitmap && bitmap.isReady() &&
            bitmap._context && frame && frame.width > 0 && frame.height > 0) {
            var key = [frame.x, frame.y, frame.width, frame.height].join(',');
            var cache = bitmap._yumeMissilePixels || (bitmap._yumeMissilePixels = Object.create(null));
            if (!cache[key]) {
                var pixels = bitmap._context.getImageData(frame.x, frame.y, frame.width, frame.height).data;
                var mask = new Uint8Array(frame.width * frame.height);
                for (var pixel = 0; pixel < mask.length; pixel++) mask[pixel] = pixels[pixel * 4 + 3] >= 128 ? 1 : 0;
                cache[key] = mask;
            }
            var width = frame.width, height = frame.height, opaque = cache[key];
            result.pixelContact = function(point) {
                var local = target.toLocal(scene._battleContainer.toGlobal(point));
                var x = Math.floor(local.x + target.anchor.x * width);
                var y = Math.floor(local.y + target.anchor.y * height);
                return x >= 0 && y >= 0 && x < width && y < height && !!opaque[y * width + x];
            };
        }
        return result;
    };

    YumeArmManager.prototype.missileLaunchInfo = function(arm) {
        var scene = SceneManager._scene;
        if (!scene || !scene._battleContainer || arm.weapon !== 'missile') return null;
        var info = WEAPONS.missile, tip = arm.points[arm.points.length - 1];
        var scale = finiteNumber(arm.weaponScale) ? arm.weaponScale : 1;
        var x = (info.muzzle.x - info.pivot.x) * scale, y = (info.muzzle.y - info.pivot.y) * scale;
        var cos = Math.cos(arm.angle), sin = Math.sin(arm.angle);
        var local = { x: tip.x + x * cos - y * sin, y: tip.y + x * sin + y * cos };
        var origin = scene._battleContainer.toLocal(this.owner.toGlobal(local));
        var ahead = scene._battleContainer.toLocal(this.owner.toGlobal({
            x: local.x + Math.cos(arm.angle + info.axis), y: local.y + Math.sin(arm.angle + info.axis)
        }));
        return { x: origin.x, y: origin.y, angle: Math.atan2(ahead.y - origin.y, ahead.x - origin.x),
            scale: Math.hypot(ahead.x - origin.x, ahead.y - origin.y) * scale };
    };

    YumeArmManager.prototype.fireHomingMissile = function(arm, action, duration, apply, waiting) {
        var scene = SceneManager._scene, launch = this.missileLaunchInfo(arm), target = this.missileTargetInfo();
        if (!launch || !target || !scene.newBullet) return null;
        var bullet = scene.newBullet('missile', launch.x, launch.y, target.x, target.y, 'homing', 0, 0, 0);
        if (!bullet) return null;
        var manager = this, info = WEAPONS.missile;
        var state = newMissileFlight(launch, target, duration);
        var flight = { bullet: bullet, action: action, waiting: waiting, resolved: false };
        this.missileFlights.push(flight);
        if (waiting) action.wait = 1;
        setSpriteYuraEnabled(bullet, false);
        bullet._frames = 6; bullet._frameCount = MOTION_STEP_FRAMES;
        // Count the launch pose as tick one, matching the arm's update that tick.
        bullet._yumePoseAge = 1;
        bullet._yumeMissileState = state;
        bullet.scale.x = bullet.scale.y = launch.scale;
        bullet.anchor.x = 60 / 72; bullet.anchor.y = 0.5;
        bullet.rotation = launch.angle;
        function showCell(cell, row) {
            if (bullet.bitmap.isReady()) bullet.setFrame(cell * bullet.bitmap.width / 6,
                row * bullet.bitmap.height / 2, bullet.bitmap.width / 6, bullet.bitmap.height / 2);
        }
        function resolve(hit) {
            if (flight.resolved) return;
            flight.resolved = true;
            if (waiting) action.wait = 0;
            if (hit) {
                if (apply) manager.owner.actionApply(action);
                AudioManager.playSe({ name: info.impactSe.name, volume: info.impactSe.volume,
                    pitch: info.impactSe.pitch, pan: 0 });
            }
        }
        flight.cancel = function() {
            bullet._finish = 2; bullet.visible = false;
            resolve(false);
        };
        bullet.bitmap.addLoadListener(function() {
            showCell(bullet._finish === 1 ? Math.floor(bullet._count / MOTION_STEP_FRAMES) :
                Math.floor(state.elapsed / MOTION_STEP_FRAMES) % 6, bullet._finish === 1 ? 1 : 0);
        });
        bullet.update = function() {
            if (this._finish === 2) return;
            if (SceneManager._scene !== scene) { flight.cancel(); return; }
            this._yumePoseAge++;
            if (this._finish === 1) {
                this._count++;
                if (this._count >= MOTION_STEP_FRAMES * 6) { this._finish = 2; this.visible = false; }
                else if (this._count % MOTION_STEP_FRAMES === 0) showCell(this._count / MOTION_STEP_FRAMES, 1);
                return;
            }
            if (this._yumePoseAge % MOTION_STEP_FRAMES) return;
            var liveTarget = manager.missileTargetInfo();
            if (!liveTarget) { flight.cancel(); return; }
            this._tx = liveTarget.x; this._ty = liveTarget.y;
            var hit = stepMissileFlight(state, liveTarget);
            this.x = state.x; this.y = state.y; this.rotation = state.heading;
            this._count = state.elapsed;
            if (hit) {
                this._finish = 1; this._count = 0;
                this.anchor.x = this.anchor.y = 0.5; this.rotation = 0;
                showCell(0, 1);
                resolve(true);
            } else if (state.elapsed >= state.limit) flight.cancel();
            else showCell(Math.floor(state.elapsed / MOTION_STEP_FRAMES) % 6, 0);
        };
        arm.startRecoil(MOTION_STEP_FRAMES * 3, 5);
        AudioManager.playSe({ name: info.shotSe.name, volume: info.shotSe.volume, pitch: info.shotSe.pitch, pan: 0 });
        return bullet;
    };

    YumeArmManager.prototype.fireChargedShot = function(arm, image, duration, onHit) {
        if (arm.weapon !== 'chargeCannon' || !arm.chargeMotion) return null;
        var scene = SceneManager._scene;
        var target = this.owner.targetSprite && this.owner.targetSprite();
        var targetLocal = this.enemyCenterLocal(target, 0, 0);
        if (!scene || !scene._battleContainer || !scene.newBullet || !targetLocal) return null;
        var info = WEAPONS.chargeCannon, tip = arm.points[arm.points.length - 1];
        var cos = Math.cos(arm.angle), sin = Math.sin(arm.angle);
        var x = arm.chargeSprite.x * arm.weaponScale, y = arm.chargeSprite.y * arm.weaponScale;
        var local = { x: tip.x + x * cos - y * sin, y: tip.y + x * sin + y * cos };
        var origin = scene._battleContainer.toLocal(this.owner.toGlobal(local));
        var end = scene._battleContainer.toLocal(this.owner.toGlobal(targetLocal));
        var chargeScale = arm.chargeScale;
        var size = info.chargeDiameter * chargeScale * arm.weaponScale;
        var edge = scene._battleContainer.toLocal(this.owner.toGlobal({
            x: local.x - sin * size, y: local.y + cos * size
        }));
        var diameter = Math.hypot(edge.x - origin.x, edge.y - origin.y);
        var distance = Math.max(0.001, Math.hypot(end.x - origin.x, end.y - origin.y));
        var speed = distance / (duration - 1) / 3 * (1 + 1e-9);
        var bullet = scene.newBullet(image, origin.x, origin.y, end.x, end.y, 'straight', speed, 0, 0);
        if (!bullet) return null;
        bullet.rotation = Math.atan2(end.y - origin.y, end.x - origin.x);
        bullet._yumeChargeScale = chargeScale;
        bullet._yumeChargeDiameter = diameter;
        bullet.bitmap.addLoadListener(function() {
            // Each 224px source cell has a 96px orb; the remaining width is its tail.
            // Normalize the orb diameter, preserving the release scale and center.
            var cell = bullet.bitmap.width / 6;
            bullet.scale.x = bullet.scale.y = diameter / (cell * 96 / 224);
            if (!bullet._finish) {
                bullet.anchor.x = 118 / 224;
                bullet.anchor.y = 114 / 224;
            }
        });
        var update = bullet.update;
        function advanceShot(ticks) {
            for (var tick = 0; tick < ticks && this._finish !== 2; tick++) {
                var wasFinished = this._finish;
                update.call(this);
                if (!wasFinished && this._finish === 1) {
                    this.anchor.x = this.anchor.y = 0.5;
                    this.rotation = 0;
                    this._frameCount = MOTION_STEP_FRAMES;
                    if (this.bitmap.isReady()) {
                        this.setFrame(0, this.bitmap.height / 2,
                            this.bitmap.width / 6, this.bitmap.height / 2);
                    }
                    AudioManager.playSe(Object.assign({ pan: 0 }, info.impactSe));
                    if (onHit) onHit();
                }
            }
        }
        // Prime count zero on the launch tick so the bullet and recoil use
        // the same pose boundaries. Hold both pixels and hit tests in between.
        bullet._yumePoseAge = 1;
        bullet._yumePendingTicks = 0;
        advanceShot.call(bullet, 1);
        bullet.rotation = Math.atan2(end.y - origin.y, end.x - origin.x);
        bullet.update = function() {
            this._yumePoseAge++;
            this._yumePendingTicks++;
            if (this._yumePoseAge % MOTION_STEP_FRAMES !== 0 &&
                (this._finish || this._yumePoseAge < duration)) return;
            var ticks = this._yumePendingTicks;
            this._yumePendingTicks = 0;
            advanceShot.call(this, ticks);
        };
        arm.lastShotScale = chargeScale;
        arm.stopCharge();
        arm.startRecoil();
        AudioManager.playSe({ name: info.shotSe.name, volume: info.shotSe.volume, pitch: info.shotSe.pitch, pan: 0 });
        return bullet;
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

    YumeArmManager.prototype.offsetLocalPoint = function(point, screenX, screenY) {
        var global = this.owner.toGlobal(point);
        return this.owner.toLocal({ x: global.x + screenX, y: global.y + screenY });
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
        var pivot = weaponPivot(info);
        weaponRects(info).forEach(function(frame) {
            var left = frame.x - pivot.x, top = frame.y - pivot.y;
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
            if (this.foregroundLayer.parent) this.foregroundLayer.parent.removeChild(this.foregroundLayer);
            parent.addChild(this.backLayer);
            parent.addChild(this.frontLayer);
            parent.addChild(this.foregroundLayer);
        }
    };

    YumeArmManager.prototype.syncTransform = function() {
        var actor = this.owner;
        [this.backLayer, this.frontLayer, this.foregroundLayer].forEach(function(layer) {
            layer.x = actor.x;
            layer.y = actor.y;
            layer.scale.x = actor.scale.x;
            layer.scale.y = actor.scale.y;
            layer.rotation = actor.rotation;
            layer.visible = actor.visible;
            layer.alpha = actor.alpha;
        });
        // Most weapons stay behind Yume; the drill has a separate contact layer.
        this.backLayer.z = actor.z - 0.1;
        this.frontLayer.z = actor.z - 0.05;
        var target = actor.targetSprite && actor.targetSprite();
        this.foregroundLayer.z = Math.max(actor.z, target && finiteNumber(target.z) ? target.z : actor.z) + 0.05;
    };

    YumeArmManager.prototype.update = function() {
        var actor = this.owner;
        if (!isYume(actor) || actor._battler.isDead()) {
            this.clear();
            return;
        }
        for (var flightIndex = this.missileFlights.length - 1; flightIndex >= 0; flightIndex--) {
            var flight = this.missileFlights[flightIndex];
            if (flight.bullet._finish === 2) this.missileFlights.splice(flightIndex, 1);
            else if (flight.waiting && !flight.resolved) flight.action.wait = 1;
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
        if (this.foregroundLayer.parent) this.foregroundLayer.parent.removeChild(this.foregroundLayer);
    };

    YumeArmManager.prototype.clear = function() {
        this.missileFlights.forEach(function(flight) { flight.cancel(); });
        this.missileFlights.length = 0;
        var keys = Object.keys(this.arms);
        for (var i = 0; i < keys.length; i++) this.arms[keys[i]].dispose();
        this.arms = Object.create(null);
        this.detach();
    };

    var _startAction = Sprite_NewActor.prototype.startAction;
    Sprite_NewActor.prototype.startAction = function(skillId, actionInfo, judgment, buttonSprite) {
        var skill = $dataSkills && $dataSkills[skillId];
        if (!this._actionTest && isYume(this) && buttonSprite && buttonSprite._judged &&
            buttonSprite._info && buttonSprite._info.rush && skill && skill.meta &&
            /(^|\n)\s*yumeArmGatling\s*(?::|\n|$)/.test(skill.meta.animation || '')) return null;
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
            if (name === 'yumeArmWeaponAnime' && parsed.weapon === 'flamethrower') duration += 6;
            if (parsed.wait || isLast) action.wait = duration;
        }
        if (!isYume(this)) return true;
        if (action.test) {
            if (name === 'yumeArmMissile' && action._yumeProbe && action._yumeProbe.weapon === 'missile') {
                var missileManager = Object.create(YumeArmManager.prototype);
                missileManager.owner = this;
                var missilePose = action._yumeProbe;
                var missileArm = { manager: missileManager, weapon: 'missile', routeStyle: 0, weaponScale: 1 };
                var missileTarget = this.targetSprite && this.targetSprite();
                var missileCenter = missileManager.enemyCenterLocal(missileTarget, 0, 0);
                var missileLayout = YumeArm.prototype.poseTarget.call(missileArm,
                    missilePose.pose, missilePose.x, missilePose.y, missileCenter);
                missileArm.points = missileLayout.points; missileArm.angle = missileLayout.angle;
                var launch = missileManager.missileLaunchInfo(missileArm);
                var destination = missileManager.missileTargetInfo();
                if (launch && destination) {
                    var simulation = newMissileFlight(launch, destination, parsed.duration);
                    while (simulation.elapsed < simulation.limit && !stepMissileFlight(simulation, destination)) {}
                    if (parsed.wait || isLast) action.wait = simulation.elapsed;
                    if (parsed.apply && simulation.hit) {
                        action.applyList = action.applyList || [];
                        // The launch pose already counts as the first flight tick.
                        action.applyList[simulation.elapsed - 2] = true;
                    }
                }
            }
            if (name === 'yumeArmMachineGun' || name === 'yumeArmGatling') {
                action.applyList = action.applyList || [];
                var gun = name === 'yumeArmMachineGun' ? WEAPONS.machineGun : WEAPONS.gatling;
                for (var shot = 0; shot < (gun.burst || 1); shot++)
                    action.applyList[gun.deployFrames + 4 + shot * 6] = true;
            }
            if (name === 'yumeArmDrill' && parsed.apply) this.actionApply(action);
            if (name === 'yumeArmChargeShot' && parsed.apply && action._yumeProbe &&
                action._yumeProbe.weapon === 'chargeCannon') {
                action.applyList = action.applyList || [];
                // Count zero is sampled immediately with the firing pose.
                action.applyList[parsed.duration - 2] = true;
            }
            if (name === 'yumeArmOut') action._yumeProbe = {
                weapon: parsed.weapon, pose: parsed.pose, x: parsed.x, y: parsed.y
            };
            if (name === 'yumeArmMove' && action._yumeProbe) {
                action._yumeProbe.pose = parsed.pose;
                action._yumeProbe.x = parsed.x; action._yumeProbe.y = parsed.y;
            }
            if (name === 'yumeArmFlame' && parsed.apply && action._yumeProbe &&
                action._yumeProbe.weapon === 'flamethrower') {
                // Resolve geometry without allocating sprites or changing battlers.
                var probeManager = Object.create(YumeArmManager.prototype);
                probeManager.owner = this;
                var state = action._yumeProbe;
                var probeArm = { manager: probeManager, weapon: state.weapon, routeStyle: 0 };
                var probeTarget = this.targetSprite && this.targetSprite();
                var center = probeManager.enemyCenterLocal(probeTarget, 0, 0);
                var layout = YumeArm.prototype.poseTarget.call(probeArm, state.pose, state.x, state.y, center);
                probeArm.points = layout.points; probeArm.angle = layout.angle;
                if (flameTouches(probeArm, 3)) this.actionApply(action);
                else if (flameTouches(probeArm, 4)) {
                    action.applyList = action.applyList || [];
                    // The rig also advances once on the command's own tick.
                    action.applyList[4] = true;
                }
            }
            return true;
        }
        var manager = this._yumeArmManager || (this._yumeArmManager = new YumeArmManager(this));
        if (name === 'yumeArmMachineGun') {
            manager.ensureArm(action.skillId, 'machineGun').queueMachineGun(action);
            return true;
        }
        if (name === 'yumeArmGatling') {
            manager.ensureArm(action.skillId, 'gatling').queueGatling(action);
            return true;
        }
        // Effects already queued by an earlier action keep their own timing.
        if (name !== 'yumeArmAnimation' && name !== 'yumeArmBullet' && action._yumeSequence &&
            action._yumeSequence < (manager.latestSequenceBySkill[String(action.skillId)] || 0)) return true;
        var arm = name === 'yumeArmOut' ? manager.ensureArm(action.skillId, parsed.weapon) :
            manager.armFor(action.skillId);
        if (!arm) return true;
        if (!action._yumeSequence) action._yumeSequence = ++manager.nextSequence;
        if (name !== 'yumeArmOut' && name !== 'yumeArmAnimation' && name !== 'yumeArmBullet' &&
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
        } else if (name === 'yumeArmDrill') {
            arm.startDrill(parsed.duration, parsed.distance);
            if (parsed.apply && arm.drillMotion) this.actionApply(action);
        } else if (name === 'yumeArmFlame') {
            var owner = this;
            arm.startFlame(parsed.burnFrames, parsed.apply ? function() { owner.actionApply(action); } : null);
        } else if (name === 'yumeArmCharge') {
            arm.startCharge(parsed.duration);
        } else if (name === 'yumeArmChargeShot') {
            var chargeOwner = this;
            manager.fireChargedShot(arm, parsed.image, parsed.duration,
                parsed.apply ? function() { chargeOwner.actionApply(action); } : null);
        } else if (name === 'yumeArmMissile') {
            var missile = manager.fireHomingMissile(arm, action, parsed.duration, parsed.apply, parsed.wait || isLast);
            if (!missile && (parsed.wait || isLast)) action.wait = 0;
        } else if (name === 'yumeArmAnimation') {
            manager.playAnimationAtWeapon(arm, parsed.id, parsed.x, parsed.y, parsed.mirror);
        } else if (name === 'yumeArmBullet') {
            manager.fireBullet(arm, parsed.image, parsed.duration);
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
