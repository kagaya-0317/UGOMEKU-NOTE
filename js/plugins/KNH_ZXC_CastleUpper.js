/*:
 * @plugindesc Temporary upper-castle encounters and actor guest display.
 * @help Progression and dialogue live in maps 59-63 and troops 46-48.
 * Actor 6 is a display-only guest in troop 47; party membership never changes.
 */
(function() {
    'use strict';
    var api = window.KNH_CastleUpper = {};

    api.systemMessage = function() {
        $gameSystem.clearMessagePopup();
        $gameSystem.setMessagePopupFree($gameMap.getCenterXForUI(), Graphics.boxHeight / 4);
        $gameMessage._fukidashi = false;
        $gameMessage._tailDir = 5;
        $gameVariables.setValue(14, 0);
        if (!SceneManager._scene._sceneInfo) {
            SceneManager._scene._sceneInfo = {};
            SceneManager._scene._castleOwnMessageInfo = true;
        }
        SceneManager._scene._sceneInfo.systemMessage = true;
    };
    api.clearMessage = function() {
        $gameSystem.clearMessagePopupFree();
        $gameSystem.clearMessagePopup();
        $gameMessage._fukidashi = false;
        $gameMessage._tailDir = 0;
        $gameMessage._popupHeight = 99;
        if (SceneManager._scene) delete SceneManager._scene._castleTsunehiSpeaker;
        $gameVariables.setValue(14, 0);
        if (SceneManager._scene._sceneInfo) delete SceneManager._scene._sceneInfo.systemMessage;
        if (SceneManager._scene._castleOwnMessageInfo) {
            SceneManager._scene._sceneInfo = null;
            delete SceneManager._scene._castleOwnMessageInfo;
        }
    };
    api.mapSpeaker = function(eventId) {
        api.clearMessage();
        $gameSystem.setMessagePopup(eventId);
        $gameMessage._fukidashi = true;
        $gameMessage._tailDir = 2;
    };
    api.actorSprite = function(actorId) {
        return (SceneManager._scene._actorSprites || []).filter(function(sp) {
            return sp._battler && sp._battler.actorId() === actorId;
        })[0];
    };
    api.refreshEvents = function() {
        // Progress may unlock an offscreen chest/exit. events() is nearby-only.
        $gameMap._events.forEach(function(event) { if (event) event.refresh(); });
        $gameMap.rejudgeEvents();
    };
    api.battleSpeaker = function(who) {
        api.clearMessage();
        var scene = SceneManager._scene;
        var tsunehi = scene instanceof Scene_NewBattle && $gameTroop._troopId === 48;
        var sp = who === 'beast' ? scene._castleGuestSprite :
            tsunehi && who === 'enemy' ? scene._enemySprites.filter(function(sprite) {
                return sprite._battler.enemyId() === 24;
            })[0] : api.actorSprite(who);
        if (tsunehi) {
            if (!sp) return false;
            scene._castleTsunehiSpeaker = who;
            $gameMessage._fukidashi = true;
            $gameMessage._tailDir = who === 'enemy' ? 9 : 7;
            $gameMessage._popupHeight = 0;
            $gameSystem.setMessagePopupFree(who === 'enemy' ? Graphics.boxWidth - 36 : sp.x, Math.max(130, sp.y - (who === 'enemy' ? 110 : 72)));
            return true;
        }
        if (!sp) return api.systemMessage();
        var beast = who === 'beast';
        // Keep the guest's bubble close beside it and below the other faces.
        var x = beast ? sp.x + 24 : sp.x;
        var y = beast ? sp.y - 30 : Math.max(100, sp.y - 180);
        $gameSystem.setMessagePopupFree(x, y);
        $gameMessage._fukidashi = true;
        $gameMessage._tailDir = beast ? 4 : 2;
    };
    // Reuse the native battle-tail targeting already used by Gnuro and Mone.
    var tsunehiTailTarget = Window_Base.prototype._popupTailCharacterCenterToBmp;
    Window_Base.prototype._popupTailCharacterCenterToBmp = function(bmp) {
        var scene = SceneManager._scene;
        if (scene instanceof Scene_NewBattle && $gameTroop._troopId === 48 &&
                this === scene._messageWindow && $gameMessage._fukidashi) {
            var who = scene._castleTsunehiSpeaker;
            var sp = who === 'enemy' ? scene._enemySprites[0] : api.actorSprite(who);
            if (sp) return this._fukidashiGlobalToBmpPos(bmp, sp.x,
                sp.y - sp._frameSize * Math.abs(sp.scale.y) * 0.42);
        }
        return tsunehiTailTarget.apply(this, arguments);
    };
    // Mone dialogue uses native troop pages and the existing battle pause/resume
    // convention. Keep this encounter separate from Gnuro's cut-bar state.
    function moneScene() {
        var scene = SceneManager._scene;
        return scene instanceof Scene_NewBattle && $gameTroop._troopId === 46 ? scene : null;
    }
    function moneState(scene) {
        return scene._castleMoneDialogue || (scene._castleMoneDialogue = {
            phase: 0, sinceTurn: 0, eventRunning: false, speaker: null
        });
    }
    function moneSpeakerSprite(scene, who) {
        if (who === 'enemy') return scene._enemySprites.filter(function(sp) {
            return sp._battler.enemyId() === 23;
        })[0];
        return who === 3 || who === 4 ? api.actorSprite(who) : null;
    }
    api.moneMapSpeaker = function(who) {
        var state = $gameTemp._castleUpperScene;
        if ($gameMap.mapId() !== 59 || !state || state.eventId !== 3) return false;
        var member = state.members.filter(function(member) { return member.actorId === who; })[0];
        if (who !== 'enemy' && !member) return false;
        api.mapSpeaker(who === 'enemy' ? 3 : member.eventId);
        $gameMessage._popupHeight = 0;
        return true;
    };
    api.moneBattleSpeaker = function(who) {
        var scene = moneScene(), sp = scene && moneSpeakerSprite(scene, who);
        api.clearMessage();
        if (!sp) return false;
        moneState(scene).speaker = who;
        $gameMessage._fukidashi = true;
        $gameMessage._tailDir = who === 'enemy' ? 9 : 7;
        $gameMessage._popupHeight = 0;
        // The temporary Mone artwork is half-size inside its native cells.
        // Place its bubble below the face and clear of the protagonist.
        $gameSystem.setMessagePopupFree(who === 'enemy' ? Graphics.boxWidth - 36 : sp.x,
            Math.max(130, sp.y - (who === 'enemy' ? 78 : 72)));
        return true;
    };
    api.beginMoneEvent = function() {
        var scene = moneScene();
        if (!scene) return;
        moneState(scene).eventRunning = true;
        scene._buttonSprites.forEach(function(button) { button._pressing = false; });
        scene._forceSkip = true;
    };
    api.endMoneEvent = function(phase) {
        var scene = moneScene();
        if (!scene) return;
        var state = moneState(scene);
        state.phase = phase;
        state.sinceTurn = scene._turn;
        state.eventRunning = false;
        state.speaker = null;
        api.clearMessage();
        // Like Gnuro, resume this round instead of scheduling attacks a round late.
        scene.setData();
        scene._enemySprites.forEach(function(sp) {
            sp._turnActions.forEach(function(action) { action.turn = scene._turn; });
        });
        scene._forceSkip = true;
    };
    var moneMeetsConditions = Game_Troop.prototype.meetsConditions;
    Game_Troop.prototype.meetsConditions = function(page) {
        if (!moneMeetsConditions.apply(this, arguments)) return false;
        var scene = moneScene();
        if (!scene) return true;
        var gate = page.list.filter(function(command) { return command.code === 108 || command.code === 408; })
            .map(function(command) { return command.parameters[0]; }).join('\n').match(/<MoneGate:(\d+),(\d+)>/);
        if (!gate) return true;
        var state = moneState(scene), enemy = moneSpeakerSprite(scene, 'enemy');
        return !!enemy && enemy._battler.isAlive() && !scene._inFinish && !scene._inTodome &&
            !state.eventRunning && state.phase === Number(gate[1]) &&
            scene._turn - state.sinceTurn >= Number(gate[2]);
    };
    var moneTailTarget = Window_Base.prototype._popupTailCharacterCenterToBmp;
    Window_Base.prototype._popupTailCharacterCenterToBmp = function(bmp) {
        var scene = moneScene(), state = scene && scene._castleMoneDialogue;
        var sp = state && this === scene._messageWindow && moneSpeakerSprite(scene, state.speaker);
        if (!sp) return moneTailTarget.apply(this, arguments);
        return this._fukidashiGlobalToBmpPos(bmp, sp.x,
            sp.y - sp._frameSize * Math.abs(sp.scale.y) * (state.speaker === 'enemy' ? 0.32 : 0.42));
    };
    var moneTerminate = Scene_NewBattle.prototype.terminate;
    Scene_NewBattle.prototype.terminate = function() {
        if (this._castleMoneDialogue || this._castleTsunehiSpeaker !== undefined) {
            if (this._castleMoneDialogue) this._castleMoneDialogue.speaker = null;
            api.clearMessage();
        }
        return moneTerminate.apply(this, arguments);
    };
    function sceneProxies(eventId) {
        var proxies = $gameMap._events.filter(function(event) {
            return event && event.event().meta && event.event().meta.castleUpperActor;
        });
        var scoped = proxies.filter(function(event) { return Number(event.event().meta.castleUpperScene) === eventId; });
        return scoped.length ? scoped : proxies.filter(function(event) { return !event.event().meta.castleUpperScene; });
    }
    function actorFollower(actorId) {
        return $gamePlayer.followers()._data.filter(function(follower) {
            var actor = follower.actor();
            return actor && actor.actorId() === actorId;
        })[0];
    }
    // Match the castle trap scenes: use map stand-ins at the actual follower
    // positions, then animate them with goTo. Initial routes never relocate them.
    var setupPage = Game_Event.prototype.setupPageSettings;
    Game_Event.prototype.setupPageSettings = function() {
        setupPage.apply(this, arguments);
        var data = this.event();
        if (data && data.meta && data.meta.castleUpperActor) this.setTransparent(true);
    };
    api.beginScene = function(eventId, preserveMoveSpeed, options) {
        options = options || {};
        api.clearMessage();
        var proxies = sceneProxies(eventId);
        proxies.forEach(function(proxy) {
            if (!proxy._castleUpperStandPoint) {
                proxy._castleUpperStandPoint = {x: proxy.x, y: proxy.y};
            }
        });
        var spots = proxies.map(function(proxy) { return proxy._castleUpperStandPoint; });
        var state = $gameTemp._castleUpperScene = {
            mapId: $gameMap.mapId(), eventId: eventId, members: [],
            followers: $gamePlayer.followers().isVisible(),
            directionFix: $gamePlayer.isDirectionFixed(),
            moveSpeed: $gamePlayer._moveSpeed,
            camera: ($gamePlayer._centerXy || [0, 0]).slice(),
            playerReturn: options.returnPlayer ? {x: $gamePlayer._realX, y: $gamePlayer._realY, direction: $gamePlayer.direction()} : null
        };
        $gamePlayer.setDirectionFix(false);
        if (!preserveMoveSpeed) $gamePlayer.setMoveSpeed(3);
        $gamePlayer.followers()._gathering = false;
        proxies.forEach(function(proxy) {
            var actorId = Number(proxy.event().meta.castleUpperActor);
            var follower = actorFollower(actorId);
            if (!follower || (options.returnPlayer && !state.followers)) return;
            var target = proxy._castleUpperStandPoint;
            proxy.setImageZXC(follower.characterName(), follower.characterIndex(), follower.direction());
            proxy.setScale(follower._scaleX, follower._scaleY);
            proxy._additionalX = follower._additionalX || 0;
            proxy._additionalY = follower._additionalY || 0;
            proxy.locateToCharacter(follower);
            proxy._realX = follower._realX;
            proxy._realY = follower._realY;
            proxy.setOpacity(255);
            proxy.setTransparent(false);
            proxy.setDirectionFix(false);
            proxy.setMoveSpeed(preserveMoveSpeed ? proxy.page().moveSpeed : 3);
            proxy.goTo(target.x, target.y);
            state.members.push({actorId: actorId, eventId: proxy.eventId(),
                returnPoint: options.returnPlayer ? {x: follower._realX, y: follower._realY, direction: follower.direction()} : null});
        });
        $gamePlayer.hideFollowers();
        $gamePlayer.refresh(); // Native command 216 also refreshes follower transparency.
        if (spots.length) {
            var x = spots.reduce(function(sum, p) { return sum + p.x; }, 0) / spots.length;
            var y = Math.min.apply(Math, spots.map(function(p) { return p.y; })) - 0.5;
            if (options.playerStandPoint) {
                x = options.playerStandPoint.x;
                y = options.playerStandPoint.y;
            }
            $gamePlayer.goTo(x, y);
        }
    };
    api.isForming = function() {
        var state = $gameTemp._castleUpperScene;
        if (!state || state.mapId !== $gameMap.mapId()) return false;
        var characters = [$gamePlayer].concat(state.members.map(function(member) {
            return $gameMap.event(member.eventId);
        }).filter(Boolean));
        if (characters.some(function(character) { return character.isMoving(); })) return true;
        var boss = $gameMap.event(state.eventId);
        if (boss) characters.forEach(function(character) { character.turnTowardCharacter(boss); });
        return false;
    };
    api.focusScene = function(eventId, extraHeadroom) {
        var ev = $gameMap.event(eventId);
        if (ev) {
            // Leave headroom above the boss for the native speech bubble, while
            // the party remains visible below it. Popup size includes CG scale.
            var height = ev.getHeightForPopup ? ev.getHeightForPopup() : 160;
            var offset = (160 - Math.max(144, height) - (extraHeadroom || 0)) / $gameMap.tileHeight();
            $gameMap.scrollCameraTo(ev.x, ev.y + offset, 90);
        }
    };
    api.returnScene = function() {
        var state = $gameTemp._castleUpperScene;
        api.clearMessage();
        if (!state || state.mapId !== $gameMap.mapId()) return;
        state.returning = true;
        if (state.playerReturn) $gamePlayer.goTo(state.playerReturn.x, state.playerReturn.y);
        // Match maps 51/53: walk stand-ins back to the hidden follower chain.
        state.members.forEach(function(member) {
            var follower = actorFollower(member.actorId);
            var proxy = $gameMap.event(member.eventId);
            if (follower && proxy) {
                if (member.returnPoint) proxy.goTo(member.returnPoint.x, member.returnPoint.y);
                else proxy.goToCharacter(follower);
            }
        });
        $gameMap.scrollCamera(state.camera[0], state.camera[1], 60);
    };
    api.isReturning = function() {
        var state = $gameTemp._castleUpperScene;
        if (!state || state.mapId !== $gameMap.mapId()) return false;
        if (state.playerReturn && $gamePlayer.isMoving()) return true;
        if (state.members.some(function(member) {
            var proxy = $gameMap.event(member.eventId);
            return proxy && proxy.isMoving();
        })) return true;
        state.members.forEach(function(member) {
            var follower = actorFollower(member.actorId);
            var proxy = $gameMap.event(member.eventId);
            if (follower && proxy) proxy.setDirection(member.returnPoint ? member.returnPoint.direction : follower.direction());
        });
        if (state.playerReturn) $gamePlayer.setDirection(state.playerReturn.direction);
        return false;
    };
    var waitMode = Game_Interpreter.prototype.updateWaitMode;
    Game_Interpreter.prototype.updateWaitMode = function() {
        if (this._waitMode === 'castleMoneIdle') {
            var scene = moneScene();
            var busy = scene && scene._actorSprites.concat(scene._enemySprites).some(function(sp) {
                return sp._actions.length || sp._movementDuration > 0;
            });
            if (!busy) this._waitMode = '';
            return !!busy;
        }
        if (this._waitMode === 'castleUpperReturn') {
            if (api.isReturning()) return true;
            this._waitMode = '';
            return false;
        }
        if (this._waitMode === 'castleUpperFormation') {
            if (api.isForming()) return true;
            this._waitMode = '';
            return false;
        }
        return waitMode.apply(this, arguments);
    };
    api.endScene = function() {
        var state = $gameTemp._castleUpperScene;
        api.clearMessage();
        if (state) {
            // The bed events also hand the stand-in position back to a follower.
            // Keep visible actors stationary at the handoff, and reset the
            // invisible spacer chain so the next normal step uses fresh history.
            var visible = {};
            state.members.forEach(function(member) {
                var follower = actorFollower(member.actorId);
                var proxy = $gameMap.event(member.eventId);
                if (follower && proxy) {
                    follower.locateToCharacter(proxy);
                    follower._direction = proxy.direction();
                    visible[follower._memberIndex] = true;
                }
            });
            var preceding = $gamePlayer;
            $gamePlayer.followers().forEach(function(follower) {
                if (!visible[follower._memberIndex]) follower.locateToCharacter(preceding);
                preceding = follower;
            });
            $gamePlayer.resetPrevPos();
            sceneProxies(state.eventId).forEach(function(proxy) { proxy.setTransparent(true); });
            $gamePlayer.setMoveSpeed(state.moveSpeed);
            $gamePlayer.setDirectionFix(state.directionFix);
            state.followers ? $gamePlayer.showFollowers() : $gamePlayer.hideFollowers();
            $gamePlayer.refresh();
            if (!state.returning) $gameMap.scrollCamera(state.camera[0], state.camera[1], 60);
        } else $gameMap.scrollCamera(0, 0, 60);
        delete $gameTemp._castleUpperScene;
        api.refreshEvents();
    };

    function roadIntroState() {
        var state = $gameTemp._castleUpperScene;
        return state && state.mapId === 63 && state.eventId === 3 &&
            state.mapId === $gameMap.mapId() ? state : null;
    }
    api.beginRoadIntro = function() {
        if ($gameMap.mapId() !== 63) return;
        var anchor = $gameMap.event(3);
        if (!anchor) return;
        api.beginScene(3, true, {playerStandPoint: {x: anchor.x, y: anchor.y + 0.5}});
    };
    api.roadIntroFaceRight = function() {
        var state = roadIntroState();
        if (!state) return;
        $gamePlayer.setDirection(6);
        state.members.forEach(function(member) { $gameMap.event(member.eventId).setDirection(6); });
    };
    // Map053's remote Tsunehi portrait, with the native castle party staging.
    api.roadIntroVoice = function(laugh) {
        var state = roadIntroState();
        if (!state) return;
        api.clearMessage();
        api.roadIntroFaceRight();
        // Leave headroom above the laugh for all three animated star poses.
        $gameSystem.setMessagePopupFree($gameMap.getCenterXForUI(), laugh ? 180 : 0);
        $gameMessage._fukidashi = true;
        $gameMessage._tailDir = 5;
        $gameMessage._popupHeight = 0;
        var portrait = laugh ? {
            fileName: '$kanbu2_2', direction: 4, pattern: 0, offsetY: 108,
            viewWidth: 96, textGap: 80,
            animation: {type: 'pattern', wait: 6, sequence: [0, 1, 2]}
        } : {fileName: '$kanbu2_2', offsetX: 44, offsetY: 108, viewWidth: 96, textGap: 48};
        $gameMessage.setPopupPortrait(portrait);
    };
    api.roadIntroReaction = function(actorId) {
        var state = roadIntroState();
        if (!state) return false;
        actorId = Number(actorId) || 3;
        var member = state.members.filter(function(m) { return m.actorId === actorId; })[0];
        if (!member && actorId === 3) {
            member = state.members.filter(function(m) { return m.actorId === 4; })[0];
        }
        if (!member) return false;
        var speaker = $gameMap.event(member.eventId);
        $gameMessage.clearPopupPortrait();
        api.mapSpeaker(speaker.eventId());
        // Yume stands below Mii; keep her own bubble left of the whole party.
        if (actorId === 4) $gameMessage._tailDir = 6;
        $gameMessage._popupHeight = 0;
        api.roadIntroFaceRight();
        return true;
    };
    api.endRoadIntro = function() {
        var state = roadIntroState();
        if (!state) return;
        $gameMessage.clearPopupPortrait();
        api.endScene();
    };

    // Keep the native item selector on the current book page, clear of the spine.
    var gateItemStart = Window_EventItem.prototype.start;
    Window_EventItem.prototype.start = function() {
        var gate = $gameMap.mapId() === 60 && $gameMap._interpreter._eventId === 8;
        if (gate) {
            if (!this._castleGateOriginalWidth) this._castleGateOriginalWidth = this.width;
            this.width = 400;
        } else if (this._castleGateOriginalWidth) {
            this.width = this._castleGateOriginalWidth;
            delete this._castleGateOriginalWidth;
        }
        this._castleGateSelection = gate;
        this._castleGateExcludedItemId = gate ? Number($gameMap._interpreter._castleGateFirstKey) || 0 : 0;
        return gateItemStart.apply(this, arguments);
    };
    var gateItemIncludes = Window_EventItem.prototype.includes;
    Window_EventItem.prototype.includes = function(item) {
        return gateItemIncludes.apply(this, arguments) &&
            !(this._castleGateSelection && item.id === this._castleGateExcludedItemId);
    };
    var gateItemPlacement = Window_EventItem.prototype.updatePlacement;
    Window_EventItem.prototype.updatePlacement = function() {
        gateItemPlacement.apply(this, arguments);
        this.x = this._castleGateSelection ? $gameMap.getCenterXForUI() - this.width / 2 : 0;
    };


    // The throne gate uses its dedicated closed-leaves/open-arch artwork.
    // Reuse encounter staging with scoped stand-ins and a captured return point.
    api.beginGate = function(eventId) {
        api.beginScene(eventId, true, {returnPlayer: true});
    };
    api.focusGate = function(eventId) {
        var gate = $gameMap.event(eventId);
        $gameMap.scrollCameraTo(gate.x, gate.y + 0.5, 60);
    };
    api.gateMiiSpeaker = function() {
        var state = $gameTemp._castleUpperScene;
        if (!state || state.eventId !== 8 || state.mapId !== $gameMap.mapId()) return false;
        var member = state.members.filter(function(member) { return member.actorId === 3; })[0];
        var mii = member && $gameMap.event(member.eventId);
        if (!mii) return false;
        $gamePlayer.turnTowardCharacter(mii);
        state.members.forEach(function(member) {
            if (member.actorId === 4) $gameMap.event(member.eventId).turnTowardCharacter(mii);
        });
        mii.turnTowardCharacter($gamePlayer);
        api.mapSpeaker(mii.eventId());
        $gameMessage._popupHeight = 0;
        return true;
    };
    api.gateYumeSpeaker = function() {
        var state = $gameTemp._castleUpperScene;
        if (!state || state.eventId !== 8 || state.mapId !== $gameMap.mapId()) return false;
        var member = state.members.filter(function(member) { return member.actorId === 4; })[0];
        var yume = member && $gameMap.event(member.eventId);
        if (!yume) return false;
        $gamePlayer.turnTowardCharacter(yume);
        state.members.forEach(function(member) {
            if (member.actorId === 3) {
                var mii = $gameMap.event(member.eventId);
                mii.turnTowardCharacter(yume);
                yume.turnTowardCharacter(mii);
            }
        });
        api.mapSpeaker(yume.eventId());
        $gameMessage._popupHeight = 0;
        return true;
    };
    api.endGate = function() {
        api.endScene();
    };

    var gateCharacterFrame = Sprite_Character.prototype.updateCharacterFrame;
    Sprite_Character.prototype.updateCharacterFrame = function() {
        var ch = this._character;
        if (!(ch instanceof Game_Event) || !ch.event().meta.castleThroneGate) {
            return gateCharacterFrame.apply(this, arguments);
        }
        var source = ImageManager.loadCharacter('castleThroneDoor');
        if (!source.isReady()) return;
        if ($gameVariables.value(66) >= 1) {
            if (this._castleGateRender) {
                this._baseBitmap = source;
                this.bitmap = new Bitmap(source.width, source.height);
                this._yuraDirect = this._castleGateRender.direct;
                this._lastFrame = null;
                delete this._castleGateRender;
                delete ch._castleGateOpening;
            }
            ch.setSizeForMessagePopup(192, 192);
            this.setFrame(192, 0, 192, 192);
            return;
        }
        if (ch._castleGateOpening === undefined) return gateCharacterFrame.apply(this, arguments);
        var state = this._castleGateRender;
        if (!state) {
            state = this._castleGateRender = {bitmap: new Bitmap(192, 192), direct: this._yuraDirect};
            this._baseBitmap = state.bitmap;
            this.bitmap = new Bitmap(192, 192);
            this._yuraDirect = true;
            this._lastFrame = null;
        }
        var t = Math.min(1, ch._castleGateOpening++ / 72);
        var eased = t * t * (3 - 2 * t), width = Math.max(0, 96 * Math.cos(eased * Math.PI / 2));
        var bitmap = state.bitmap;
        bitmap.clear();
        bitmap.blt(source, 192, 0, 192, 192, 0, 0);
        if (width > 0.2) {
            bitmap.blt(source, 0, 0, 96, 192, 0, 0, width, 192);
            bitmap.blt(source, 96, 0, 96, 192, 192 - width, 0, width, 192);
        }
        bitmap._setDirty();
        bitmap.checkDirty();
        this.setFrame(0, 0, 192, 192);
    };


    api.throneActorSpeaker = function(actorId) {
        var state = $gameTemp._castleUpperScene;
        if (!state || state.mapId !== 62 || state.eventId !== 3) return false;
        var member = state.members.filter(function(member) { return member.actorId === actorId; })[0];
        if (!member) return false;
        api.mapSpeaker(member.eventId);
        $gameMessage._popupHeight = 0;
        return true;
    };
    api.throneBossSpeaker = function(shout) {
        api.mapSpeaker(3);
        $gameMessage._popupHeight = 0;
        $gameVariables.setValue(14, shout ? 1 : 0);
    };
    api.thronePose = function(pose) {
        if ($gameMap.mapId() !== 62) return;
        var ch = $gameMap.event(3);
        if (!ch) return;
        if (ch._frameAnimation || ch._lastInfoForFA) ch.endFrameAnimation();
        ch.stopShiverX();
        ch.stopGatagata();
        // All map poses use native 3-by-4 character-sheet cells.
        ch._cssRect = null;
        ch._patternFix = true;
        ch._pattern = 0;
        var sp = ch.sprite();
        if (sp) sp._lastFrame = null;
        var image = '$castleTsunehi';
        ch.setImageZXC(image, 0, 2);
        if (pose === 'inject') {
            ch.startFrameAnimation([3, 4, 5], 6, true);
            ch.startShiverX();
        } else if (pose === 'mad') {
            ch.startFrameAnimation([6, 7, 8], 6, true);
            ch.startGatagata();
        } else if (pose === 'attack') {
            ch._throneLungeOrigin = {x: ch.x, y: ch.y};
            ch.startFrameAnimation([10], 1, false);
            ch.jump(0, 1, 0.25, 3);
        }
    };
    api.throneRecover = function() {
        var ch = $gameMap.event(3);
        api.thronePose('front');
        if (ch && ch._throneLungeOrigin) {
            ch.goTo(ch._throneLungeOrigin.x, ch._throneLungeOrigin.y);
            delete ch._throneLungeOrigin;
        }
        return ch;
    };

    // This guest uses an actual Game_Actor and the actor sprite renderer, but is
    // outside the party/action/target arrays. It cannot remain in a save party.
    function Sprite_CastleGuest() { this.initialize.apply(this, arguments); }
    Sprite_CastleGuest.prototype = Object.create(Sprite_NewActor.prototype);
    Sprite_CastleGuest.prototype.constructor = Sprite_CastleGuest;
    Sprite_CastleGuest.prototype.getAnimationType = function() { return 0; };
    Sprite_CastleGuest.prototype.updateBitmap = function() {
        var name = this._battler.battlerName();
        if (this._battlerName !== name) {
            this._battlerName = name;
            var bitmap = ImageManager.loadSvActor(name);
            this._bitmaps = [bitmap, bitmap, bitmap];
            this.bitmap = bitmap;
            this.setAnimation('', true);
        }
        this.bitmap = this._bitmaps[0];
    };
    function friendlyEncounter() { return $gameTroop && $gameTroop._troopId === 47; }
    var startMessages = BattleManager.displayStartMessages;
    BattleManager.displayStartMessages = function() {
        if (!friendlyEncounter()) return startMessages.apply(this, arguments);
    };
    var create = Scene_NewBattle.prototype.createDisplayObjects;
    Scene_NewBattle.prototype.createDisplayObjects = function() {
        create.apply(this, arguments);
        if (!friendlyEncounter()) return;
        var actor = $gameActors.actor(6);
        var sp = this._castleGuestSprite = new Sprite_CastleGuest(actor);
        sp._forceFrame = [0, 0];
        sp.scale.x = sp.scale.y = 1.2;
        // Use the native ally formation from Scene_NewBattle.createDisplayObjects.
        // Reserve the fourth slot even when one of the companions is absent.
        var allies = this._actorSprites.concat(sp);
        var count = Math.max(4, allies.length);
        allies.forEach(function(ally, index) {
            var slot = ally === sp ? count - 1 : index;
            ally._homeX = Graphics.boxWidth / 6 - slot * 24;
            ally._homeY = Graphics.boxHeight / 2 + (slot - count / 2 + 0.5) * 40;
            if (ally._forward) ally.forward();
        });
        this._battleContainer.addChild(sp);
        this._enemySprites.forEach(function(enemy) {
            enemy.visible = false;
            enemy.updateVisibility = function() { this.visible = false; };
            enemy._dummy = true;
        });
    };
    var active = Scene_NewBattle.prototype.isBattleActive;
    Scene_NewBattle.prototype.isBattleActive = function() {
        return !friendlyEncounter() && active.apply(this, arguments);
    };
    var skip = Scene_NewBattle.prototype.updateSkip;
    Scene_NewBattle.prototype.updateSkip = function() {
        // The combat skip loop advances turns and can overwrite a native abort
        // after the last message. This encounter only presents a conversation.
        if (friendlyEncounter()) return true;
        return skip.apply(this, arguments);
    };
})();
