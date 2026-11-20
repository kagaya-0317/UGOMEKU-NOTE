//=============================================================================
// KNH_ZXC_Gimmick_SpikeFloor.js
//=============================================================================

/*:
 * @plugindesc Spike floor map damage gimmick.
 * @author kagaya
 *
 * @help
 * Call every frame near the spike floor:
 *   this.command_updateSpikeFloor(eventId, x, y, w, h);
 *
 * Debug trace from the console:
 *   SpikeFloorTrace();
 *   SpikeFloorTrace(1800);
 *   SpikeFloorTraceStop();
 */

(function() {
    'use strict';

    var DAMAGE_VALUE = 1;
    var PLAYER_IMAGE = ['$001_5', 0, 4];
    var FOLLOWER1_IMAGE = ['$002_4', 0, 2];
    var FOLLOWER2_IMAGE = ['$003_4', 0, 2];
    var HIT_JUMP_PIXEL_HEIGHT = 144;
    var HIT_JUMP_DURATION = 2.0;
    var BOUNCE_HEIGHT = 1.0;
    var BOUNCE_DURATION = 0.9;
    var PRE_JUMP_WAIT_FRAMES = 24;
    var LANDING_AWAY_OFFSET = 0.5;
    var SPIKE_FOLLOWER_TRACE_DEFAULT_FRAMES = 600;
    var SPIKE_FOLLOWER_TRACE_WATCH_FRAMES = 180;

    Game_Interpreter.prototype.command_updateSpikeFloor = function(eventId, x, y, w, h) {
        eventId = Math.floor(Number(eventId || 0) || 0);
        x = Number(x || 0) || 0;
        y = Number(y || 0) || 0;
        w = Number(w || 0) || 0;
        h = Number(h || 0) || 0;
        if (w <= 0 || h <= 0) return false;

        registerSpikeFloorRect_(eventId, x, y, w, h);
        var event = eventId > 0 ? $gameMap.event(eventId) : this.character(eventId);
        var targets = spikeFloorTargets_();
        refreshSpikeFloorSafePositions_(targets);
        var active = isSpikeFloorActive_(event);
        var hits = [];
        for (var i = 0; i < targets.length; i++) {
            var target = targets[i];
            var key = spikeFloorLockKey_(eventId, target.key);
            var inside = target.ch && isCharacterInRect_(target.ch, x, y, w, h);
            if (!active || !inside) {
                setSpikeFloorLock_(key, false);
            } else if (!isSpikeFloorLocked_(key) && canDamageSpikeFloorTarget_(target)) {
                setSpikeFloorLock_(key, true);
                target.hitRect = { x: x, y: y, w: w, h: h };
                hits.push(target);
            }
        }
        setupSpikeFloorHitJumpPositions_(hits);
        if (hits.length > 0) playSpikeFloorDamageSe_();
        for (var j = 0; j < hits.length; j++) {
            applySpikeFloorDamage_(hits[j]);
        }
        return hits.length > 0;
    };

    function isSpikeFloorActive_(event) {
        if (!event || event._erased) return false;
        if (event._spikeFloorActive !== undefined && event._spikeFloorActive !== null) {
            return !!event._spikeFloorActive;
        }
        var cell = spikeFloorCurrentFrameCell_(event);
        return cell >= 3 && cell <= 5;
    };

    function spikeFloorCurrentFrameCell_(character) {
        if (character && character._frameAnimation && character._frameAnimCells) {
            var index = Math.max(0, Math.floor(Number(character._frameAnimIndex || 0) || 0));
            var cells = character._frameAnimCells;
            if (index < cells.length) return Math.floor(Number(cells[index] || 0) || 0);
        }
        var pattern = Math.max(0, Math.floor(Number(character && character._pattern || 0) || 0));
        var direction = Math.max(2, Math.floor(Number(character && character._direction || 2) || 2));
        return (Math.floor(direction / 2) - 1) * 3 + pattern;
    };

    function spikeFloorTargets_() {
        var targets = [];
        var leader = $gameParty && $gameParty.leader ? $gameParty.leader() : null;
        if ($gamePlayer && leader) {
            targets.push({ key: 'player', ch: $gamePlayer, actor: leader, image: PLAYER_IMAGE, player: true });
        }
        var followers = spikeFloorFollowers_();
        addSpikeFloorFollowerTarget_(targets, followers, 1, 'follower1', FOLLOWER1_IMAGE);
        addSpikeFloorFollowerTarget_(targets, followers, 3, 'follower2', FOLLOWER2_IMAGE);
        return targets;
    };

    function addSpikeFloorFollowerTarget_(targets, followers, index, key, image) {
        var ch = followers && followers.follower ? followers.follower(index) : null;
        if (!ch || (ch.isVisible && !ch.isVisible())) return;
        var actor = ch.actor ? ch.actor() : null;
        if (!actor) return;
        targets.push({ key: key, ch: ch, actor: actor, image: image, player: false });
    };

    function spikeFloorFollowers_() {
        return $gamePlayer && $gamePlayer.followers ? $gamePlayer.followers() : null;
    };

    function spikeFloorFollowerData_() {
        var followers = spikeFloorFollowers_();
        return followers && followers._data;
    };

    function isSpikeFloorFollower_(character) {
        return typeof Game_Follower !== 'undefined' && character instanceof Game_Follower;
    };

    function isCharacterInRect_(character, x, y, w, h) {
        var cx = Number(character._realX != null ? character._realX : character.x);
        var cy = Number(character._realY != null ? character._realY : character.y);
        return cx >= x && cy >= y && cx < x + w && cy < y + h;
    };

    function characterMapPosition_(character) {
        if (!character) return null;
        return {
            x: Number(character._realX != null ? character._realX : character.x),
            y: Number(character._realY != null ? character._realY : character.y)
        };
    };

    function registerSpikeFloorRect_(eventId, x, y, w, h) {
        var rects = spikeFloorKnownRects_();
        if (!rects) return;
        rects[spikeFloorLockKey_(eventId, 'rect')] = {
            mapId: $gameMap.mapId(),
            x: x,
            y: y,
            w: w,
            h: h
        };
    };

    function spikeFloorKnownRects_() {
        if (!$gameTemp) return null;
        if (!$gameTemp._spikeFloorKnownRects) $gameTemp._spikeFloorKnownRects = Object.create(null);
        return $gameTemp._spikeFloorKnownRects;
    };

    function isCharacterInAnySpikeFloorRect_(character) {
        var rects = spikeFloorKnownRects_();
        if (!rects) return false;
        var mapId = $gameMap.mapId();
        for (var key in rects) {
            var rect = rects[key];
            if (rect && rect.mapId === mapId && isCharacterInRect_(character, rect.x, rect.y, rect.w, rect.h)) {
                return true;
            }
        }
        return false;
    };

    function refreshSpikeFloorSafePositions_(targets) {
        for (var i = 0; i < targets.length; i++) {
            refreshSpikeFloorSafePosition_(targets[i].ch);
        }
    };

    function refreshSpikeFloorSafePosition_(character) {
        if (!character || character._spikeFloorDamageState) return;
        if (character.isJumping && character.isJumping()) return;
        if (character.isMoving && character.isMoving()) return;
        if (isCharacterInAnySpikeFloorRect_(character)) return;
        character._spikeFloorLastSafePosition = characterMapPosition_(character);
    };

    function spikeFloorSafePosition_(character) {
        var safe = character && character._spikeFloorLastSafePosition;
        if (safe) return { x: safe.x, y: safe.y };
        return characterMapPosition_(character);
    };

    function setupSpikeFloorHitJumpPositions_(hits) {
        var playerHit = false;
        for (var i = 0; i < hits.length; i++) {
            if (hits[i].player) {
                playerHit = true;
                break;
            }
        }
        var playerPosition = characterMapPosition_($gamePlayer);
        for (var j = 0; j < hits.length; j++) {
            var target = hits[j];
            if (!target.player && !playerHit && playerPosition) {
                target.jumpPosition = { x: playerPosition.x, y: playerPosition.y };
            } else {
                target.jumpPosition = spikeFloorSafePosition_(target.ch);
            }
            var basePosition = target.jumpPosition;
            target.jumpPosition = spikeFloorMoveLandingAwayFromRect_(target.jumpPosition, target.hitRect, target.ch, 'landing-away');
            target.jumpPosition = spikeFloorFollowerLandingAvoidFrontOverlap_(target.jumpPosition, target.hitRect, target.ch, hits);
            logSpikeFloorTrace_('hit-plan', [
                'target=' + target.key,
                'playerHit=' + playerHit,
                spikeFloorCharacterStateText_('char', target.ch),
                'base=' + spikeFloorPointText_(basePosition),
                'landing=' + spikeFloorPointText_(target.jumpPosition),
                'rect=' + spikeFloorRectText_(target.hitRect)
            ]);
        }
        if (playerHit) {
            var peak = spikeFloorJumpPeakForPixels_(HIT_JUMP_PIXEL_HEIGHT);
            for (var k = 0; k < hits.length; k++) {
                hits[k].hitJumpPeak = peak;
            }
            waitSpikeFloorUnhitFollowersForPlayer_(hits);
        }
    };

    function waitSpikeFloorUnhitFollowersForPlayer_(hits) {
        var data = spikeFloorFollowerData_();
        if (!data) return;
        for (var i = 0; i < data.length; i++) {
            var follower = data[i];
            if (follower && !isSpikeFloorHitCharacter_(hits, follower)) {
                follower._spikeFloorWaitForPlayerHitJump = true;
            }
        }
    };

    function isSpikeFloorHitCharacter_(hits, character) {
        for (var i = 0; i < hits.length; i++) {
            if (hits[i].ch === character) return true;
        }
        return false;
    };

    function spikeFloorFollowerLandingAvoidFrontOverlap_(position, rect, character, hits) {
        if (!position || !rect) return position;
        if (!isSpikeFloorFollower_(character)) return position;
        var data = spikeFloorFollowerData_();
        if (!data) return position;
        var index = data.indexOf(character);
        if (index < 0) return position;
        var result = spikeFloorSnapPosition_(position);
        var maxAttempts = Math.max(1, index + 1);
        for (var i = 0; i < maxAttempts; i++) {
            var blocker = spikeFloorFrontLandingOverlapBlocker_(result, data, index, hits);
            if (!blocker) break;
            var before = result;
            result = spikeFloorMoveLandingAwayFromRect_(result, rect, character, 'landing-overlap-away', [
                'blocker=' + blocker.label,
                'blockerPos=' + spikeFloorPointText_(blocker.position),
                'attempt=' + (i + 1)
            ]);
            if (spikeFloorSamePosition_(before, result)) break;
        }
        return result;
    };

    function spikeFloorFrontLandingOverlapBlocker_(position, data, index, hits) {
        var result = spikeFloorSnapPosition_(position);
        var playerPosition = spikeFloorPlannedOrAnchorPosition_($gamePlayer, hits);
        if (spikeFloorSamePosition_(result, playerPosition)) {
            return { label: 'player', position: playerPosition };
        }
        for (var i = 0; i < index; i++) {
            var follower = data[i];
            if (!follower) continue;
            var followerPosition = spikeFloorPlannedOrAnchorPosition_(follower, hits);
            if (spikeFloorSamePosition_(result, followerPosition)) {
                return { label: spikeFloorCharacterLabel_(follower), position: followerPosition };
            }
        }
        return null;
    };

    function spikeFloorPlannedOrAnchorPosition_(character, hits) {
        if (!character) return null;
        for (var i = 0; hits && i < hits.length; i++) {
            if (hits[i] && hits[i].ch === character && hits[i].jumpPosition) {
                return spikeFloorSnapPosition_(hits[i].jumpPosition);
            }
        }
        if (character._spikeFloorDamageState && character._spikeFloorDamageState.jumpPosition) {
            return spikeFloorSnapPosition_(character._spikeFloorDamageState.jumpPosition);
        }
        return spikeFloorAnchorPosition_(character);
    };

    function spikeFloorSamePosition_(a, b) {
        a = spikeFloorSnapPosition_(a);
        b = spikeFloorSnapPosition_(b);
        return !!(a && b && Math.abs(a.x - b.x) < 0.001 && Math.abs(a.y - b.y) < 0.001);
    };

    function spikeFloorMoveLandingAwayFromRect_(position, rect, character, tag, extraParts) {
        if (!position || !rect) return position;
        var raw = { x: position.x, y: position.y };
        var result = spikeFloorSnapPosition_(position);
        var before = { x: result.x, y: result.y };
        var centerX = rect.x + rect.w / 2;
        var centerY = rect.y + rect.h / 2;
        var dx = result.x - centerX;
        var dy = result.y - centerY;
        if (dx === 0 && dy === 0) {
            var fallback = characterMapPosition_(character);
            dx = fallback ? fallback.x - centerX : 1;
            dy = fallback ? fallback.y - centerY : 0;
        }
        if (Math.abs(dx) >= Math.abs(dy)) {
            result.x += dx < 0 ? -LANDING_AWAY_OFFSET : LANDING_AWAY_OFFSET;
        } else {
            result.y += dy < 0 ? -LANDING_AWAY_OFFSET : LANDING_AWAY_OFFSET;
        }
        result = spikeFloorSnapPosition_(result);
        var parts = [
            spikeFloorCharacterStateText_('char', character),
            'raw=' + spikeFloorPointText_(raw),
            'from=' + spikeFloorPointText_(before),
            'to=' + spikeFloorPointText_(result),
            'center=' + spikeFloorPointText_({ x: centerX, y: centerY }),
            'delta=' + spikeFloorPointText_({ x: dx, y: dy }),
            'rect=' + spikeFloorRectText_(rect)
        ];
        if (extraParts) {
            for (var i = 0; i < extraParts.length; i++) parts.push(extraParts[i]);
        }
        logSpikeFloorTrace_(tag || 'landing-away', parts);
        return result;
    };

    function clearSpikeFloorSafePositions_() {
        if (!$gamePlayer) return;
        $gamePlayer._spikeFloorLastSafePosition = null;
        var followers = spikeFloorFollowers_();
        if (followers && followers.forEach) {
            followers.forEach(function(follower) {
                follower._spikeFloorLastSafePosition = null;
                follower._spikeFloorNoChaseWhileJumping = false;
                follower._spikeFloorWaitForPlayerHitJump = false;
                follower._spikeFloorWaitForFollowerHitJumpTarget = null;
                follower._spikeFloorTraceWatch = 0;
            });
        }
    };

    function spikeFloorLockKey_(eventId, key) {
        return [$gameMap.mapId(), eventId, key].join(':');
    };

    function spikeFloorLocks_() {
        if (!$gameTemp._spikeFloorLocks) $gameTemp._spikeFloorLocks = Object.create(null);
        return $gameTemp._spikeFloorLocks;
    };

    function isSpikeFloorLocked_(key) {
        return !!spikeFloorLocks_()[key];
    };

    function setSpikeFloorLock_(key, value) {
        var locks = spikeFloorLocks_();
        if (value) locks[key] = true;
        else delete locks[key];
    };

    function canDamageSpikeFloorTarget_(target) {
        return target && target.ch && target.actor && target.actor.hp > 0 && !target.ch._spikeFloorDamageState;
    };

    function applySpikeFloorDamage_(target) {
        applySpikeFloorHpDamage_(target);
        target.ch.startSpikeFloorDamageMotion(target);
    };

    function playSpikeFloorDamageSe_() {
        if ($gameSystem && $gameSystem.playSe) {
            $gameSystem.playSe('Slash5', 90, 100);
        } else if (typeof AudioManager !== 'undefined' && AudioManager.playSe) {
            AudioManager.playSe({ name: 'Slash5', volume: 90, pitch: 100, pan: 0 });
        }
    };

    function applySpikeFloorHpDamage_(target) {
        var actor = target.actor;
        if (!actor) return;
        actor.clearResult();
        actor.result().hpAffected = true;
        actor.result().hpDamage = DAMAGE_VALUE;
        actor.result().critical = false;
        actor.setHp(Math.max(1, actor.hp - DAMAGE_VALUE));
        if ($gameMap.requestMapDamagePopup) {
            $gameMap.requestMapDamagePopup(target.ch, DAMAGE_VALUE, { isActor: true });
        }
    };

    Game_CharacterBase.prototype.startSpikeFloorDamageMotion = function(target) {
        if (!target || this._spikeFloorDamageState) return;
        var state = this._spikeFloorDamageState = {
            phase: 'wait',
            waitCount: PRE_JUMP_WAIT_FRAMES,
            image: target.image,
            player: !!target.player,
            jumpPosition: target.jumpPosition || spikeFloorSafePosition_(this),
            hitJumpPeak: target.hitJumpPeak,
            restore: snapshotSpikeFloorCharacter_(this)
        };
        if (!target.player) waitSpikeFloorTrailingFollowersForHit_(this);
        startSpikeFloorPreJumpGatagata_(this, state);
        applySpikeFloorDamagePose_(this, state);
    };

    function snapshotSpikeFloorCharacter_(character) {
        return {
            characterName: character._characterName,
            characterIndex: character._characterIndex,
            direction: character._direction,
            pattern: character._pattern,
            walkAnime: character._walkAnime,
            stepAnime: character._stepAnime,
            directionFix: character._directionFix,
            patternFix: character._patternFix,
            gatagata: character._gatagata,
            gatagataCount: character._gatagataCount,
            gatagataPos: character._gatagataPos ? { x: character._gatagataPos.x, y: character._gatagataPos.y } : null
        };
    };

    function startSpikeFloorPreJumpGatagata_(character, state) {
        if (!state || state.gatagataStarted) return;
        state.gatagataStarted = true;
        if (character.startGatagata) {
            character.startGatagata();
        } else {
            character._gatagata = true;
            character._gatagataCount = 0;
            character._gatagataPos = { x: 0, y: 0 };
        }
    };

    function restoreSpikeFloorGatagata_(character, state) {
        if (!state || !state.gatagataStarted) return;
        var r = state.restore;
        if (!r) return;
        character._gatagata = r.gatagata;
        character._gatagataCount = r.gatagataCount || 0;
        character._gatagataPos = r.gatagataPos ? { x: r.gatagataPos.x, y: r.gatagataPos.y } : { x: 0, y: 0 };
        state.gatagataStarted = false;
    };

    function keepSpikeFloorPreJumpGatagata_(character) {
        character._gatagata = true;
        if (!character._gatagataPos) character._gatagataPos = { x: 0, y: 0 };
    };

    function startSpikeFloorHitJump_(character, state) {
        var position = state.jumpPosition || spikeFloorSafePosition_(character);
        var xPlus = position ? position.x - character.x : 0;
        var yPlus = position ? position.y - character.y : 0;
        var peak = state.hitJumpPeak || spikeFloorJumpPeakForPixels_(HIT_JUMP_PIXEL_HEIGHT);
        markSpikeFloorTraceWatch_(character);
        logSpikeFloorTrace_('jump-start', [
            spikeFloorCharacterStateText_('char', character),
            'to=' + spikeFloorPointText_(position),
            'plus=' + spikeFloorPointText_({ x: xPlus, y: yPlus }),
            'peak=' + spikeFloorNumberText_(peak),
            'player=' + !!state.player
        ]);
        jumpSpikeFloorCharacter_(character, xPlus, yPlus, peak, HIT_JUMP_DURATION, state.player);
    };

    function startSpikeFloorBounce_(character, state) {
        var peak = Math.max(1, Math.round(spikeFloorBaseJumpPeak_(character, 0, 0) * BOUNCE_HEIGHT));
        jumpSpikeFloorCharacter_(character, 0, 0, peak, BOUNCE_DURATION, state.player);
    };

    function jumpSpikeFloorCharacter_(character, xPlus, yPlus, peak, durationRate, player) {
        var heightRate = spikeFloorJumpHeightRate_(character, xPlus, yPlus, peak);
        if (player) {
            Game_Character.prototype.jump.call(character, xPlus, yPlus, heightRate, durationRate);
        } else {
            character.jump(xPlus, yPlus, heightRate, durationRate);
            lockSpikeFloorFollowerChaseDuringJump_(character);
        }
    };

    function lockSpikeFloorFollowerChaseDuringJump_(character) {
        if (isSpikeFloorFollower_(character)) character._spikeFloorNoChaseWhileJumping = true;
    };

    function updateSpikeFloorFollowerChaseLock_(follower) {
        if (follower._spikeFloorNoChaseWhileJumping && !follower.isJumping()) {
            follower._spikeFloorNoChaseWhileJumping = false;
        }
        if (follower._spikeFloorWaitForPlayerHitJump && !isSpikeFloorPlayerDamageActive_()) {
            follower._spikeFloorWaitForPlayerHitJump = false;
        }
        var waitTarget = follower._spikeFloorWaitForFollowerHitJumpTarget;
        if (waitTarget && !waitTarget._spikeFloorDamageState) {
            follower._spikeFloorWaitForFollowerHitJumpTarget = null;
        }
    };

    function updateSpikeFloorFollowerWaitPose_(follower) {
        if ((follower._spikeFloorWaitForPlayerHitJump || follower._spikeFloorWaitForFollowerHitJumpTarget) &&
            !follower._spikeFloorDamageState) {
            follower._stepAnime = false;
        }
    };

    function spikeFloorFollowerChaseBlock_(follower) {
        if (follower._spikeFloorDamageState) return { tag: 'chase-block-damageMotion' };
        if (follower._spikeFloorNoChaseWhileJumping && follower.isJumping()) return { tag: 'chase-block-noChaseJump' };
        if (follower._spikeFloorWaitForPlayerHitJump) {
            if (isSpikeFloorPlayerDamageActive_()) return { tag: 'chase-block-waitPlayerHit' };
            follower._spikeFloorWaitForPlayerHitJump = false;
        }
        var waitTarget = follower._spikeFloorWaitForFollowerHitJumpTarget;
        if (!waitTarget) return null;
        if (waitTarget._spikeFloorDamageState) {
            return {
                tag: 'chase-block-waitFollowerHit',
                extra: 'waitTarget=' + spikeFloorCharacterLabel_(waitTarget)
            };
        }
        follower._spikeFloorWaitForFollowerHitJumpTarget = null;
        return null;
    };

    function isSpikeFloorPlayerDamageActive_() {
        return !!($gamePlayer && $gamePlayer._spikeFloorDamageState);
    };

    function spikeFloorJumpHeightRate_(character, xPlus, yPlus, peak) {
        return peak / spikeFloorBaseJumpPeak_(character, xPlus, yPlus);
    };

    function spikeFloorJumpPeakForPixels_(height) {
        return Math.max(1, Math.round(Math.sqrt(Math.max(1, Number(height || 0) || 0) * 2)));
    };

    function spikeFloorBaseJumpPeak_(character, xPlus, yPlus) {
        var distance = Math.round(Math.hypot(xPlus, yPlus));
        return Math.max(1, 10 + distance - character._moveSpeed);
    };

    function applySpikeFloorDamagePose_(character, state) {
        var image = state.image || PLAYER_IMAGE;
        if (character._characterName !== image[0] || character._characterIndex !== image[1]) {
            character.setImageZXC(image[0], image[1], image[2]);
        } else {
            character._direction = image[2];
        }
        character._direction = image[2];
        character._directionFix = true;
        character._stepAnime = true;
        character._patternFix = false;
    };

    function restoreSpikeFloorCharacter_(character, state) {
        var r = state && state.restore;
        if (!r) return;
        restoreSpikeFloorGatagata_(character, state);
        character.setImageZXC(r.characterName, r.characterIndex, r.direction);
        character._pattern = r.pattern;
        character._walkAnime = r.walkAnime;
        character._stepAnime = false;
        character._directionFix = r.directionFix;
        character._patternFix = r.patternFix;
        character._stopCount = 0;
    };

    Game_CharacterBase.prototype.updateSpikeFloorDamageMotion = function() {
        var state = this._spikeFloorDamageState;
        if (!state) return;
        applySpikeFloorDamagePose_(this, state);
        if (state.phase === 'wait') {
            keepSpikeFloorPreJumpGatagata_(this);
            if (state.waitCount > 0) {
                state.waitCount--;
                return;
            }
            state.phase = 'hit';
            restoreSpikeFloorGatagata_(this, state);
            startSpikeFloorHitJump_(this, state);
            applySpikeFloorDamagePose_(this, state);
        } else if (state.phase === 'hit' && !this.isJumping()) {
            state.phase = 'bounce';
            startSpikeFloorBounce_(this, state);
            applySpikeFloorDamagePose_(this, state);
        } else if (state.phase === 'bounce' && !this.isJumping()) {
            restoreSpikeFloorCharacter_(this, state);
            stabilizeSpikeFloorFollowerChain_(this);
            this._spikeFloorDamageState = null;
        }
    };

    function stabilizeSpikeFloorFollowerChain_(character) {
        if (typeof Game_Follower === 'undefined') return;
        var data = spikeFloorFollowerData_();
        if (!data) return;
        var index = character === $gamePlayer ? -1 : data.indexOf(character);
        if (character !== $gamePlayer && index < 0) return;
        logSpikeFloorTrace_('stabilize-before', spikeFloorChainSnapshot_(data, index));
        syncSpikeFloorCharacterTraceOnly_($gamePlayer);
        rebuildSpikeFloorSpacerFollowers_(data);
        for (var i = 0; i < data.length; i++) {
            syncSpikeFloorHalfMoveTrace_(data[i]);
            if (data[i] && data[i]._spikeFloorWaitForFollowerHitJumpTarget === character) {
                data[i]._spikeFloorWaitForFollowerHitJumpTarget = null;
            }
        }
        markSpikeFloorFollowerChainWatch_(data);
        logSpikeFloorTrace_('stabilize-after', spikeFloorChainSnapshot_(data, index));
    };

    function rebuildSpikeFloorSpacerFollowers_(data) {
        var anchors = spikeFloorFollowerAnchors_(data);
        if (anchors.length < 2) return;
        for (var i = 0; i < data.length; i++) {
            var follower = data[i];
            if (!isSpikeFloorSpacerFollower_(follower)) continue;
            var position = spikeFloorSpacerPosition_(anchors, i);
            if (position) placeSpikeFloorFollowerNodeAt_(follower, position);
        }
    };

    function spikeFloorFollowerAnchors_(data) {
        var anchors = [];
        if ($gamePlayer) anchors.push({ index: -1, ch: $gamePlayer, pos: spikeFloorAnchorPosition_($gamePlayer) });
        for (var i = 0; i < data.length; i++) {
            if (isSpikeFloorVisibleFollower_(data[i])) {
                anchors.push({ index: i, ch: data[i], pos: spikeFloorAnchorPosition_(data[i]) });
            }
        }
        return anchors;
    };

    function spikeFloorSpacerPosition_(anchors, index) {
        var before = null;
        var after = null;
        for (var i = 0; i < anchors.length; i++) {
            if (anchors[i].index < index) before = anchors[i];
            else if (anchors[i].index > index) {
                after = anchors[i];
                break;
            }
        }
        if (before && after) {
            var range = Math.max(1, after.index - before.index);
            var t = (index - before.index) / range;
            return spikeFloorSnapPosition_({
                x: before.pos.x + (after.pos.x - before.pos.x) * t,
                y: before.pos.y + (after.pos.y - before.pos.y) * t
            });
        }
        if (before && anchors.length >= 2) {
            var prev = anchors[Math.max(0, anchors.indexOf(before) - 1)];
            var stepCount = Math.max(1, before.index - prev.index);
            var stepX = (before.pos.x - prev.pos.x) / stepCount;
            var stepY = (before.pos.y - prev.pos.y) / stepCount;
            var offset = index - before.index;
            return spikeFloorSnapPosition_({
                x: before.pos.x + stepX * offset,
                y: before.pos.y + stepY * offset
            });
        }
        return null;
    };

    function spikeFloorAnchorPosition_(character) {
        return spikeFloorSnapPosition_({
            x: character._x != null ? character._x : character.x,
            y: character._y != null ? character._y : character.y
        });
    };

    function isSpikeFloorVisibleFollower_(follower) {
        return !!(follower && follower.actor && follower.actor());
    };

    function isSpikeFloorSpacerFollower_(follower) {
        return !!(follower && (!follower.actor || !follower.actor()));
    };

    function placeSpikeFloorFollowerNodeAt_(follower, position) {
        if (!follower || !position) return;
        var pos = spikeFloorSnapPosition_(position);
        follower._x = follower._realX = follower._prevX = pos.x;
        follower._y = follower._realY = follower._prevY = pos.y;
        follower._lastInfoPrevX = undefined;
        follower._lastInfoPrevY = undefined;
    };

    function waitSpikeFloorTrailingFollowersForHit_(character) {
        if (!isSpikeFloorFollower_(character)) return;
        var data = spikeFloorFollowerData_();
        if (!data) return;
        var index = data.indexOf(character);
        if (index < 0) return;
        for (var i = index + 1; i < data.length; i++) {
            if (data[i] && data[i] !== character) {
                data[i]._spikeFloorWaitForFollowerHitJumpTarget = character;
                markSpikeFloorTraceWatch_(data[i]);
            }
        }
        logSpikeFloorTrace_('tail-wait-start', spikeFloorChainSnapshot_(data, index));
    };

    function syncSpikeFloorHalfMoveTrace_(character) {
        if (character && character.resetPrevPos) character.resetPrevPos();
        syncSpikeFloorCharacterTraceOnly_(character);
    };

    function syncSpikeFloorCharacterTraceOnly_(character) {
        if (!character) return;
        character._prevX = spikeFloorHalfStep_(character._realX != null ? character._realX : character._x);
        character._prevY = spikeFloorHalfStep_(character._realY != null ? character._realY : character._y);
        character._lastInfoPrevX = undefined;
        character._lastInfoPrevY = undefined;
    };

    function snapSpikeFloorCharacterGrid_(character) {
        if (!character) return;
        var x = spikeFloorHalfStep_(character._x);
        var y = spikeFloorHalfStep_(character._y);
        var wasMoving = character.isMoving && character.isMoving();
        character._x = x;
        character._y = y;
        if (!wasMoving && !(character.isJumping && character.isJumping())) {
            character._realX = x;
            character._realY = y;
        }
    };

    function sanitizeSpikeFloorFollowerGrid_(character) {
        if (!isSpikeFloorFollower_(character)) return;
        var oldX = character._x;
        var oldY = character._y;
        var oldPrevX = character._prevX;
        var oldPrevY = character._prevY;
        snapSpikeFloorCharacterGrid_(character);
        if (character._prevX !== undefined) character._prevX = spikeFloorHalfStep_(character._prevX);
        if (character._prevY !== undefined) character._prevY = spikeFloorHalfStep_(character._prevY);
        if (oldX !== character._x || oldY !== character._y ||
            oldPrevX !== character._prevX || oldPrevY !== character._prevY) {
            logSpikeFloorTrace_('grid-snap', [
                spikeFloorCharacterStateText_('char', character),
                'old=' + spikeFloorPointText_({ x: oldX, y: oldY }),
                'oldPrev=' + spikeFloorPointText_({ x: oldPrevX, y: oldPrevY })
            ]);
        }
    };

    function spikeFloorSnapPosition_(position) {
        if (!position) return null;
        return {
            x: spikeFloorHalfStep_(position.x),
            y: spikeFloorHalfStep_(position.y)
        };
    };

    function spikeFloorHalfStep_(value) {
        var n = Number(value || 0) || 0;
        return Math.round(n / 0.5) * 0.5;
    };

    function markSpikeFloorFollowerChainWatch_(data) {
        if (!data) return;
        for (var i = 0; i < data.length; i++) {
            markSpikeFloorTraceWatch_(data[i]);
        }
    };

    function setupSpikeFloorTraceConsole_() {
        var root = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
        if (!root || root.SpikeFloorTrace) return;
        root.SpikeFloorTrace = function(frames) {
            var count = Math.max(1, Math.floor(Number(frames || SPIKE_FOLLOWER_TRACE_DEFAULT_FRAMES) || SPIKE_FOLLOWER_TRACE_DEFAULT_FRAMES));
            if (!$gameTemp) return count;
            $gameTemp._spikeFloorTraceFrames = count;
            logSpikeFloorTrace_('trace-start', ['frames=' + count], true);
            return count;
        };
        root.SpikeFloorTraceStop = function() {
            if ($gameTemp) $gameTemp._spikeFloorTraceFrames = 0;
            logSpikeFloorTrace_('trace-stop', [], true);
        };
    };

    function updateSpikeFloorTraceFrames_() {
        if ($gameTemp && $gameTemp._spikeFloorTraceFrames > 0) $gameTemp._spikeFloorTraceFrames--;
    };

    function isSpikeFloorTraceEnabled_() {
        return !!($gameTemp && $gameTemp._spikeFloorTraceFrames > 0);
    };

    function markSpikeFloorTraceWatch_(character) {
        if (!character || !isSpikeFloorTraceEnabled_()) return;
        character._spikeFloorTraceWatch = Math.max(Number(character._spikeFloorTraceWatch || 0), SPIKE_FOLLOWER_TRACE_WATCH_FRAMES);
    };

    function updateSpikeFloorTraceWatch_(character) {
        if (character && character._spikeFloorTraceWatch > 0) character._spikeFloorTraceWatch--;
    };

    function spikeFloorChaseDiagnostic_(self, target) {
        var targetX = target && target.getPrevX ? target.getPrevX() : target ? target.x : 0;
        var targetY = target && target.getPrevY ? target.getPrevY() : target ? target.y : 0;
        return {
            targetX: targetX,
            targetY: targetY,
            sx: self.deltaXFrom(targetX),
            sy: self.deltaYFrom(targetY)
        };
    };

    function shouldLogSpikeFloorChase_(self, target, diag) {
        if (!isSpikeFloorTraceEnabled_()) return false;
        if (self._spikeFloorTraceWatch || (target && target._spikeFloorTraceWatch)) return true;
        if (Math.abs(diag.sx) > 1 || Math.abs(diag.sy) > 1) return true;
        if (Math.abs(Number(self._prevX == null ? self._x : self._prevX) - Number(self._x)) > 0.5) return true;
        if (Math.abs(Number(self._prevY == null ? self._y : self._prevY) - Number(self._y)) > 0.5) return true;
        if (target && Math.abs(Number(target.getPrevX ? target.getPrevX() : target.x) - Number(target.x)) > 0.5) return true;
        if (target && Math.abs(Number(target.getPrevY ? target.getPrevY() : target.y) - Number(target.y)) > 0.5) return true;
        return false;
    };

    function logSpikeFloorChase_(tag, self, target, diag, extra) {
        logSpikeFloorTrace_(tag, [
            spikeFloorCharacterStateText_('self', self),
            spikeFloorCharacterStateText_('target', target),
            'targetPrev=' + spikeFloorPointText_({ x: diag.targetX, y: diag.targetY }),
            'sx=' + spikeFloorNumberText_(diag.sx),
            'sy=' + spikeFloorNumberText_(diag.sy),
            extra || ''
        ]);
    };

    function spikeFloorChainSnapshot_(data, index) {
        var parts = ['centerIndex=' + index];
        for (var i = Math.max(0, index - 2); i <= Math.min(data.length - 1, index + 2); i++) {
            parts.push(spikeFloorCharacterStateText_('node' + i, data[i]));
        }
        return parts;
    };

    function logSpikeFloorTrace_(tag, parts, force) {
        if (!force && !isSpikeFloorTraceEnabled_()) return;
        if (typeof console === 'undefined' || !console.log) return;
        parts = parts || [];
        var frame = typeof Graphics !== 'undefined' && Graphics ? Graphics.frameCount : 'na';
        var mapId = $gameMap && $gameMap.mapId ? $gameMap.mapId() : 'na';
        console.log('[SpikeFloorTrace] frame=' + frame + ' map=' + mapId + ' tag=' + tag + ' ' + parts.join(' '));
    };

    function spikeFloorCharacterStateText_(prefix, character) {
        if (!character) return prefix + '=null';
        return prefix + '=' + spikeFloorCharacterLabel_(character) +
            ' x=' + spikeFloorPointText_({ x: character._x, y: character._y }) +
            ' real=' + spikeFloorPointText_({ x: character._realX, y: character._realY }) +
            ' prev=' + spikeFloorPointText_({ x: character._prevX, y: character._prevY }) +
            ' jump=' + spikeFloorNumberText_(character._jumpCount || 0) +
            ' moving=' + !!(character.isMoving && character.isMoving()) +
            ' wait=' + !!character._spikeFloorWaitForPlayerHitJump +
            ' waitFollower=' + spikeFloorWaitFollowerLabel_(character) +
            ' noChase=' + !!character._spikeFloorNoChaseWhileJumping +
            ' watch=' + spikeFloorNumberText_(character._spikeFloorTraceWatch || 0);
    };

    function spikeFloorWaitFollowerLabel_(character) {
        var target = character && character._spikeFloorWaitForFollowerHitJumpTarget;
        return target ? spikeFloorCharacterLabel_(target) : 'none';
    };

    function spikeFloorCharacterLabel_(character) {
        if (character === $gamePlayer) return 'player';
        if (isSpikeFloorFollower_(character)) {
            var data = spikeFloorFollowerData_();
            var index = data ? data.indexOf(character) : -1;
            var actor = character.actor && character.actor();
            return 'follower[' + index + ']#member=' + character._memberIndex + (actor ? '#actor=' + actor.actorId() : '#spacer');
        }
        return 'character';
    };

    function spikeFloorPointText_(point) {
        if (!point) return '(null,null)';
        return '(' + spikeFloorNumberText_(point.x) + ',' + spikeFloorNumberText_(point.y) + ')';
    };

    function spikeFloorRectText_(rect) {
        if (!rect) return '(null,null,null,null)';
        return '(' + spikeFloorNumberText_(rect.x) + ',' + spikeFloorNumberText_(rect.y) + ',' +
            spikeFloorNumberText_(rect.w) + ',' + spikeFloorNumberText_(rect.h) + ')';
    };

    function spikeFloorNumberText_(value) {
        var n = Number(value);
        if (!isFinite(n)) return 'na';
        return String(Math.round(n * 1000) / 1000);
    };

    var _Game_Player_update_SpikeFloor = Game_Player.prototype.update;
    Game_Player.prototype.update = function(sceneActive) {
        _Game_Player_update_SpikeFloor.apply(this, arguments);
        this.updateSpikeFloorDamageMotion();
        updateSpikeFloorTraceFrames_();
    };

    var _Game_Player_canMove_SpikeFloor = Game_Player.prototype.canMove;
    Game_Player.prototype.canMove = function() {
        if (this._spikeFloorDamageState && this._spikeFloorDamageState.phase === 'wait') return false;
        return _Game_Player_canMove_SpikeFloor.apply(this, arguments);
    };

    var _Game_Follower_update_SpikeFloor = Game_Follower.prototype.update;
    Game_Follower.prototype.update = function() {
        _Game_Follower_update_SpikeFloor.apply(this, arguments);
        this.updateSpikeFloorDamageMotion();
        updateSpikeFloorFollowerWaitPose_(this);
        updateSpikeFloorFollowerChaseLock_(this);
        updateSpikeFloorTraceWatch_(this);
    };

    var _Game_Follower_chaseCharacter_SpikeFloor = Game_Follower.prototype.chaseCharacter;
    Game_Follower.prototype.chaseCharacter = function(character) {
        sanitizeSpikeFloorFollowerGrid_(this);
        sanitizeSpikeFloorFollowerGrid_(character);
        var trace = isSpikeFloorTraceEnabled_();
        var diag = trace ? spikeFloorChaseDiagnostic_(this, character) : null;
        var shouldLog = trace && shouldLogSpikeFloorChase_(this, character, diag);
        var block = spikeFloorFollowerChaseBlock_(this);
        if (block) {
            if (shouldLog) logSpikeFloorChase_(block.tag, this, character, diag, block.extra);
            return;
        }
        if (shouldLog) logSpikeFloorChase_('chase-before', this, character, diag);
        _Game_Follower_chaseCharacter_SpikeFloor.apply(this, arguments);
        if (shouldLog) logSpikeFloorChase_('chase-after', this, character, spikeFloorChaseDiagnostic_(this, character));
    };

    var _Game_Map_setup_SpikeFloor = Game_Map.prototype.setup;
    Game_Map.prototype.setup = function(mapId) {
        _Game_Map_setup_SpikeFloor.apply(this, arguments);
        if ($gameTemp) {
            $gameTemp._spikeFloorLocks = Object.create(null);
            $gameTemp._spikeFloorKnownRects = Object.create(null);
        }
        clearSpikeFloorSafePositions_();
    };
    setupSpikeFloorTraceConsole_();
})();
