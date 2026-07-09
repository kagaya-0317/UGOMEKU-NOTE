//=============================================================================
// KNH_ZXC_Menu.js
//=============================================================================

/*:
 * @plugindesc ZXCメニュー画面系
 * @author kagaya
 *
 * @help
 */

(function() {
    'use strict';
    var pluginName = 'KNH_ZXC_Menu';
    
    function wrapRef(owner, key) {
        return {
            get value() {
                return owner[key];
            },
            set value(val) {
                owner[key] = val;
            }
        };
    };

    //-----------------------------------------------------------------------------
    // 共通処理
    //-----------------------------------------------------------------------------

    //行の高さ固定
    const _Bitmap_drawText = Bitmap.prototype.drawText;
    Bitmap.prototype.drawText = function (text, x, y, maxWidth, lineHeight, align) {
        lineHeight = Math.max(lineHeight, 33);
        _Bitmap_drawText.call(this, text, x, y, maxWidth, lineHeight, align);
    };
    var _Window_Base_calcTextHeight = Window_Base.prototype.calcTextHeight;
    Window_Base.prototype.calcTextHeight = function (textState, all) {
        return Math.max(_Window_Base_calcTextHeight.apply(this, arguments), 33);
    };
    var _Window_Message_calcTextHeight = Window_Message.prototype.calcTextHeight;
    Window_Message.prototype.calcTextHeight = function (textState, all) {
        return Math.max(_Window_Message_calcTextHeight.apply(this, arguments), 33);
    };
    
    //アイテム画像を呼び出す
    ImageManager.loadItem = function(filename, hue) {
        return this.loadBitmap('img/items/', filename, hue, true);
    };
    ImageManager.reserveItem = function (filename, hue) {
        return this.reserveBitmap('img/items/', filename, hue, true);
    };
    
    //カーソルデザイン変更
    var _Window_refreshCursor = Window.prototype._refreshCursor;
    Window.prototype._refreshCursor = function() {
        if (this._normalCursor) {
            _Window_refreshCursor.apply(this, arguments);
            this._windowCursorSprite._baseBitmap = null;
            this._windowCursorSprite._lastFrame = null;
            this._windowCursorSprite._yuraInfo = [6, 18];
            return;
        }

        var pad = this._padding;
        var x = this._cursorRect.x + pad - this.origin.x, y = this._cursorRect.y + pad - this.origin.y;
        var w = this._cursorRect.width, h = this._cursorRect.height;
        var m = 4, x2 = Math.max(x, pad), y2 = Math.max(y, pad), ox = x - x2 + m, oy = y - y2 + m;
        var w2 = Math.min(w, this._width - pad - x2) + m * 2, h2 = Math.min(h, this._height - pad - y2) + m * 2;
        var bitmap = new Bitmap(w2, h2);
        this._windowCursorSprite.bitmap = bitmap;
        this._windowCursorSprite._baseBitmap = null;
        this._windowCursorSprite.setFrame(0, 0, w2, h2);
        this._windowCursorSprite.move(x2 - m, y2 - m);

        if (w > 0 && h > 0 && this._windowskin) bitmap.blt(this._windowskin, 156, 36, 12, 24, ox, oy + 4);
        this._windowCursorSprite._yuraInfo = [6, 18];
    };
    Window_Command.prototype.drawItem = function(index) {
        var rect = this.itemRectForText(index);
        var align = this.itemTextAlign();
        this.resetTextColor();
        this.changePaintOpacity(this.isCommandEnabled(index));
        this.drawText(this.commandName(index), rect.x + 8, rect.y, rect.width, align);
    };
    
    //制御処理
    var _Game_Player_canMove = Game_Player.prototype.canMove;
    Game_Player.prototype.canMove = function() {
        if (SceneManager._scene._sceneInfo) return false;
        return _Game_Player_canMove.apply(this, arguments);
    };
    Scene_Map.prototype.isMenuEnabled = function() {
        return $gameSystem.isMenuEnabled() && !$gameMap.isEventRunning() && !this._sceneInfo && !KGG_MiniGame._rt;
    };
    var _Game_Interpreter_updateWaitMode = Game_Interpreter.prototype.updateWaitMode;
    Game_Interpreter.prototype.updateWaitMode = function () {
        if (this._waitMode === 'scene') {
            var waiting = !!SceneManager._scene._sceneInfo;
            if (!waiting) this._waitMode = '';
            return waiting;
        }
        return _Game_Interpreter_updateWaitMode.call(this);
    };

    //シーン終了処理
    Scene_Base.prototype.endScene = function(noCloseAnime) {
        this._sceneInfo.windows.forEach(function(r) {
            if (noCloseAnime) {
                this._windowLayer.removeChild(r.value), r.value = null;
                this._sceneInfo = null;
            } else {
                r.value.close();
                _timeOut(function(r) {this._windowLayer.removeChild(r.value), r.value = null}.bind(this, r), 8);
            }
        }.bind(this))
        if (noCloseAnime) this._sceneInfo = null;
        else _timeOut(() => this._sceneInfo = null, 9);
    };
    
    //メニューへ戻る
    Scene_Base.prototype.endSceneToMenu = function() {
        this.endScene(true);
        if (!$gameMap.isEventRunning()) {
            if ($gameParty.inBattle()) this.startCommand();
            else this.startMenu();
        }
    };

    //メニューのY座標自動調整
    Scene_Base.prototype.autoMenuY = function () {
        var y2 = 32 + $gameMap.parallaxOy(), y = (y2 - y2 % 33.3125 + 22) - $gameMap.parallaxOy();
        // y -= 4;
        return y;
    }

    //メニューを右へ表示すべきか
    Scene_Base.prototype.isMenuRight = function() {
        return $gameMap.parallaxOx() >= 1000 - Graphics.boxWidth / 2 || $gameTroop.inBattle();
    };
    
    //-----------------------------------------------------------------------------
    // メインメニュー
    //-----------------------------------------------------------------------------

    Scene_Map.prototype.isMenuCalled = function () {
        return Input.isTriggered('cancel');
    };

    Scene_Map.prototype.callMenu = function() {
        SoundManager.playOk();
        $gameTemp.clearDestination();
        this._mapNameWindow.hide();
        this.startMenu();
        this.menuCalling = false;
    };
    Scene_Base.prototype.startMenu = function () {
        var info = this._sceneInfo = {};
        var maxW = 208, x = this.isMenuRight() ? Graphics.boxWidth - maxW - 32 : 32;
        var y = this.autoMenuY();
        this._commandWindow = new Window_MenuCommand(0, 0);
        this._commandWindow.x = x, this._commandWindow.y = y;
        this._commandWindow.setHandler('item',    this.sc_commandItem.bind(this));
        this._commandWindow.setHandler('equip',   this.sc_commandPersonal.bind(this));
        this._commandWindow.setHandler('skill',   this.sc_commandPersonal.bind(this));
        this._commandWindow.setHandler('status',  this.sc_commandPersonal.bind(this));
        this._commandWindow.setHandler('options', this.sc_commandOptions.bind(this));
        this._commandWindow.setHandler('save',    this.sc_commandSave.bind(this));
        this._commandWindow.setHandler('gameEnd', this.sc_commandGameEnd.bind(this));
        this._commandWindow.setHandler('cancel',  this.endScene.bind(this));
        this.addWindow(this._commandWindow);
        this._goldWindow = new Window_Gold(x, 0);
        this._goldWindow.y = this._commandWindow.y + this._commandWindow.height;
        this.addWindow(this._goldWindow);
        this._statusWindow = new Window_MenuStatus(0, 0);
        this._statusWindow.x = x < Graphics.boxWidth / 2 ? x : Graphics.boxWidth - this._statusWindow.width - 32;
        this._statusWindow.y = this._commandWindow.y + this._commandWindow.fittingHeight($gameParty.members().length >= 4 ? 8 : 11);
        this._statusWindow.reserveFaceImages();
        this.addWindow(this._statusWindow);
        
        info.windows = [wrapRef(this, '_commandWindow'), wrapRef(this, '_goldWindow'), wrapRef(this, '_statusWindow')];
        info.windows.forEach(function(r) {r.value.openness = 1, r.value.open()});
    };
    
    Scene_Base.prototype.sc_commandItem = function() {
        this.endScene(true);
        this.startItem();
    };
    Scene_Base.prototype.sc_commandPersonal = function() {
        if ($gameParty.members().length > 1) {
            this._statusWindow.selectLast();
            this._statusWindow.activate();
            this._statusWindow.setHandler('ok',     this.sc_onPersonalOk.bind(this));
            this._statusWindow.setHandler('cancel', this.sc_onPersonalCancel.bind(this));
        } else this.sc_onPersonalOk();
    };
    Scene_Base.prototype.sc_commandOptions = function() {
        this.endScene(true);
        this.startOption();
    };
    Scene_Base.prototype.sc_commandSave = function() {
        this.endScene(true);
        this.startSave();
    };
    Scene_Base.prototype.sc_commandGameEnd = function () {
        this.endScene(true);
        $gameSwitches.setValue(33, true); //ゲーム終了フラグ
    };
    Scene_Base.prototype.sc_onPersonalOk = function() {
        var actor = $gameParty.members()[Math.max(this._statusWindow.index(), 0)];
        switch (this._commandWindow.currentSymbol()) {
            case 'equip':
                this.endScene(true);
                this.startEquip(actor);
                break;
            case 'skill':
                this.endScene(true);
                this.startSkill(actor);
                break;
            case 'status':
                this.endScene(true);
                this.startStatus(actor);
                break;
        }
    };
    Scene_Base.prototype.sc_onPersonalCancel = function() {
        this._statusWindow.deselect();
        this._commandWindow.activate();
    };
    
    Window_MenuCommand.prototype.initialize = function(x, y) {
        Window_Command.prototype.initialize.call(this, 32, 32);
        this.selectLast();
    };
    Window_MenuCommand.prototype.windowWidth = function() {
        return 240 - 32;
    };
    Window_Gold.prototype.windowWidth = function() {
        return 240 - 32;
    };

    Window_MenuCommand.prototype.addMainCommands = function () {
        var enabled = this.areMainCommandsEnabled();
        if (this.needsCommand('item')) {
            this.addCommand(TextManager.item, 'item', enabled);
        }
        if (this.needsCommand('equip')) {
            this.addCommand(TextManager.equip, 'equip', enabled);
        }
        if (this.needsCommand('skill')) {
            this.addCommand(TextManager.skill, 'skill', enabled);
        }
        if (this.needsCommand('status')) {
            this.addCommand(TextManager.status, 'status', enabled);
        }
    };
    Window_MenuCommand.prototype.addSaveCommand = function () {
        if (this.needsCommand('save') && $gameTemp.isPlaytest()) {
            var enabled = this.isSaveEnabled();
            this.addCommand(TextManager.save, 'save', enabled);
        }
    };

    Window_MenuStatus.prototype.drawItemStatus = function(index) {
        var actor = $gameParty.members()[index];
        var rect = this.itemRect(index);
        var x = rect.x;
        var y = rect.y;
        var width = rect.width - this.textPadding();
        this.drawActorSimpleStatus(actor, x, y, width);
    };
    Window_MenuStatus.prototype.maxCols = function() {
        return $gameParty.members().length >= 4 ? 2 : 3;
    };
    Window_MenuStatus.prototype.itemWidth = function() {
        return $gameParty.members().length > 1 ? 100 : 210 - 76;
    };
    Window_MenuStatus.prototype.itemHeight = function() {
        return this.lineHeight() * 3;
    };
    Window_MenuStatus.prototype.windowWidth = function() {
        return Math.min(this.maxItems(), this.maxCols()) * (this.itemWidth() + 4) + 72;
    };
    Window_MenuStatus.prototype.windowHeight = function() {
        return this.itemHeight() * ($gameParty.members().length >= 4 ? 2 : 1) + 36;
    };
    Window_MenuStatus.prototype.refresh = function() {
        this.createContents();
        Window_Selectable.prototype.refresh.apply(this, arguments);
    };
    Window_MenuStatus.prototype.drawItem = function (index) {
        this.drawItemStatus(index);
    };
    const _Window_MenuStatus_update = Window_MenuStatus.prototype.update;
    Window_MenuStatus.prototype.update = function () {
        _Window_MenuStatus_update.apply(this, arguments);
        var info = $gameParty.members().map(ac => [ac.mhp, ac.level].toString()).toString();
        if (info !== this._lastInfo) {
            info = this._lastInfo;
            this.refresh();
        }
    };
    Window_Base.prototype.drawActorSimpleStatus = function(actor, x, y, width) {
        x += 16;
        var lineHeight = this.lineHeight();
        this.drawActorName(actor, x, y, width - 8);
        this.drawText(TextManager.levelA, x, y + lineHeight, 50);
        this.drawText(actor.level, x, y + lineHeight, width, 'right');
        this.drawText('HP', x, y + lineHeight * 2, 144);
        this.drawText(actor.hp, x + 40, y + lineHeight * 2, 50, 'right');
        if ($gameParty.members().length <= 1) {
            this.drawText('/', x + 93, y + lineHeight * 2, 20);
            this.drawText(actor.mhp, x + 100, y + lineHeight * 2, 50, 'right');
        }
    };

    //-----------------------------------------------------------------------------
    // アイテム画面
    //-----------------------------------------------------------------------------

    Scene_Base.prototype.startItem = function() {
        var maxW = 360, x = this.isMenuRight() ? Graphics.boxWidth - maxW - 32 : 32;
        var y = this.autoMenuY();
        this._helpWindow = new Window_Help();
        this._helpWindow.x = x, this._helpWindow.y = y;
        this.addWindow(this._helpWindow);
        var wy = this._helpWindow.y + this._helpWindow.height;
        var wh = this._helpWindow.fittingHeight(10);
        this._itemWindow = new Window_ItemList(x, wy, this._helpWindow.width, wh);
        this._itemWindow.setHelpWindow(this._helpWindow);
        this._itemWindow.setHandler('ok',     this.sc_onItemOk.bind(this));
        this._itemWindow.setHandler('cancel', this.endSceneToMenu.bind(this));
        this._itemWindow.setCategory('item');
        this._itemWindow.select(0);
        this._itemWindow.activate();
        this.addWindow(this._itemWindow);
        this._actorWindow = new Window_MenuActor();
        this._actorWindow.setHandler('ok',     this.sc_onActorOk.bind(this));
        this._actorWindow.setHandler('cancel', this.sc_onActorCancel.bind(this));
        this.addWindow(this._actorWindow);

        var info = this._sceneInfo = {};
        info.windows = [wrapRef(this, '_helpWindow'), wrapRef(this, '_itemWindow'), wrapRef(this, '_actorWindow')];
        info.windows.forEach(function(r) {r.value.openness = 1, r.value.open()});
    };

    Scene_Base.prototype.sc_onItemOk = function() {
        var item = this._itemWindow.item();
        $gameParty.setLastItem(item);
        var user = Scene_Item.prototype.user.call(this);
        var action = new Game_Action(user);
        action.setItemObject(item);
        if (action.isForFriend()) {
            this._actorWindow.x = this._helpWindow.x - 16;
            this._actorWindow.y = this._helpWindow.y + this._helpWindow.fittingHeight(this._itemWindow.index() - this._itemWindow.topIndex() < 6 ? 6 : 0) + this._itemWindow.index() * this._itemWindow.lineHeight();
            this._actorWindow.show();
            this._actorWindow.openness = 1, this._actorWindow.open();
            this._actorWindow.activate();
            this._actorWindow.selectForItem(item);
        } else {
            this.sc_useItem();
            this.activateItemWindow();
        }
    };
    Scene_Base.prototype.sc_onActorOk = function() {
        var user = Scene_Item.prototype.user.call(this);
        var target = this.sc_itemTargetActors()[0];
        if (user.canUse(this._itemWindow.item()) &&
            (target.isAlive()) //死者に使用不可
            ) {
            this.sc_useItem();
        } else {
            SoundManager.playBuzzer();
        }
    };
    Scene_Base.prototype.sc_onActorCancel = function() {
        this._actorWindow.close();
        this._actorWindow.deactivate();
        this._itemWindow.refresh();
        this._itemWindow.activate();
    };
    Scene_Base.prototype.sc_isItemEffectsValid = function() {
        var item = this._itemWindow.item(), user = Scene_Item.prototype.user.call(this);
        var action = new Game_Action(user);
        action.setItemObject(item);
        return this.sc_itemTargetActors().some(function(target) {
            return action.testApply(target);
        }, this);
    };
    Scene_Base.prototype.sc_itemTargetActors = function() {
        var item = this._itemWindow.item(), user = Scene_Item.prototype.user.call(this);
        var action = new Game_Action(user);
        action.setItemObject(item);
        if (!action.isForFriend()) return [];
        else if (action.isForAll()) return $gameParty.members();
        else return [$gameParty.members()[this._actorWindow.index()]];
    };
    Scene_Base.prototype.sc_useItem = function() {
        var item = this._itemWindow.item(), user = Scene_Item.prototype.user.call(this);
        SoundManager.playUseItem();
        user.useItem(item);
        
        var action = new Game_Action(user);
        action.setItemObject(item);
        this.sc_itemTargetActors().forEach(function(target) {
            for (var i = 0; i < action.numRepeats(); i++) action.apply(target);
        }, this);
        action.applyGlobal();
        
        if ($gameTemp.isCommonEventReserved()) SceneManager.goto(Scene_Map);
        if ($gameParty.isAllDead()) SceneManager.goto(Scene_Gameover);

        if (item.meta.hair && !$gameParty.inBattle()) { //毛のグラ
            var sprite = $gamePlayer.sprite();
            var bmp = ImageManager.loadCharacter('$001_hair');
            if (!sprite._hairCount) sprite._hairCount = 1;
            else if (++sprite._hairCount === 10) {
                sprite.bitmap = bmp;
                sprite._lastFrame = sprite._baseBitmap = sprite._hairCount = null;
                sprite.update();
                sprite.update();
            }
        }

        this._actorWindow.refresh();
        this._itemWindow.refreshYurayura();
        this._itemWindow.createContents();
        this._itemWindow.drawAllItems();
    };
    
    Window_Help.prototype.initialize = function(numLines) {
        var width = 360;
        var height = this.fittingHeight(numLines || 4);
        Window_Base.prototype.initialize.call(this, 32, 32, width, height);
        this._text = '';
    };
    Window_Help.prototype.setItem = function(item) {
        this._item = item;
        this.setText(item ? item.description : '');
    };
    Window_Help.prototype.setText = function (text) {
        if (this._text !== text || this._item !== this._lastItem) {
            this._text = text;
            this._lastItem = this._item;
            this.refresh();
        }
    };
    Window_Help.prototype.refresh = function () {
        this.refreshYurayura();
        this.contents.clear();
        if (this._item) {
            if (DataManager.isSkill(this._item)) {
                if ($gameParty.inBattle()) {
                    this.drawTextNL(this._text, 8, 0, this.contents.width - 8);
                } else {
                    this.drawSkillSimulation(this._item, $gameTemp._skillHelpActor, 0, 0, 144, 144 - 12);
                    this.drawTextNL(this._text, 144 + 8, 0, this.contents.width - 144 - 16);
                }
            } else {
                var pd = window.KNH_PlayerDrawing;
                var imageInfo = pd && pd.itemImageInfo ? pd.itemImageInfo(this._item) : null;
                if (!imageInfo && this._item.meta.image) {
                    var legacyImageInfo = this._item.meta.image.split(',');
                    imageInfo = { name: legacyImageInfo[0] || '', index: Number(legacyImageInfo[1] || 0) };
                }
                var bmp = pd && pd.loadItemImageBitmap ? pd.loadItemImageBitmap(imageInfo) : ImageManager.loadItem(imageInfo ? imageInfo.name || '' : '');
                bmp.addLoadListener(function () {
                    this.refreshYurayura();
                    var index = Number(imageInfo && imageInfo.index || 0);
                    var frame = pd && pd.itemImageFrame ? pd.itemImageFrame(bmp, imageInfo) : {
                        x: (index % 4) * (bmp.width / 4),
                        y: Math.floor(index / 4) * (bmp.height / 2),
                        width: bmp.width / 4,
                        height: bmp.height / 2
                    };
                    this.contents.blt(bmp, frame.x, frame.y, frame.width, frame.height, 0, -6, 144, 144);
                    this.contents.clearRect(0, 132, 144, 6);
                }.bind(this))
                this.drawTextNL(this._text, 144 + 8, 0, this.contents.width - 144 - 16);
            }
        } else if (this._text) {
            this.drawTextNL(this._text, 8, 0, this.contents.width - 16);
        }
    };
    
    Window_ItemList.prototype.maxCols = function() {
        return 1;
    };
    Window_ItemList.prototype.drawItem = function(index) {
        var item = this._data[index];
        if (item) {
            var rect = this.itemRect(index);
            this.drawText(item.name, rect.x + 16, rect.y, rect.width - 16);
            this.drawItemNumber(item, rect.x, rect.y, rect.width - 16);
        }
    };
    Window_ItemList.prototype.drawItemNumber = function(item, x, y, width) {
        if (this.needsNumber()) {
            this.drawText('×', x, y, width - this.textWidth('00'), 'right');
            this.drawText($gameParty.numItems(item), x, y, width, 'right');
        }
    };
    var _Window_ItemList_refresh = Window_ItemList.prototype.refresh;
    Window_ItemList.prototype.refresh = function() {
        this.refreshYurayura();
        _Window_ItemList_refresh.apply(this, arguments);
    };

    //-----------------------------------------------------------------------------
    // そうび画面
    //-----------------------------------------------------------------------------
    
    Scene_Base.prototype.startEquip = function(actor) {
        var maxW = 360, x = this.isMenuRight() ? Graphics.boxWidth - maxW - 32 : 32;
        var y = this.autoMenuY();
        this._helpWindow = new Window_Help();
        this._helpWindow.x = x, this._helpWindow.y = y;
        this.addWindow(this._helpWindow);
        var wy =this._helpWindow.y + this._helpWindow.height;
        var wh = this._helpWindow.fittingHeight(3);
        this._slotWindow = new Window_EquipSlot(x, wy, maxW, wh);
        this._slotWindow.setHelpWindow(this._helpWindow);
        this._slotWindow.setStatusWindow(this._statusWindow);
        this._slotWindow.setHandler('ok',       this.sc_onSlotOk.bind(this));
        this._slotWindow.setHandler('cancel',   this.endSceneToMenu.bind(this));
        this._slotWindow.activate(), this._slotWindow.select(0);
        this.addWindow(this._slotWindow);
        this._statusWindow = new Window_EquipStatus(0, 0);
        this._statusWindow.x = x < Graphics.boxWidth / 2 ? x : Graphics.boxWidth - this._statusWindow.width - 32;
        this._statusWindow.y = this._slotWindow.y + this._slotWindow.fittingHeight(5);
        this.addWindow(this._statusWindow);
        
        var wy = this._helpWindow.y + this._helpWindow.height;
        var wh = this._helpWindow.fittingHeight(10);
        this._itemWindow = new Window_EquipItem(x, wy, maxW, wh);
        this._itemWindow.setEquip();
        this._itemWindow.setStatusWindow(this._statusWindow);
        this._itemWindow.setHandler('ok',     this.sc_onItemOk_eq.bind(this));
        this._itemWindow.setHandler('cancel', this.sc_onItemCancel_eq.bind(this));
        this._slotWindow.setItemWindow(this._itemWindow);
        this._itemWindow.hide();
        this.addWindow(this._itemWindow);

        this._statusWindow.setActor(actor);
        this._slotWindow.setActor(actor);
        this._itemWindow.setActor(actor);
        this._slotWindow.updateHelp();

        var info = this._sceneInfo = {};
        info.actor = actor;
        info.windows = [wrapRef(this, '_helpWindow'), wrapRef(this, '_statusWindow'), wrapRef(this, '_slotWindow'), wrapRef(this, '_itemWindow')];
        info.windows.forEach(function(r) {r.value.openness = 1, r.value.open()});
    };
    
    Scene_Base.prototype.sc_onSlotOk = function() {
        this._slotWindow.hide();
        this._statusWindow.hide();
        this._itemWindow.show();
        this._itemWindow.openness = 1, this._itemWindow.open();
        this._itemWindow.activate();
        this._itemWindow.refresh();
        this._itemWindow.select(0);
        this._itemWindow.setHelpWindow(this._helpWindow);
    };

    Scene_Base.prototype.sc_onItemOk_eq = function() {
        SoundManager.playEquip();
        this._sceneInfo.actor.changeEquip(this._slotWindow.index(), this._itemWindow.item());
        this.sc_onItemCancel_eq();
        this._slotWindow.refresh();
        this._statusWindow.refresh();
    };

    Scene_Base.prototype.sc_onItemCancel_eq = function () {
        this._itemWindow.deactivate();
        this._itemWindow.hide();
        this._slotWindow.show();
        this._slotWindow.openness = 1, this._slotWindow.open();
        this._slotWindow.activate();
        this._statusWindow.show();
        this._statusWindow.openness = 1, this._statusWindow.open();
        this._statusWindow.activate();
    };

    Window_ItemList.prototype.setEquip = function () {
        this._onEquip = true;
    };
    const _Window_ItemList_drawItem = Window_ItemList.prototype.drawItem;
    Window_ItemList.prototype.drawItem = function (index) {
        _Window_ItemList_drawItem.apply(this, arguments);
        if (!this._data[index] && this._onEquip && SceneManager._scene._sceneInfo) {
            var rect = this.itemRect(index);
            this.drawText(_tl('(外す)'), rect.x + 16, rect.y, rect.width);
        }
    };
    const _Window_ItemList_makeItemList = Window_ItemList.prototype.makeItemList;
    Window_ItemList.prototype.makeItemList = function () {
        _Window_ItemList_makeItemList.apply(this, arguments);
        if (this._onEquip && SceneManager._scene._sceneInfo && 
            !SceneManager._scene._sceneInfo.actor.equips()[SceneManager._scene._slotWindow.index()]) {
            this._data.pop(null);
        }
    };
    
    Window_EquipSlot.prototype.drawItem = function(index) {
        if (this._actor) {
            var rect = this.itemRectForText(index);
            this.changeTextColor(this.normalColor());
            var w = _lg === 1 ? 92 : 74;
            this.drawText(this.slotName(index), rect.x + 8, rect.y, w, this.lineHeight());
            this.drawText(':', rect.x + w + 16, rect.y, 40);
            if (this._actor.equips()[index])
                this.drawText(this._actor.equips()[index].name, rect.x + w + 26, rect.y, rect.width - w - 30, 'left');
        }
    };
    Window_EquipSlot.prototype.slotName = function(index) {
        return _tl([
            ['頭', '腕', '身体'],
            ['左尻', '右尻', '太もも'],
            ['しっぽ', '左耳穴', '右耳穴'],
            ['左尻', '右尻', '太もも'],
            ['左尻', '右尻', '太もも'],
        ][this._actor._actorId - 1][index]);
    };
    var _Window_EquipSlot_refresh = Window_EquipSlot.prototype.refresh;
    Window_EquipSlot.prototype.refresh = function() {
        this.refreshYurayura();
        _Window_EquipSlot_refresh.apply(this, arguments);
    };
    Window_EquipSlot.prototype.updateHelp = function () {
        this.setHelpWindowItem(this.item());
    };
    
    Window_EquipStatus.prototype.windowWidth = function() {
        return 210;
    };
    Window_EquipStatus.prototype.numVisibleRows = function() {
        return 4;
    };
    Window_EquipStatus.prototype.drawItem = function(x, y, paramId) {
        this.drawParamName(x + this.textPadding(), y, paramId);
        if (this._actor) {
            this.drawCurrentParam(this.contents.width - 52, y, paramId);
        }
    };
    Window_EquipStatus.prototype.refresh = function() {
        this.refreshYurayura();
        this.contents.clear();
        if (this._actor) {
            this.drawActorName(this._actor, this.textPadding(), 0);
            for (var i = 0; i < 3; i++)
                this.drawItem(0, this.lineHeight() * (1 + i), [0, 2, 3][i]);
        }
    };

    //-----------------------------------------------------------------------------
    // スキル画面
    //-----------------------------------------------------------------------------

    Scene_Base.prototype.startSkill = function (actor) {
        var maxW = 360, x = this.isMenuRight() ? Graphics.boxWidth - maxW - 32 : 32;
        var y = this.autoMenuY();
        this._helpWindow = new Window_Help();
        this._helpWindow.x = x, this._helpWindow.y = y;
        this.addWindow(this._helpWindow);
        var wy = this._helpWindow.y + this._helpWindow.height;
        var wh = this._helpWindow.fittingHeight(10);
        this._itemWindow = new Window_SkillList(x, wy, maxW, wh);
        this._itemWindow.setHelpWindow(this._helpWindow);
        // this._itemWindow.setHandler('ok', this.sc_onItemOk_eq.bind(this));
        this._itemWindow.setHandler('cancel', this.endSceneToMenu.bind(this));
        this.addWindow(this._itemWindow);
        this._itemWindow.select(0), this._itemWindow.activate();
        this._itemWindow.setActor(actor);
        $gameTemp._skillHelpActor = actor;
        _timeOut(() => { if (this._helpWindow) this._helpWindow.setItem(this._itemWindow.item()) }, 8);

        var info = this._sceneInfo = {};
        info.actor = actor;
        info.windows = [wrapRef(this, '_helpWindow'), wrapRef(this, '_itemWindow')];
        info.windows.forEach(function (r) { r.value.openness = 1, r.value.open() });
    };

    Window_SkillList.prototype.maxCols = function () { return 1; };
    Window_SkillList.prototype.drawItem = function (index) {
        var skill = this._data[index];
        if (skill) {
            var costWidth = this.costWidth();
            var rect = this.itemRect(index);
            rect.width -= this.textPadding();
            this.changePaintOpacity(this.isEnabled(skill));
            var text = this.getSkillIconText(skill);
            this.drawTextKNH(text, rect.x + 16, rect.y, rect.width - costWidth);
            text = this.getSkillNameText(skill);
            this.drawText(text, rect.x + 48, rect.y, 125);
            var x = rect.x + 185;
            this.setFontSize(20);
            this.drawText('Lv.', x, rect.y + 4, 25);
            this.setFontSize(28);
            this.drawText(this._actor.skillLevel(skill.id), x, rect.y, 55, 'right');
            x = rect.x + this.contents.width - 70;
            this.setFontSize(20);
            this.drawText(_tl('威力'), x, rect.y + 4, 33);
            this.setFontSize(28);
            var power = Number((skill.damage.formula.match(/\((\d+)\)/) || [, 0])[1]) +
                this._actor.skillLevel(skill.id) - 1;
            this.drawText(power, x, rect.y, 65, 'right');
            this.drawSkillCost(skill, rect.x, rect.y, rect.width);
            this.changePaintOpacity(1);
        }
    };
    Window_Base.prototype.getSkillIconText = function (skill) {
        return '%2\\i[%1]%3'.format(
            skill.iconIndex + ($gameVariables.value(32) ? 0 : 6),
            Number(skill.meta.size) > 1 ? '' : '\\x[3]\\y[3]\\s[22]',
            Number(skill.meta.size) > 1 ? '' : '\\x[3]\\my[3]\\s[28]'
        );
    };
    Window_Base.prototype.getSkillNameText = function(skill){
        return _tl(skill.name.replace(
            /^a\d+_[A-Za-z!-/:-@[-`{-~]{1,2}/,
            ''
        ));
    };

    // ループ待機フレーム
    const SKILL_SIM_REPLAY_WAIT = 30;
    const SKILL_SIM_BUTTON_FRAME = 44;
    const SKILL_SIM_BUTTON_SCALE = 0.75;
    const SKILL_SIM_BUTTON_FIXED_LEN = 120;
    const SKILL_SIM_BUTTON_MARGIN = 6;

    function skillButtonRow(button) {
        var index = ['A', 'B', 'X', 'Y'].indexOf(button);
        if (index < 0) return -1;
        if (!$gameVariables.value(32)) index += 4;
        return index;
    }

    function setupSkillButtonDisplay(container, skill, w, h, scale) {
        if (!skill || !skill.meta || !skill.meta.button) return;
        var button = String(skill.meta.button || '').toUpperCase();
        var row = skillButtonRow(button);
        if (row < 0) return;
        var info = {
            button: button,
            size: Number(skill.meta.size) || 1,
            long: !!skill.meta.long,
            rush: !!skill.meta.rush
        };
        var areaW = w / scale;
        var areaH = h / scale;
        var bs = new Sprite_Base();
        bs.bitmap = ImageManager.loadSystem('UI_battle_bar_buttons');
        bs.anchor.x = bs.anchor.y = 0.5;
        bs._skillButtonInfo = info;
        var baseScale = SKILL_SIM_BUTTON_SCALE;
        var buttonScale = baseScale / scale;
        bs.scale.x = bs.scale.y = buttonScale;
        bs.setFrame(0, row * SKILL_SIM_BUTTON_FRAME, SKILL_SIM_BUTTON_FRAME, SKILL_SIM_BUTTON_FRAME);
        var half = SKILL_SIM_BUTTON_FRAME / 2 * buttonScale;
        var y = Math.max(half, areaH - half + 4);
        if (info.long || info.rush) {
            var tailW = Math.max(
                SKILL_SIM_BUTTON_FRAME,
                Math.min(SKILL_SIM_BUTTON_FIXED_LEN, Math.floor(areaW - SKILL_SIM_BUTTON_MARGIN * 2))
            );
            bs._skillButtonTailWidth = tailW;
            bs.x = areaW / 2;
            bs.y = y;
            var ts = new Sprite();
            ts.bitmap = new Bitmap(tailW, SKILL_SIM_BUTTON_FRAME);
            ts.anchor = new Point(0, 0.5);
            ts.x = -tailW / 2;
            bs._tailSprite = ts;
            bs.addChild(ts);
        } else {
            bs.x = areaW / 2;
            bs.y = y;
        }
        container._skillButtonSprite = bs;
        container.addChild(bs);
        updateSkillButtonDisplay(container);
    }

    function updateSkillButtonDisplay(container) {
        var bs = container._skillButtonSprite;
        if (!bs || !bs._skillButtonInfo) return;
        var row = skillButtonRow(bs._skillButtonInfo.button);
        if (row < 0) return;
        var animeIndex = Math.floor($gameSystem.sceneCount() / $gameSystem.animationWait()) % 4;
        var frameInfo = [animeIndex, row].toString();
        if (bs._lastSkillFrame !== frameInfo) {
            bs._lastSkillFrame = frameInfo;
            bs.setFrame(animeIndex * SKILL_SIM_BUTTON_FRAME, row * SKILL_SIM_BUTTON_FRAME,
                SKILL_SIM_BUTTON_FRAME, SKILL_SIM_BUTTON_FRAME);
        }
        if (bs._tailSprite) {
            var animeIndex2 = bs._skillButtonInfo.rush ?
                Math.floor($gameSystem.sceneCount() / $gameSystem.animationWait() * 2) % 2 : 0;
            var tailInfo = [animeIndex, animeIndex2].toString();
            if (bs._lastInfoTailFrame !== tailInfo) {
                bs._lastInfoTailFrame = tailInfo;
                var ts = bs._tailSprite;
                ts.bitmap.clear();
                ts.bitmap._context.imageSmoothingEnabled = false;
                for (var x = 22; x < ts.width - 44; x += 44) {
                    var segW = Math.min(44, ts.width - 44 - x);
                    ts.bitmap.blt(bs.bitmap, (animeIndex % 2) * 88, 8 * 44, segW, 44, x, 0, segW, 44);
                }
                ts.bitmap.blt(bs.bitmap, (animeIndex % 2) * 88 + 44, 8 * 44, 44, 44, ts.width - 44, 0, 44, 44);
                if (bs._frame) {
                    ts.bitmap.blt(bs.bitmap, bs._frame.x, bs._frame.y, bs._frame.width, bs._frame.height, 0, 0);
                    if (animeIndex2 % 2) {
                        ts.bitmap.blt(bs.bitmap, bs._frame.x, bs._frame.y + 4,
                            bs._frame.width, bs._frame.height - 4, 0, 0);
                    }
                }
            }
        }
    }
    //スキル再生
    Window_Base.prototype.drawSkillSimulation = function (skill, actor, x, y, w, h) {
        if (this._skillSimContainer) this.removeChild(this._skillSimContainer);
        const container = new Sprite();
        var scale = Number(skill.meta.simScale) || (skill.meta.button === 'X' ? 0.5 : 0.7);
        const mask = new PIXI.Graphics().beginFill(0).drawRect(0, 0, w / scale, h / scale).endFill();
        container.mask = mask;
        container.addChild(mask);
        container.x = x + this.padding;
        container.y = y + this.padding;
        container.scale.x = container.scale.y = scale;
        this._skillSimContainer = container;
        this.addChildToBack(container);
    
        const dummyEnemy = new Game_Enemy(1, 0, 0);
        $gameTroop._enemies = [dummyEnemy];
        const enemySprite = new Sprite_NewEnemy(dummyEnemy);
        const actorSprite = new Sprite_NewActor(actor);
        actorSprite._battler = actor;
        actorSprite.x = actorSprite._homeX = w * 0.33;
        actorSprite.y = actorSprite._homeY = h + 80 * 0.75 / scale;
        enemySprite._dummy = true;
        enemySprite.x = enemySprite._homeX = w * 0.75 / scale + Number(skill.meta.simEX || 0);
        enemySprite.y = enemySprite._homeY = actorSprite.y + Number(skill.meta.simEY || 0);
        actorSprite.targetSprite = () => enemySprite;
        container.addChild(enemySprite);
        container.addChild(actorSprite);
        setupSkillButtonDisplay(container, skill, w, h, scale);

        SceneManager._scene._skillSimContainer = container;
        SceneManager._scene._simBullets = [];
        // ==== リピート用の状態管理 ====
        container._simState = {
            skillId: skill.id,
            actorSprite: actorSprite,
            enemySprite: enemySprite,
            phase: 'playing',        // 'playing' | 'waiting'
            wait: 0
        };
        container._simState.action = actorSprite.startAction(skill.id, null, 2);
    };
    const _WB_update = Window_Base.prototype.update;
    Window_Base.prototype.update = function () {
        _WB_update.call(this);
        this.updateSkillSimulation();
    };
    Window_Base.prototype.updateSkillSimulation = function () {
        const container = this._skillSimContainer;
        if (!container) return;
        if (SceneManager._scene._simBullets) {
            const bullets = SceneManager._scene._simBullets;
            SceneManager._scene._simBullets = bullets.filter(b => {
                if (b._finish === 2) {
                    if (container.children.includes(b)) container.removeChild(b);
                    return false;
                }
                return true;
            });
        }
        updateSkillButtonDisplay(container);
        const st = container._simState;
        if (!st) return;
        const a = st.actorSprite;
        const isActionFinished = st.action.applied;
        if (st.phase === 'playing') {
            if (isActionFinished) {
                st.phase = 'waiting';
                st.wait = SKILL_SIM_REPLAY_WAIT;
                if ($dataSkills[st.skillId].meta.rush) st.wait = _rand(6, 9);
            }
        } else if (st.phase === 'waiting') {
            if (st.wait > 0) {
                st.wait--;
            } else {
                a.x = a._homeX; a.y = a._homeY;
                if (st.enemySprite) {
                    st.enemySprite.x = st.enemySprite._homeX;
                    st.enemySprite.y = st.enemySprite._homeY;
                }
                if (SceneManager._scene._simBullets.length) {
                    for (const b of SceneManager._scene._simBullets) {
                        if (container.children.includes(b)) container.removeChild(b);
                    }
                    SceneManager._scene._simBullets.length = 0;
                }
                st.action = a.startAction(st.skillId, null, 2);
                st.phase = 'playing';
            }
        }
    };
    const scene = Scene_Base.prototype;
    scene.playDamageAnimation = function (sourceSprite, targetSprite, skillId, judgment) {
        const skill = $dataSkills[skillId];
        if (skill && skill.animationId > 0) {
            const anim = $dataAnimations[skill.animationId];
            if (anim) {
                var sp = targetSprite.startAnimation(anim, false, 0);
                sp.x = targetSprite.x;
                sp.y = targetSprite.y - 120
                sp._noUpdatePosition = true;
            }
        }
    };
    scene.applyDamage = function (subject, target, skillId) {
    };
    scene.newBullet = function (img, sx, sy, tx, ty, moveType, p1, p2, p3) {
        const bullet = new Sprite_Bullet(img, sx, sy, tx, ty, moveType, p1, p2, p3);
        if (this._skillSimContainer) this._skillSimContainer.addChild(bullet);
        this._simBullets = this._simBullets || [];
        this._simBullets.push(bullet);
        return bullet;
    };
    scene.getBulletWait = function (img, sx, sy, tx, ty, moveType, p1, p2, p3) {
        return Scene_NewBattle.prototype.getBulletWait.apply(this, arguments);
    };

    
    //-----------------------------------------------------------------------------
    // ステータス画面
    //-----------------------------------------------------------------------------
    
    Scene_Base.prototype.startStatus = function(actor) {
        var maxW = 360, x = this.isMenuRight() ? Graphics.boxWidth - maxW - 32 : 32;
        var y = this.autoMenuY();
        this._statusWindow = new Window_Status();
        this._statusWindow.x = x, this._statusWindow.y = y;
        this._statusWindow.setHandler('cancel',   this.endSceneToMenu.bind(this));
        this._statusWindow.setActor(actor);
        this.addWindow(this._statusWindow);

        var info = this._sceneInfo = {};
        info.actor = actor;
        info.windows = [wrapRef(this, '_statusWindow')];
        info.windows.forEach(function(r) {r.value.openness = 1, r.value.open()});
    };
    
    Window_Status.prototype.initialize = function() {
        var width = 360, height = Graphics.boxHeight - 64;
        Window_Selectable.prototype.initialize.call(this, 32, 32, width, height);
        this._actor = null, this.refresh(), this.activate();
    };
    Window_Status.prototype.refresh = function() {
        this.contents.clear();
        if (this._actor) {
            var x = 0, y = 0, a = 20;
            this.drawText(this._actor._name, x, y, this.contents.width, 'left');
            x = 8, y += this.lineHeight() * 2;
            this.drawText('Lv', x, y, this.contents.width / 2 - a, 'left');
            this.drawText(this._actor.level, x, y, this.contents.width / 2 - a, 'right');
            y += this.lineHeight();
            this.drawText('Exp', x, y, this.contents.width / 2 - a, 'left');
            this.drawText(this._actor.currentExp(), x, y, this.contents.width / 2 - a, 'right');
            y += this.lineHeight();
            this.drawText('Next', x, y, this.contents.width / 2 - a, 'left');
            this.drawText(this._actor.nextRequiredExp(), x, y, this.contents.width / 2 - a, 'right');

            x = this.contents.width / 2 + a - x, y = this.lineHeight() * 2;
            for (var i = 0; i < 3; i++) {
                var paramId = [0, 2, 3][i];
                this.setFontSize(24);
                this.drawText(TextManager.param(paramId), x, y, this.contents.width / 2 - a, 'left');
                this.setFontSize(28);
                this.drawText(this._actor.param(paramId), x, y, this.contents.width / 2 - a, 'right');
                y += this.lineHeight();
            }
            y += this.lineHeight() * 3;
            
            // グラフ描写
            const ctx = this.contents._context;
            ctx.save();
            const baseRadius = 99;
            const cx = this.contents.width / 2, cy = y + baseRadius;
            const labels = [
                [['優しさ', 62], ['知識', 65], ['魅力', 59], ['度胸', 63], ['注意力', 3]],
                [['優しさ', 100], ['楽しさ', 80], ['切なさ', 60], ['エンゲル係数', 32], ['もっちり感', 90]],
                [['へなちょこ度', 95], ['寂しがり', 70], ['毛なみ', 85], ['夜間排尿回数', 3], ['歌唱力', 2]],
                [['優しさ', 62], ['知識', 65], ['魅力', 59], ['度胸', 63], ['注意力', 3]]
            ][this._actor._actorId - 1];
            const angleStep = 2 * Math.PI / labels.length;

            // === ① 背景の正五角形（太さ2px） ===
            ctx.lineWidth = 2, ctx.strokeStyle = '#474e51';
            ctx.beginPath();
            for (let i = 0; i < labels.length; i++) {
                const angle = -Math.PI / 2 + i * angleStep;
                const x = cx + Math.cos(angle) * baseRadius;
                const y = cy + Math.sin(angle) * baseRadius;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();

            // === ② 数値に応じた五角形（太さ4px） ===
            // ★ パターンを作成
            const patternCanvas = document.createElement('canvas');
            patternCanvas.width = 8;
            patternCanvas.height = 8;
            const pctx = patternCanvas.getContext('2d');
            pctx.strokeStyle = '#474e51', pctx.lineWidth = 1;
            pctx.beginPath();
            pctx.moveTo(8, 0), pctx.lineTo(0, 8);
            pctx.stroke();
            // ★ 斜線パターンを fillStyle にセット
            const pattern = ctx.createPattern(patternCanvas, 'repeat');
            ctx.fillStyle = pattern;

            // === 数値に応じた五角形を塗りつぶし ===
            ctx.beginPath();
            for (let i = 0; i < labels.length; i++) {
                const rate = labels[i][1] / 100, angle = -Math.PI / 2 + i * angleStep;
                const x = cx + Math.cos(angle) * baseRadius * rate, y = cy + Math.sin(angle) * baseRadius * rate;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();  // ← 塗りつぶし！
            ctx.lineWidth = 4, ctx.strokeStyle = '#474e51';
            ctx.stroke(); // 輪郭も描く

            // === ③ ラベル描写 ===
            for (let i = 0; i < labels.length; i++) {
                const angle = -Math.PI / 2 + i * angleStep;
                const labelX = cx + Math.cos(angle) * (baseRadius + 20);
                const labelY = cy + Math.sin(angle) * (baseRadius + 20) - 20;
                const name = _tl(labels[i][0]);
                const w = _lg === 1 ? 120 : 100;
                const x = (labelX - w / 2).clamp(0, this.contents.width - w);
                const hasBreak = name.includes('\n');
                const y = hasBreak ? labelY - 32 : labelY;
                const nameLines = hasBreak ? name.split('\n') : null;
                const drawName = () => {
                    if (hasBreak) {
                        this.drawText(nameLines[0] || '', x, y, w, 'center');
                        this.drawText(nameLines[1] || '', x, y + 22, w, 'center');
                    } else {
                        this.drawText(name, x, y - 14, w, 'center');
                    }
                };
                [8, 0].forEach(outline => {
                    this.contents.outlineWidth = outline;
                    if (outline) this.contents.outlineColor = 'white';
                    drawName();
                    this.drawText(labels[i][1], x, labelY + 14, w, 'center');
                });
            }
            ctx.restore();
            this.contents._setDirty();
        }
    };
    
    //-----------------------------------------------------------------------------
    // オプション画面
    //-----------------------------------------------------------------------------

    Scene_Base.prototype.startOption = function() {
        var maxW = 360, x = this.isMenuRight() ? Graphics.boxWidth - maxW - 32 : 32;
        var y = this.autoMenuY();
        this._optionsWindow = new Window_Options();
        this._optionsWindow.setHandler('cancel', this.onOptionCancel.bind(this));
        this.addWindow(this._optionsWindow);
        var w = 360, h = this._optionsWindow.fittingHeight(4);
        this._optionHelpWindow = new Window_Base(x, y, w, h);
        this.addWindow(this._optionHelpWindow);
        this._helpText = this._lastHelpText = '';
        this._optionsWindow.x = x, this._optionsWindow.y = this._optionHelpWindow.y + this._optionHelpWindow.height;
        
        var info = this._sceneInfo = {};
        info.windows = [wrapRef(this, '_optionsWindow'), wrapRef(this, '_optionHelpWindow')];
        info.windows.forEach(function(r) {r.value.openness = 1, r.value.open()});
    };
    Scene_Base.prototype.onOptionCancel = function() {
        ConfigManager.save();
        this.endSceneToMenu();
    };
    
    var optionHelpTexts = function(index) {
        return _tl([
            '言語を変更するよ',
            'メッセージの表示速度を選べるよ',
            '操作ボタンの表示タイプを\n「キーボード」か「ゲームパッド」かで選べるよ',
            'ゲームパッドでプレイ時\nAボタンとBボタンを反転して入力処理するよ',
            'ゲームパッドでプレイ時\nXボタンとYボタンを反転して入力処理するよ',
            [
                '戦闘中、左手操作を左右反転するよ　キーボードの\nW、A、S、Dキーがそれぞれ\n\\i[9]\\i[7]\\i[8]\\i[10]に対応するよ',
                '戦闘中、左手操作を左右反転するよ　ゲームパッドの\n↑、←、↓、→ボタンがそれぞれ\n\\i[3]\\i[1]\\i[2]\\i[4]に対応するよ'
            ][ConfigManager['String2']],
            'マスターボリュームを変更するよ',
            'BGM/MEの音量を変更するよ',
            'BGS/SEの音量を変更するよ'
        ][index]);
    };

    Window_Options.prototype.windowWidth = function() {
        return 360;
    };
    Window_Options.prototype.windowHeight = function() {
        return this.fittingHeight(Math.min(this.numVisibleRows(), 10));
    };
    Window_Options.prototype.updatePlacement = function() {};
    Window_Options.prototype.volumeOffset = function() {
        return 10;
    };
    Window_Options.prototype.drawItem = function(index) {
        var rect = this.itemRectForText(index);
        var statusWidth = this.statusWidth();
        var titleWidth = rect.width - statusWidth;
        var symbol = this.commandSymbol(index);
        this.resetTextColor();
        this.changePaintOpacity(this.isCommandEnabled(index));
        this.drawTextKNH(_tl(this.commandName(index)), rect.x + 8, rect.y, titleWidth, 'left');
        if (this.isVolumeSymbol(symbol)) {
            var value = this.getConfigValue(symbol).clamp(0, 100);
            var prevFontSize = this.contents.fontSize;
            var smallFontSize = Math.max(16, prevFontSize - 4);
            var statusX = titleWidth;
            this.setFontSize(smallFontSize);
            this.drawTextKNH(value + '%', statusX, rect.y - 2, statusWidth, 'right');
            this.setFontSize(prevFontSize, false);
            var barX = statusX + 10;
            var barY = rect.y + this.lineHeight() - 6;
            var barW = statusWidth - 8;
            var barH = 4;
            var segments = 10;
            var gap = 2;
            var totalGap = gap * (segments - 1);
            var segW = Math.max(2, Math.floor((barW - totalGap) / segments));
            var totalW = segW * segments + totalGap;
            var fillTotal = Math.floor(totalW * (value / 100));
            for (var i = 0; i < segments; i++) {
                var start = i * (segW + gap);
                var segFill = fillTotal - start;
                if (segFill > segW) segFill = segW;
                if (segFill > 0) {
                    var x = barX + start;
                    this.contents.fillRect(x, barY, segFill, barH, 'black');
                }
            }
            this.refreshYurayura();
        } else {
            var statusText = this.statusText(index);
            statusText = _tl(statusText);
            this.drawTextKNH(statusText, titleWidth, rect.y, statusWidth, 'right');
        }
    };
    Window_Options.prototype.update = function() {
        Window_Command.prototype.update.apply(this, arguments);
        var scene = SceneManager._scene;
        scene._helpText = optionHelpTexts(this.index());
        if (scene._helpText !== scene._lastHelpText) {
            scene._lastHelpText = scene._helpText;
            if (scene._optionHelpWindow) {
                scene._optionHelpWindow.refreshYurayura();
                scene._optionHelpWindow.contents.clear();
                scene._optionHelpWindow.drawTextNL(scene._helpText, 0, 0, scene._optionHelpWindow.contents.width);
            }
        }
    };

    //-----------------------------------------------------------------------------
    // セーブ画面
    //-----------------------------------------------------------------------------

    Game_Interpreter.prototype.command352 = function() {
        if (!$gameParty.inBattle()) {
            SceneManager._scene.startSave();
            this.setWaitMode('scene');
        }
        return true;
    };
    
    Scene_Base.prototype.startSave = function() {
        var maxW = 360, x = this.isMenuRight() ? Graphics.boxWidth - maxW - 32 : 32;
        var y = this.autoMenuY();
        this._helpWindow = new Window_Help(1);
        this._helpWindow.x = x, this._helpWindow.y = y;
        this._helpWindow.setText(_tl('どこにセーブする？'));
        this.addWindow(this._helpWindow);
        this._listWindow = new Window_SavefileList(x, this._helpWindow.y + this._helpWindow.height, maxW, this._helpWindow.fittingHeight(12) + 8);
        this._listWindow.setHandler('ok',     this.sc_onSavefileOk.bind(this));
        this._listWindow.setHandler('cancel', this.endSceneToMenu.bind(this));
        this._listWindow.select(DataManager.lastAccessedSavefileId() - 1);
        this._listWindow.setTopRow(this._listWindow.index() - 2);
        this._listWindow.setMode('save');
        this._listWindow.refresh();
        this.addWindow(this._listWindow);

        var info = this._sceneInfo = {};
        info.windows = [wrapRef(this, '_helpWindow'), wrapRef(this, '_listWindow')];
        info.windows.forEach(function(r) {r.value.openness = 1, r.value.open()});
    };
    Scene_Base.prototype.sc_onSavefileOk = function() {
        Scene_File.prototype.onSavefileOk.call(this);
        $gameSystem.onBeforeSave();
        if (DataManager.saveGame(this._listWindow.index() + 1)) {
            SoundManager.playSave();
            StorageManager.cleanBackup(this._listWindow.index() + 1);
            this.endSceneToMenu();
        } else {
            SoundManager.playBuzzer();
            this._listWindow.activate();
        }
    };

    const _Game_System_onBeforeSave = Game_System.prototype.onBeforeSave;
    Game_System.prototype.onBeforeSave = function () {
        _Game_System_onBeforeSave.apply(this, arguments);
        
        $gamePlayer.stopSe();
        $gamePlayer.followers().forEach(ch => ch.stopSe());
    };

    DataManager.makeSavefileInfo = function() {
        var info = {};
        info.globalId    = this._globalId;
        info.title       = $dataSystem.gameTitle;
        info.playerInfo  = [$gameParty.members()[0].name(), $gameParty.members()[0].level];
        info.mapName     = $gameMap.displayName();
        info.chapterName = _tl($gameVariables.value(7));
        info.playtime    = $gameSystem.playtimeText();
        info.timestamp   = Date.now();
        return info;
    };
    Window_SavefileList.prototype.maxVisibleItems = function() {
        return 4;
    };
    Window_SavefileList.prototype.drawItem = function(index) {
        var id = index + 1;
        var valid = DataManager.isThisGameFile(id);
        var info = DataManager.loadSavefileInfo(id);
        var rect = this.itemRectForText(index);
        var lineRect = this.itemRect(index);
        this.resetTextColor();
        this.setFontSize(28);
        this.drawFileId(id, rect.x + 8, rect.y - 2);
        if (info) {
            var x = 150, y = rect.y - 2;
            this.drawText('-%1-'.format(info.chapterName), x, y, rect.width - x - 8, 'right');
            x = rect.x + 16, y += this.lineHeight();
            this.setFontSize(24);
            this.drawText(info.playerInfo[0], x, y, rect.width - x - 8, 'left');
            this.drawText('Lv.' + info.playerInfo[1], x, y, rect.width - x - 8, 'right');
            y += this.lineHeight() - 2;
            var prevFontSize = this.contents.fontSize;
            this.drawText(info.mapName.replace('\\n[2]', info.playerInfo[0]), x, y, rect.width - x - 108);
            this.drawText(info.playtime, x, y, rect.width - x - 8, 'right');
            this.setFontSize(prevFontSize, false);
        }
        this.contents.fillRect(lineRect.x + 4, lineRect.y + lineRect.height - 6, lineRect.width - 8, 4, this.normalColor());
    };

    //-----------------------------------------------------------------------------
    // 名前入力画面
    //-----------------------------------------------------------------------------

    Game_Interpreter.prototype.command303 = function() {
        if (!$gameParty.inBattle()) {
            if ($dataActors[this._params[0]]) SceneManager._scene.startName($gameActors.actor(this._params[0]), this._params[1]);
            this.setWaitMode('scene');
        }
        return true;
    };

    var isEnglishNameInput = function() {
        var v = null;
        if (typeof _lg === 'function') v = _lg();
        else if (typeof _lg !== 'undefined') v = _lg;
        return Number(v) === 1;
    };
    var findAlnumPage = function(table) {
        if (!Array.isArray(table) || table.length === 0) return table;
        for (var i = 0; i < table.length; i++) {
            var page = table[i];
            var rows = Array.isArray(page) ? page : [page];
            var flat = rows.map(function(row) {
                if (Array.isArray(row)) return row.join('');
                return String(row);
            }).join('');
            if (/[A-Za-z]/.test(flat) && /[0-9]/.test(flat)) return page;
        }
        return table[table.length - 1];
    };
    var toHalfWidth = function(text) {
        return String(text || '')
            .replace(/\u3000/g, ' ')
            .replace(/[\uFF01-\uFF5E]/g, function(ch) {
                return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
            });
    };

    Scene_Base.prototype.startName = function(actor, maxLength) {
        if (isEnglishNameInput()) {
            var len = Number(maxLength);
            if (!Number.isNaN(len)) maxLength = Math.floor(len * 1.5) + 1;
        }
        this._editWindow = new Window_NameEdit(actor, maxLength);
        this.addWindow(this._editWindow);
        this._inputWindow = new Window_NameInput(this._editWindow);
        this._inputWindow.y += 8;
        this._inputWindow.setHandler('ok', this.sc_onInputOk.bind(this));
        this._inputWindow._normalCursor = true;
        this._inputWindow._refreshCursor();
        this.addWindow(this._inputWindow);
        var info = this._sceneInfo = {};
        info.actor = actor;
        info.windows = [wrapRef(this, '_editWindow'), wrapRef(this, '_inputWindow')];
        info.windows.forEach(function(r) {r.value.openness = 1, r.value.open()});
    };
    Scene_Base.prototype.sc_onInputOk = function() {
        var info = this._sceneInfo;
        info.actor.setName(this._editWindow.name());
        this._windowLayer.removeChild(this._editWindow);
        this._windowLayer.removeChild(this._inputWindow);
        this._editWindow = this._inputWindow = null;
        this._sceneInfo = null;
    };

    var _Window_NameEdit_refresh = Window_NameEdit.prototype.refresh;
    Window_NameEdit.prototype.refresh = function() {
        var actor = this._actor;
        if (actor && actor.faceName) {
            var faceBitmap = ImageManager.loadFace(actor.faceName());
            if (faceBitmap && !faceBitmap.isReady()) {
                if (this._zxcWaitingFaceBitmap !== faceBitmap) {
                    this._zxcWaitingFaceBitmap = faceBitmap;
                    faceBitmap.addLoadListener(function() {
                        if (this._zxcWaitingFaceBitmap === faceBitmap) this._zxcWaitingFaceBitmap = null;
                        if (this.contents) this.refresh();
                    }.bind(this));
                }
                return;
            }
            this._zxcWaitingFaceBitmap = null;
        }
        this.refreshYurayura();
        _Window_NameEdit_refresh.apply(this, arguments);
    };
    Window_NameEdit.prototype._refreshCursor = function () {
        var pad = this._padding;
        var x = this._cursorRect.x + pad - this.origin.x, y = this._cursorRect.y + pad - this.origin.y;
        var w = this._cursorRect.width, h = this._cursorRect.height;
        var m = 4, x2 = Math.max(x, pad), y2 = Math.max(y, pad), ox = x - x2 + m, oy = y - y2 + m;
        var w2 = Math.min(w, this._width - pad - x2) + m * 2, h2 = Math.min(h, this._height - pad - y2) + m * 2;
        var bitmap = new Bitmap(w2, h2);
        this._windowCursorSprite.bitmap = bitmap;
        this._windowCursorSprite.setFrame(0, 0, w2, h2);
        this._windowCursorSprite.move(x2 - m, y2 - m);

        if (w > 0 && h > 0 && this._windowskin) {
            bitmap.fillRect(ox, oy + 4, 4, h2 - 18, '#474e51');
        }
        this._windowCursorSprite._yuraInfo = [3, 10];
    };
    Window_NameEdit.prototype._updateCursor = function () {
        var a = 10;
        this._windowCursorSprite.alpha = Math.floor((this._animationCount++ % (a * 3.5)) / a).clamp(0, 1);
        this._windowCursorSprite.visible = this.isOpen();
    };

    var _Window_NameEdit_left = Window_NameEdit.prototype.left;
    Window_NameEdit.prototype.left = function() {
        if (!isEnglishNameInput()) return _Window_NameEdit_left.apply(this, arguments);
        var nameCenter = (this.contentsWidth() + this.faceWidth()) / 2;
        var nameWidth = (this._maxLength + 1) * (this.charWidth() - 6);
        return Math.min(nameCenter - nameWidth / 2, this.contentsWidth() - nameWidth);
    };

    var _Window_NameEdit_itemRect = Window_NameEdit.prototype.itemRect;
    Window_NameEdit.prototype.itemRect = function(index) {
        if (!isEnglishNameInput()) return _Window_NameEdit_itemRect.apply(this, arguments);
        var w = this.charWidth() - 6;
        return {
            x: this.left() + index * w,
            y: 54,
            width: w,
            height: this.lineHeight()
        };
    };

    var _Window_NameEdit_drawUnderline = Window_NameEdit.prototype.drawUnderline;
    Window_NameEdit.prototype.drawUnderline = function(index) {
        if (!isEnglishNameInput()) {
            _Window_NameEdit_drawUnderline.apply(this, arguments);
            return;
        }
        var rect = this.itemRect(index);
        rect.y += rect.height - 4;
        rect.x += 1;
        rect.width -= 2;
        rect.height = 2;
        var color = this.underlineColor();
        this.contents.paintOpacity = 48;
        this.contents.fillRect(rect.x, rect.y, rect.width, rect.height, color);
        this.contents.paintOpacity = 255;
    };

    var _Window_NameEdit_drawChar = Window_NameEdit.prototype.drawChar;
    Window_NameEdit.prototype.drawChar = function(index) {
        if (!isEnglishNameInput()) {
            _Window_NameEdit_drawChar.apply(this, arguments);
            return;
        }
        var rect = this.itemRect(index);
        this.resetTextColor();
        this.drawText(this._name[index] || '', rect.x, rect.y, rect.width, 'center');
    };

    var _Window_NameEdit_add = Window_NameEdit.prototype.add;
    Window_NameEdit.prototype.add = function(ch) {
        if (isEnglishNameInput()) ch = toHalfWidth(ch);
        return _Window_NameEdit_add.call(this, ch);
    };

    var _Window_NameInput_processCursorMove = Window_NameInput.prototype.processCursorMove;
    Window_NameInput.prototype.processCursorMove = function() {
        this._lastIndex = this._index;
        _Window_NameInput_processCursorMove.apply(this, arguments);
    };

    var _Window_NameInput_select = Window_NameInput.prototype.select;
    Window_NameInput.prototype.select = function(index) {
        this._lastIndex = this._index;
        _Window_NameInput_select.call(this, index);
    };

    var _Window_NameInput_table = Window_NameInput.prototype.table;
    Window_NameInput.prototype.table = function() {
        var table = _Window_NameInput_table.call(this);
        if (!isEnglishNameInput()) return table;
        return [findAlnumPage(table)];
    };

    var _Window_NameInput_itemRect = Window_NameInput.prototype.itemRect;
    Window_NameInput.prototype.itemRect = function(index) {
        if (!isEnglishNameInput()) return _Window_NameInput_itemRect.apply(this, arguments);
        var col = index % 10;
        var row = Math.floor(index / 10);
        var w = 42;
        return {
            x: col * w + Math.floor(col / 5) * 24,
            y: row * this.lineHeight(),
            width: w,
            height: this.lineHeight()
        };
    };

    var _Window_NameInput_isPageChange = Window_NameInput.prototype.isPageChange;
    Window_NameInput.prototype.isPageChange = function() {
        if (isEnglishNameInput()) return false;
        return _Window_NameInput_isPageChange.apply(this, arguments);
    };

    var _Window_NameInput_updateCursor = Window_NameInput.prototype.updateCursor;
    Window_NameInput.prototype.updateCursor = function() {
        if (isEnglishNameInput() && this._index === 88) {
            this._index = (this._lastIndex === 89) ? 87 : 89;
        }
        _Window_NameInput_updateCursor.apply(this, arguments);
    };

    var _Window_NameInput_refresh = Window_NameInput.prototype.refresh;
    Window_NameInput.prototype.refresh = function() {
        if (isEnglishNameInput()) this._page = 0;
        this.refreshYurayura();
        if (isEnglishNameInput()) {
            var table = this.table();
            this.contents.clear();
            this.resetTextColor();
            for (var i = 0; i < 90; i++) {
                var rect = this.itemRect(i);
                var text = table[this._page][i];
                if (i === 88) text = '';
                text = toHalfWidth(text);
                this.drawText(text, rect.x, rect.y, rect.width, 'center');
            }
            return;
        }
        _Window_NameInput_refresh.apply(this, arguments);
    };


    //-----------------------------------------------------------------------------
    // お店画面
    //-----------------------------------------------------------------------------
    
    Game_Interpreter.prototype.command302 = function () {
        if (!$gameParty.inBattle()) {
            var goods = [this._params];
            while (this.nextEventCode() === 605) {
                this._index++;
                goods.push(this.currentCommand().parameters);
            }
            SceneManager._scene.startShop(goods);
            this.setWaitMode('scene');
        }
        return true;
    };
    Scene_Base.prototype.startShop = function (goods) {
        var maxW = 360, x = 48;
        var y = this.autoMenuY();
        this._helpWindow = new Window_Help();
        this._helpWindow.x = x, this._helpWindow.y = y;
        this._helpWindow.setShop();
        this.addWindow(this._helpWindow);
        var wy = this._helpWindow.y + this._helpWindow.height;
        var wh = this._helpWindow.fittingHeight(9);
        this._itemWindow = new Window_ShopBuy(x, wy, wh, goods);
        this._itemWindow.setHelpWindow(this._helpWindow);
        this._itemWindow.setHandler('ok', this.sc_onBuyOk.bind(this));
        this._itemWindow.setHandler('cancel', this.sc_onShopCommand.bind(this));
        this._itemWindow.select(-1);
        this.addWindow(this._itemWindow);
        this._sellWindow = new Window_ShopSell(x, wy, maxW, wh);
        this._sellWindow.setHelpWindow(this._helpWindow);
        this._sellWindow.setHandler('ok', this.sc_onSellOk.bind(this));
        this._sellWindow.setHandler('cancel', this.sc_onShopCommand.bind(this));
        this._sellWindow.setCategory('shop');
        this._sellWindow.hide();
        this.addWindow(this._sellWindow);
        this._shopFaceWindow = new Window_Base(Graphics.boxWidth / 2, y, maxW, 298);
        this._shopFaceWindow._bitmap = ImageManager.loadFace('shop1');
        this._shopFaceWindow.update = () => {
            Window_Base.prototype.update.call(this._shopFaceWindow);
            this.sc_updateFaceWindow();
        }
        this.addWindow(this._shopFaceWindow);
        this._goldWindow = new Window_Gold(Graphics.boxWidth / 2, this._shopFaceWindow.y + this._shopFaceWindow.height);
        this._goldWindow.width = maxW, this._goldWindow.refreshYurayura(), this._goldWindow.createContents();
        this._goldWindow.refresh = (() => {
            Window_Gold.prototype.refresh.apply(this._goldWindow, arguments);
            this._goldWindow.drawText(_tl('所持金'), 4, 0, this._goldWindow.contents.width);
        }).bind(this)
        this.addWindow(this._goldWindow);
        var statusH = this._helpWindow.fittingHeight(4);
        this._statusWindow = new Window_ShopStatus(Graphics.boxWidth / 2, this._goldWindow.y + this._goldWindow.height, maxW, statusH);
        this.addWindow(this._statusWindow);

        var info = this._sceneInfo = {};
        info.shop = true;
        info.goods = goods;
        info.choice = 0;
        info.windows = [wrapRef(this, '_helpWindow'), wrapRef(this, '_itemWindow'), wrapRef(this, '_shopFaceWindow'),
            wrapRef(this, '_goldWindow'), wrapRef(this, '_statusWindow')];
        info.windows.forEach(function (r) { r.value.openness = 1, r.value.open() });

        this.sc_onShopCommand(true);
    };
    Scene_Base.prototype.sc_onShopCommand = function (isFirst) {
        this._itemWindow.select(-1);
        this._itemWindow.deactivate();
        this._itemWindow.show();
        this._sellWindow.hide();
        this._helpWindow.setItem();
        this.addWindow(this._messageWindow);
        this.addWindow(this._messageWindow._choiceWindow);
        $gameSystem.setMessagePopupFree(500, 220);
        $gameMessage._tailDir = 3;
        var text = _tl(isFirst ? 'なんか\n買うかい\\! ' : '他にもなんか\n用かい\\! ');
        $gameMessage.add(text);
        $gameMessage.setChoices([_tl('買う'), _tl('売る'), _tl('去る')], 0, 2);
        $gameMessage.setChoiceCallback((n => this._sceneInfo._choice = n).bind(this));
        this._sceneInfo.phase = 'shopCommand';
    };
    Scene_Base.prototype.sc_afterShopCommand = function () {
        if (this._sceneInfo._choice === 0) {
            this._itemWindow.setMoney($gameParty.gold());
            this._itemWindow.select(0);
            this._itemWindow.activate();
            this._sceneInfo.phase = '';
        } else if (this._sceneInfo._choice === 1) {
            this._itemWindow.hide();
            this._sellWindow.refresh();
            this._sellWindow.show();
            this._sellWindow.select(0);
            this._sellWindow.activate();
            this._sceneInfo.phase = '';
        } else {
            this.sc_onShopEnd();
        }
    };
    Scene_Base.prototype.sc_onBuyOk = function () {
        $gameMessage.add(_tl('%1だね\n買うかい\\! ').format(_tl(this._itemWindow.item().name)));
        $gameMessage.setChoices([_tl('はい'), _tl('いいえ')], 0, 1);
        $gameMessage.setChoiceCallback((n => this._sceneInfo._choice = n).bind(this));
        this._sceneInfo.phase = 'buyCheck';
    };
    Scene_Base.prototype.sc_doBuy = function () {
        if (this._sceneInfo._choice === 0) {
            SoundManager.playShop();
            var item = this._statusWindow._item;
            $gameParty.loseGold(1 * this._itemWindow.price(item));
            $gameParty.gainItem(item, 1);
            this._helpWindow.refresh();
            this._goldWindow.refresh();
            $gameMessage.add(_tl('まいどあり'));
            this._faceIndex = 2;
        }
        this._sceneInfo.phase = 'doBuy';
    };
    Scene_Base.prototype.sc_afterBuy = function () {
        this._itemWindow.setMoney($gameParty.gold());
        this._itemWindow.activate();
        this._sceneInfo.phase = '';
    };
    Scene_Base.prototype.sc_onSellOk = function () {
        $gameSystem.setMessagePopupFree(480, 220);
        $gameMessage._tailDir = 3;
        var item = this._sellWindow.item();
        var text = $gameParty.numItems(item) <= 1 ? '%1だね\n%2\\gだよ\n本当に売るかい\\! ' : '%1だね\n1つ %2\\gだよ\nいくつ売るかい\\! ';
        text = _tl(text);
        $gameMessage.add(_tl(text).format(_tl(item.name), Math.floor(item.price / 2)));
        $gameMessage.setChoices($gameParty.numItems(item) <= 1 ?
            [(_tl('はい')), _tl('いいえ')] : [_tl('1つ'), _tl('ぜんぶ'), _tl('やめる')],
            0, Math.min($gameParty.numItems(item), 2));
        $gameMessage.setChoiceCallback((n => this._sceneInfo._choice = n).bind(this));
        this._sceneInfo.phase = 'sellCheck';
    };
    Scene_Base.prototype.sc_doSell = function () {
        var item = this._sellWindow.item();
        if (this._sceneInfo._choice < Math.min($gameParty.numItems(item), 2)) {
            SoundManager.playShop();
            $gameParty.gainGold(Math.floor(item.price / 2) * [1, $gameParty.numItems(item)][this._sceneInfo._choice]);
            $gameParty.loseItem(item, [1, $gameParty.numItems(item)][this._sceneInfo._choice]);
            this._sellWindow.refresh();
            if (this._sellWindow.maxItems() > 0)
                this._sellWindow.select(this._sellWindow.index().clamp(0, this._sellWindow.maxItems() - 1));
            if (!$gameParty.numItems(item)) this._helpWindow.setItem();
            this._goldWindow.refresh();
            $gameMessage.add(_tl('ありがとう'));
            this._faceIndex = 2;
        }
        this._sceneInfo.phase = 'doSell';
    };
    Scene_Base.prototype.sc_afterSell = function () {
        this._sellWindow.activate();
        this._sceneInfo.phase = '';
    };
    Scene_Base.prototype.sc_onShopEnd = function () {
        $gameMessage.add(_tl('また来てね'));
        this._sceneInfo.phase = 'shopEnd';
    };
    Scene_Base.prototype.sc_afterShopEnd = function () {
        $gameMessage._tailDir = 2;
        this.endScene();
    };
    Scene_Base.prototype.sc_updateFaceWindow = function () { //店画像更新
        var wd = this._shopFaceWindow;
        var info = [
            this._messageWindow._choiceWindow._index, this._messageWindow._choiceWindow.active,
            this._messageWindow._textState ? this._messageWindow._textState.text : wd._lastTextState,
            this._itemWindow._index, this._sellWindow._index
        ].toString();
        if (wd._lastInfoFace !== info) {
            wd._lastInfoFace = info;
            wd._lastTextState = this._messageWindow._textState ? this._messageWindow._textState.text : '';
            var index = 0;
            if (this._faceIndex) {
                index = this._faceIndex;
                this._faceIndex = null;
            } else {
                if (this._messageWindow._choiceWindow._index === 2 &&
                    this._messageWindow._choiceWindow.active && $gameMessage._choices[2] === '去る') index = 1;
                else if (this._messageWindow.isClosed() && !$gameMessage._texts.length &&
                    wd._lastFaceIndex !== 3 && !Math.randomInt(6)) index = 3;
            }
            if (wd._lastFaceIndex !== index) {
                wd._lastFaceIndex = index;
                var bmp = wd._bitmap;
                bmp.addLoadListener(() => {
                    wd.refreshYurayura();
                    wd.contents.clear();
                    wd.contents.blt(bmp, (index % 2) * bmp.width / 2, Math.floor(index / 2) * bmp.height / 2,
                        bmp.width / 2, bmp.height / 2, 0, 0);
                })
            }
        }
    };

    Window_ShopBuy.prototype.windowWidth = function () {
        return 360;
    };
    Window_ShopBuy.prototype.drawItem = function (index) {
        var item = this._data[index];
        var rect = this.itemRect(index);
        var priceWidth = 120;
        rect.width -= this.textPadding();
        this.changePaintOpacity(this.isEnabled(item));
        this.drawText(item.name, rect.x + 16, rect.y, rect.width - priceWidth - 32);
        this.drawTextKNH('%1\\x[4]\\s[20]%2\\s[28]'.format(this.price(item), TextManager.currencyUnit), rect.x + rect.width - priceWidth,
            rect.y, priceWidth, 'right');
        this.changePaintOpacity(true);
    };
    
    Window_ShopStatus.prototype.refresh = function () {
        this.refreshYurayura();
        this.contents.clear();
        this.drawActorStatTable(0, 0);
    };
    const _Window_ShopStatus_update = Window_ShopStatus.prototype.update;
    Window_ShopStatus.prototype.update = function () {
        _Window_ShopStatus_update.apply(this, arguments);
        this._item = SceneManager._scene._itemWindow.item();
        var info = JSON.stringify(this._item);
        if (this._lastInfoItem !== info) {
            this._lastInfoItem = info;
            this.refresh();
        }
        //ここで店の処理自体の更新を行う
        var scene = SceneManager._scene;
        if (scene._sceneInfo) {
            if (!$gameMessage.isBusy()) {
                if (scene._sceneInfo.phase === 'shopCommand') {
                    scene.sc_afterShopCommand();
                } else if  (scene._sceneInfo.phase === 'buyCheck') {
                    scene.sc_doBuy();
                } else if (scene._sceneInfo.phase === 'doBuy') {
                    scene.sc_afterBuy();
                } else if (scene._sceneInfo.phase === 'sellCheck') {
                    scene.sc_doSell();
                } else if (scene._sceneInfo.phase === 'doSell') {
                    scene.sc_afterSell();
                } else if (scene._sceneInfo.phase === 'shopEnd') {
                    scene.sc_afterShopEnd();
                }
            }
        }
    };

    /**
     * 指定位置にパーティメンバーごとのステータス一覧を描画する。
     * @param {number} x - 表の左端X座標
     * @param {number} y - 表の開始Y座標
     */
    Window_ShopStatus.prototype.drawActorStatTable = function (x, y) {
        const members = this.statusMembers(); // 1ページ最大4人
        if (members.length === 0) return;

        // 表の左側に表示するパラメータ名（日本語で固定）
        const paramIds = !this._item || DataManager.isItem(this._item) ? ['lv', 'hp'] : [0, 2, 3];

        // パラメータ名を表示するための列幅を計算
        // 幅はお好みで調整してください（ここでは80ピクセル程度）
        const labelWidth = 80;
        const totalWidth = this.contents.width - x - this.textPadding();
        const colWidth = Math.floor((totalWidth - labelWidth) / members.length);

        // 先頭行：各メンバーの名前を表示
        for (let i = 0; i < members.length; i++) {
            const actor = members[i];
            const colX = x + labelWidth + colWidth * i;
            this.resetTextColor();
            this.drawText(actor.name(), colX, y, colWidth, 'center');
        }

        // 2行目以降：パラメータ名と、その値を各列に表示
        for (let r = 0; r < paramIds.length; r++) {
            const rowY = y + this.lineHeight() * (r + 1);
            // 左端にパラメータ名（システムカラーで）
            this.changeTextColor(this.systemColor());
            this.drawText(paramIds[r] === 'lv' ? TextManager.levelA : paramIds[r] === 'hp' ? TextManager.hp :
                TextManager.param(paramIds[r]), x, rowY, labelWidth, 'left');
            // 各メンバーの数値を描画
            for (let i = 0; i < members.length; i++) {
                const actor = members[i];
                let value = paramIds[r] === 'lv' ? actor.level : paramIds[r] === 'hp' ? actor.hp : actor.param(paramIds[r]);
                const colX = x + labelWidth + colWidth * i;
                this.resetTextColor();
                this.drawText(String(value), colX, rowY, colWidth, 'center');
            }
        }
    };

    const _Window_Gold_refresh = Window_Gold.prototype.refresh;
    Window_Gold.prototype.refresh = function () {
        this.refreshYurayura();
        _Window_Gold_refresh.apply(this, arguments);
    };

    Window_Help.prototype.setShop = function () {
        this._onShop = true;
        this.height = this.fittingHeight(5);
        this.createContents();
        this.refresh();
    };
    const _Window_Help_refresh = Window_Help.prototype.refresh;
    Window_Help.prototype.refresh = function () {
        _Window_Help_refresh.apply(this, arguments);
        if (this._item && this._onShop) {
            this.drawText(_tl(DataManager.isItem(this._item) ? 'アイテム' : 'そうび品'), 8, this.lineHeight() * 4, 144);
            this.drawText(_tl('所持数'), 144 + 8, this.lineHeight() * 4, this.contents.width - 144 - 16);
            this.drawText($gameParty.numItems(this._item), 144 + 8, this.lineHeight() * 4, this.contents.width - 144 - 16, 'right');
        }
    };

    const _Window_ItemList_includes = Window_ItemList.prototype.includes;
    Window_ItemList.prototype.includes = function (item) {
        if (this._category === 'shop') return !!item;
        return _Window_ItemList_includes.apply(this, arguments);
    };

    //-----------------------------------------------------------------------------
    // タイトル画面
    //-----------------------------------------------------------------------------

    const _Scene_Title_create = Scene_Title.prototype.create;
    Scene_Title.prototype.create = function () {
        _Scene_Title_create.apply(this, arguments);

        //バージョン情報
        var vw = this._versionWindow = new Window_Free(12, 12, Graphics.boxWidth - 24, 48);
        vw.setWindowSkin(3);
        vw.setFontSize(20);
        vw.drawText(version, 0, 0, vw.contents.width, 'left');
        if (!$gameTemp._startedTitle) vw.openness = 0;
        this.addWindow(vw);

        //操作方法
        var hw = this._helpWindow = new Window_Free(12, Graphics.boxHeight - 40, Graphics.boxWidth - 24, 40);
        hw.setWindowSkin(3);
        hw.setFontSize(20);
        var text = !$gameVariables.value(32) ?
            'Enter：決定 / Esc：キャンセル / F4：フルスクリーン' : 'A：決定 / B：キャンセル / F4：フルスクリーン';
        hw.drawText(_tl(text), 0, 0, hw.contents.width, 'left');
        text = !$gameVariables.value(32) ?
            'C：クレジット(利用素材)' : 'R：クレジット(利用素材)';
        hw.drawText(_tl(text), 0, 0, hw.contents.width, 'right');
        if (!$gameTemp._startedTitle) hw.openness = 0;
        this.addWindow(hw);

        //クレジットウィンドウ
        var w = 600, h = 500;
        var cw = this._creditWindow = new Window_Base((Graphics.boxWidth - w) / 2, (Graphics.boxHeight - h) / 2, w, h);
        cw.openness = 0;
        cw.setWindowSkin(3);
        this.refreshCredit();
        this.addWindow(cw);

        this._frontSprite = new Sprite();
        this.addChild(this._frontSprite);
        if (!$gameTemp._startedTitle) $gameScreen._brightness = 0;
    };
    Scene_Title.prototype.refreshCredit = function () {
        var text = (
            _tl('フォント') + '\n' +
            '　' + _tl('日本語') + '　073 TEGUSE - Kanaka Font %1\n' +
            '　' + _tl('英語') + '　Schoolbell\n' +
            '\n' +
            _tl('効果音') + '\n' +
            '　効果音ラボ%1 \n' +
            '\n' +
            _tl('プラグイン') + '\n' +
            '　トリアコンタン %1\n' +
            '　KAMESOFT %1\n' +
            '　神奈月サスケ %1\n' +
            '　木星ペンギン %1\n'
        );
        text = text.format(_tl('様'));
        var cw = this._creditWindow;
        cw.contents.clear();
        cw.drawText(_tl('クレジット(利用素材)'), 0, 0, cw.contents.width, 'center');
        cw.drawTextKNH(text, 0, 45, cw.contents.width, 'left');
        cw.refreshYurayura();
    };
    Scene_Title.prototype.start = function () {
        Scene_Base.prototype.start.call(this);
        SceneManager.clearStack();
        this.centerSprite(this._backSprite1);
        this.centerSprite(this._backSprite2);
        if ($gameTemp._startedTitle) this._backSprite1._yuraInfo = [];
        this._titleCount = 0;
        if (!require("fs").existsSync(StorageManager.localFilePath(-1))) //初回オプション起動
            SceneManager.push(Scene_Options);
    };
    Scene_Title.prototype.drawGameTitle = function () {
        this._gameTitleSprite.bitmap = ImageManager.loadTitle1('logo');
        this._gameTitleSprite.anchor.x = this._gameTitleSprite.anchor.y = 0.5;
        this._gameTitleSprite.x = Graphics.boxWidth / 2;
        this._gameTitleSprite.y = 126;
        this._gameTitleSprite._yuraInfo = [25, 15];
        if (!$gameTemp._startedTitle) this._gameTitleSprite.opacity = 0;
    };
    Scene_Title.prototype.update = function () {
        Scene_Base.prototype.update.call(this);

        if ($gameTemp._startedTitle && !this._phase && this._commandWindow.isOpen()) {
            //クレジットウィンドウ更新
            var cw = this._creditWindow;
            if (cw.openness > 0) {
                if ((Input.isTriggered('ok') || Input.isTriggered('cancel') || Input.isTriggered('R')) &&
                    !cw._closing && !cw._opening) {
                    SoundManager.playCancel();
                    cw.close();
                    this._commandWindow.activate();
                }
            } else {
                if (Input.isTriggered('R')) {
                    SoundManager.playOk();
                    cw.open();
                    this._commandWindow.deactivate();
                }
            }
        }

        if (this._phase === 'newGame') { //はじめから選択
            if (this._titleCount < 90) {
            } else if (this._titleCount === 90) {
                this._gameTitleSprite.opacity = 0;
                this._backSprite1._yuraInfo = null;
                AudioManager.fadeOutBgm(5);
            } else if (this._titleCount < 210) {
                $gameScreen._brightness = 255 - 255 / 5 * (Math.floor((this._titleCount - 90) / 30) + 1);
            } else if (this._titleCount === 210) {
                $gameScreen._brightness = 0;
            } else if (this._titleCount === 300) {
                $gameSystem.playSe('Book2', 100, 80);
            } else if (this._titleCount === 540) {
                DataManager.setupNewGame();
                SceneManager.goto(Scene_Map);
                $gameScreen.startFadeIn(60);
            }
        } else if (this._phase === 'gameEnd') { //ゲーム終了選択
            if (this._titleCount === 0) {
                this._gameTitleSprite.opacity = 0;
                this._backSprite1._yuraInfo = null;
                AudioManager.fadeOutBgm(5);
            } else if (this._titleCount < 120) {
                $gameScreen._brightness = 255 - 255 / 5 * (Math.floor((this._titleCount) / 30) + 1);
            } else if (this._titleCount === 120) {
                $gameScreen._brightness = 0;
            } else if (this._titleCount === 150) {
                SceneManager.exit();
            }
        } else { //タイトル画面開始
            if (!$gameTemp._startedTitle) {
                if (this._titleCount < 120 && !this._sceneInfo) {
                    $gameScreen._brightness = 255 / 5 * (Math.floor(this._titleCount / 30) + 1);
                } else if (this._titleCount === 120) {
                    $gameScreen._brightness = 255;
                    this._backSprite1._yuraInfo = [];
                } else if (this._titleCount === 180) {
                    this._gameTitleSprite.opacity = 255;
                    this._commandWindow.openness = 255;
                    this._versionWindow.openness = 255;
                    this._helpWindow.openness = 255;
                    this.playTitleMusic();
                    $gameTemp._startedTitle = true
                }
            }
        }

        // タイトルコマンドが完全表示のときだけ下部ヘルプを表示
        if (this._helpWindow && this._commandWindow) {
            this._helpWindow.openness = this._commandWindow.isOpen() && !this._phase ? 255 : 0;
        }
        this._titleCount++;
        $gameScreen.update();
    };

    Scene_Title.prototype.commandNewGame = function () {
        this._commandWindow.close();
        this._versionWindow.openness = this._helpWindow.openness = 0;
        this._phase = 'newGame';
        this._titleCount = 0;
    };
    Scene_Title.prototype.commandGameEnd = function () {
        this._commandWindow.close();
        this._versionWindow.openness = this._helpWindow.openness = 0;
        this._phase = 'gameEnd';
        this._titleCount = 0;
    };
    const _Scene_Title_commandOptions = Scene_Title.prototype.commandOptions;
    Scene_Title.prototype.commandOptions = function () {
        this._helpWindow.openness = 0;
        if (this._creditWindow) this._creditWindow.openness = 0;
        _Scene_Title_commandOptions.apply(this, arguments);
    };
    const _Scene_Title_commandContinue = Scene_Title.prototype.commandContinue;
    Scene_Title.prototype.commandContinue = function () {
        this._helpWindow.openness = 0;
        if (this._creditWindow) this._creditWindow.openness = 0;
        _Scene_Title_commandContinue.apply(this, arguments);
    };

    const _Scene_Title_createCommandWindow = Scene_Title.prototype.createCommandWindow;
    Scene_Title.prototype.createCommandWindow = function () {
        _Scene_Title_createCommandWindow.apply(this, arguments);
        this._commandWindow.setHandler('gameEnd', this.commandGameEnd.bind(this));
    };

    const _Window_TitleCommand_makeCommandList = Window_TitleCommand.prototype.makeCommandList;
    Window_TitleCommand.prototype.makeCommandList = function () {
        _Window_TitleCommand_makeCommandList.apply(this, arguments);
        this.addCommand('ゲーム終了', 'gameEnd', true);
    };

    const _Window_TitleCommand_initialize = Window_TitleCommand.prototype.initialize;
    Window_TitleCommand.prototype.initialize = function () {
        _Window_TitleCommand_initialize.apply(this, arguments);
        this.setWindowSkin(3);
        if ($gameTemp._startedTitle) _timeOut(() => this.open(), 20);
    };
    Window_TitleCommand.prototype.windowWidth = ()=> 340;
    Window_TitleCommand.prototype.maxCols = () => 2;
    Window_TitleCommand.prototype.itemHeight = function () {
        return Window_Command.prototype.itemHeight.call(this) + 12;
    };
    Window_TitleCommand.prototype.windowHeight = function () {
        return Window_Command.prototype.windowHeight.call(this) + 24;
    };
    Window_TitleCommand.prototype.updatePlacement = function () {
        this.x = (Graphics.boxWidth - this.width) / 2;
        this.y = Graphics.boxHeight - this.height - 72;
    };
    Window_TitleCommand.prototype.drawItem = function (index) {
        var rect = this.itemRectForText(index);
        rect.y += Math.floor((this.itemHeight() - this.lineHeight()) / 2);
        this.resetTextColor();
        this.changePaintOpacity(this.isCommandEnabled(index));
        this.drawText(this.commandName(index), rect.x + 8, rect.y, rect.width, this.itemTextAlign());
    };
    const _Window_TitleCommand_updateCursor = Window_TitleCommand.prototype.updateCursor;
    Window_TitleCommand.prototype.updateCursor = function () {
        _Window_TitleCommand_updateCursor.apply(this, arguments);
        var rect = this.itemRect(this.index());
        this.setCursorRect(rect.x, rect.y + 6, rect.width, rect.height);
    };

    var optionLanguageId = function() {
        try {
            if (typeof _lg === 'function') return Number(_lg()) || 0;
            if (typeof _lg !== 'undefined') return Number(_lg) || 0;
        } catch (e) {
            // noop
        }
        return 0;
    };
    Scene_Options.prototype.redrawOptionOperationText = function() {
        var ow = this._optionOperationWindow;
        if (!ow) return;
        // ゆらゆらのキャッシュを解除してから再描画し、残像を防ぐ
        if (typeof ow.refreshYurayura === 'function') ow.refreshYurayura();
        ow.createContents();
        ow.contents.clear();
        ow.drawText(
            !$gameVariables.value(32)
                ? _tl('Enter or ←→：変更 / Esc：保存して戻る')
                : _tl('A or ←→：変更 / B：保存して戻る'),
            0,
            0,
            ow.contents.width,
            'left'
        );
        if (typeof ow.refreshYurayura === 'function') ow.refreshYurayura();
    };

    //タイトル画面中のオプション
    const _Scene_Options_create = Scene_Options.prototype.create;
    Scene_Options.prototype.create = function () {
        _Scene_Options_create.apply(this, arguments);
        this._optionsWindow.setHandler('cancel', this.closeWindows.bind(this));
        var w = 460, h = this._optionsWindow.fittingHeight(4);
        var x = (Graphics.boxWidth - w) / 2;
        this._optionHelpWindow = new Window_Base(x, 40, w, h);
        this.addWindow(this._optionHelpWindow);
        this._helpText = this._lastHelpText = '';
        this._optionsWindow.x = x, this._optionsWindow.y = this._optionHelpWindow.y + this._optionHelpWindow.height;
        this._optionsWindow.width = w, this._optionsWindow.createContents(), this._optionsWindow.refresh();
        this._optionsWindow.setWindowSkin(3);
        this._optionHelpWindow.setWindowSkin(3);

        var ow = this._optionOperationWindow = new Window_Free(12, Graphics.boxHeight - 40, Graphics.boxWidth - 24, 40);
        ow.setWindowSkin(3);
        ow.setFontSize(20);
        ow.openness = 0;
        this.addWindow(ow);
        this.redrawOptionOperationText();
        this._lastOptionLanguageId = optionLanguageId();
    };
    const _Scene_Options_start = Scene_Options.prototype.start;
    Scene_Options.prototype.start = function () {
        _Scene_Options_start.apply(this, arguments);
        this._optionsWindow.openness = 0, this._optionHelpWindow.openness = 0, this._optionOperationWindow.openness = 0;
        _timeOut(() => {this._optionsWindow.open(), this._optionHelpWindow.open()}, 12);
        $gameScreen._brightness = 255;
    };
    Scene_Options.prototype.closeWindows = function() {
        this._optionsWindow.close();
        this._optionHelpWindow.close();
        if (this._optionOperationWindow) this._optionOperationWindow.close();
        _timeOut(() => this.popScene(), $gameTemp._startedTitle ? 12 : 150);
    };
    Scene_Options.prototype.refreshOptionLanguage = function() {
        if (this._optionsWindow) this._optionsWindow.refresh();
        if (this._optionHelpWindow && this._optionsWindow) {
            this._helpText = optionHelpTexts(this._optionsWindow.index());
            this._lastHelpText = this._helpText;
            this._optionHelpWindow.refreshYurayura();
            this._optionHelpWindow.contents.clear();
            this._optionHelpWindow.drawTextNL(this._helpText, 0, 0, this._optionHelpWindow.contents.width);
        }
        this.redrawOptionOperationText();
    };
    const _Scene_Options_update = Scene_Options.prototype.update;
    Scene_Options.prototype.update = function () {
        _Scene_Options_update.apply(this, arguments);
        var languageId = optionLanguageId();
        if (this._lastOptionLanguageId !== languageId) {
            this._lastOptionLanguageId = languageId;
            this.refreshOptionLanguage();
        }
        if (this._optionOperationWindow && this._optionsWindow && this._optionHelpWindow) {
            this._optionOperationWindow.openness = this._optionsWindow.isOpen() && this._optionHelpWindow.isOpen() ? 255 : 0;
        }
    };

    //ロード画面
    const _Scene_Load_create = Scene_Load.prototype.create;
    Scene_Load.prototype.create = function () {
        _Scene_Load_create.apply(this, arguments);
        this._helpWindow.width = 420;
        this._helpWindow.x = (Graphics.boxWidth - this._helpWindow.width) / 2;
        this._helpWindow.y = 60;
        this._helpWindow.createContents();
        this._helpWindow.setText('');
        this._helpWindow.setText(this.helpWindowText());
        this._listWindow.x = this._helpWindow.x, this._listWindow.y = this._helpWindow.y + this._helpWindow.height;
        this._listWindow.width = this._helpWindow.width;
        this._listWindow.height = this._helpWindow.fittingHeight(12);
        this._listWindow.refresh();
        this._listWindow.updateCursor();
        this._listWindow.setHandler('cancel', this.closeWindows.bind(this));
        this._helpWindow.setWindowSkin(3);
        this._listWindow.setWindowSkin(3);
    };
    const _Scene_Load_start = Scene_Load.prototype.start;
    Scene_Load.prototype.start = function () {
        _Scene_Load_start.apply(this, arguments);
        this._helpWindow.openness = 0, this._listWindow.openness = 0;
        _timeOut(() => { this._helpWindow.open(), this._listWindow.open() }, 12);
    };
    Scene_Load.prototype.closeWindows = function () {
        this._helpWindow.close();
        this._listWindow.close();
        _timeOut(() => this.popScene(), 12);
    };
    const _Scene_Load_update = Scene_Load.prototype.update;
    Scene_Load.prototype.update = function () {
        _Scene_Load_update.apply(this, arguments);
        $gameScreen.update();
    };


    SceneManager.snapForBackground = function () {
        this._backgroundBitmap = this.snap();
    };
    const _Scene_MenuBase_createBackground = Scene_MenuBase.prototype.createBackground;
    Scene_MenuBase.prototype.createBackground = function () {
        _Scene_MenuBase_createBackground.apply(this, arguments);
        this._backgroundSprite._yuraInfo = [];
    };


    //-----------------------------------------------------------------------------
    // ゲームオーバー画面
    //-----------------------------------------------------------------------------

    const _Scene_Gameover_create = Scene_Gameover.prototype.create;
    Scene_Gameover.prototype.create = function () {
        _Scene_Gameover_create.apply(this, arguments);
        this.createWindowLayer();
        var cw = this._commandWindow = new Window_GameoverCommand();
        cw.setHandler('revival', this.commandRevival.bind(this));
        cw.setHandler('rewind', this.commandRewind.bind(this));
        cw.setHandler('retry', this.commandRewind.bind(this));
        cw.setHandler('giveup',  this.commandGiveup.bind(this));
        this.addWindow(cw);
        var w = 500, h = cw.fittingHeight(3);
        var hw = this._helpWindow = new Window_Free((Graphics.boxWidth - w) / 2, cw.y + cw.height, w, h);
        hw.setWindowSkin(3);
        this.addWindow(hw);
        $gameScreen._brightness = 0;
    };
    Scene_Gameover.prototype.createBackground = function () {
        this._backSprite = new Sprite();
        this._backSprite.bitmap = ImageManager.loadSystem('GameOver');
        this.addChild(this._backSprite);
    };
    Scene_Gameover.prototype.start = function () {
        Scene_Base.prototype.start.call(this);
        _timeOut(() => this._gameoverCount = 0, 60)
    };
    Scene_Gameover.prototype.update = function () {
        Scene_Base.prototype.update.call(this);

        if (this._phase === 'end') { //終了
            if (this._gameoverCount === 0) {
                AudioManager.fadeOutBgm(5);
                this._backSprite._yuraInfo = null;
            }
            if (this._gameoverCount < 60) {
                $gameScreen._brightness = 255 - 255 / 5 * (Math.floor(this._gameoverCount / 15) + 1);
            } else if (this._gameoverCount === 60) {
                $gameScreen._brightness = 0;
            }

        } else { //ゲームオーバー画面開始
            if (this._gameoverCount < 60) {
                $gameScreen._brightness = 255 / 5 * (Math.floor(this._gameoverCount / 15) + 1);
            } else if (this._gameoverCount === 60) {
                $gameScreen._brightness = 255;
                this._backSprite._yuraInfo = [];
            } else if (this._gameoverCount === 90) {
                this._commandWindow.open();
                this._helpWindow.open();
            }
        }
        this._gameoverCount++;

        var info = [this._commandWindow.index()].toString();
        if (this._lastInfoCommand !== info) {
            this._lastInfoCommand = info;
            var text = {
                revival : '最後のセーブポイントから復活する\nゲームの進行や経験値、お金、アイテムなどが\n引き継がれるよ',
                rewind :  '最後のセーブまで時を戻す\nゲームの進行や経験値、お金、アイテムなどは\nセーブした状態へリセットされるよ',
                retry :   '最後のセーブからリトライする\nゲームの進行や経験値、お金、アイテムなどは\nセーブした状態へリセットされるよ',
                giveup :  'タイトル画面に戻る'
            }[this._commandWindow.currentSymbol()];
            text = _tl(text);
            var hw = this._helpWindow;
            hw.refreshYurayura();
            hw.contents.clear();
            hw.drawTextKNH(text, 0, hw.contents.height / 2, hw.contents.width, 'center', 'center');
        }
        this._helpWindow.openness = this._commandWindow.isOpen() ? 255 : 0;
        $gameScreen.update();
    };
    Scene_Gameover.prototype.commandRevival = function () {
        this._commandWindow.close();
        this._phase = 'end';
        this._gameoverCount = 0;
        $gameTemp._snap = this._backSprite.bitmap;
        _timeOut(() => {
            $gameSystem.playSe('Book2', 90);
        }, 90);
        _timeOut(() => {
            $gameScreen._brightness = 0;
            $gameSwitches.setValue(5, true);
            $gameSwitches.setValue(26, true);
            SceneManager.goto(Scene_Map);
        }, 180);
    };
    Scene_Gameover.prototype.commandRewind = function () {
        this._commandWindow.close();
        this._phase = 'end';
        this._gameoverCount = 0;
        _timeOut(() => {
            $gameSystem.playSe('Book2', 90);
        }, 90);
        _timeOut(() => {
            DataManager.loadGame(DataManager.lastAccessedSavefileId());
            $gamePlayer.reserveTransfer($gameMap.mapId(), $gamePlayer.x, $gamePlayer.y, $gamePlayer.direction(), 2);
            SceneManager.goto(Scene_Map);
            $gameScreen._brightness = 0;
            _timeOut(() => $gameScreen.startFadeIn(24), 60)
        }, 180);
    };
    Scene_Gameover.prototype.commandGiveup = function () {
        this._commandWindow.close();
        this._phase = 'end';
        this._gameoverCount = 0;
        _timeOut(() => this.gotoTitle(), 210);
    };

    function Window_GameoverCommand() {
        this.initialize.apply(this, arguments);
    };
    Window_GameoverCommand.prototype = Object.create(Window_Command.prototype);
    Window_GameoverCommand.prototype.constructor = Window_GameoverCommand;
    Window_GameoverCommand.prototype.initialize = function () {
        Window_Command.prototype.initialize.call(this, 0, 0);
        this.updatePlacement();
        this.setWindowSkin(3);
        this.openness = 0;
    };
    Window_GameoverCommand.initCommandPosition = function () {
        this._lastCommandSymbol = null;
    };
    Window_GameoverCommand.prototype.windowWidth = function () {
        return 180;
    };
    Window_GameoverCommand.prototype.updatePlacement = function () {
        this.x = (Graphics.boxWidth - this.width) / 2;
        this.y = 270;
    };
    Window_GameoverCommand.prototype.itemTextAlign = function () {
        return 'left';
    };
    Window_GameoverCommand.prototype.makeCommandList = function () {
        if ($gamePlayer._lastSavePoint) {
            if ($gameMap.isEventRunning()) {
                this.addCommand('リトライ', 'retry');
            } else {
                this.addCommand('復活する', 'revival');
                this.addCommand('時を戻す', 'rewind');
            }
        }
        this.addCommand('諦める',   'giveup');
    };

    //-----------------------------------------------------------------------------
    // ウィンドウ配置・処理変更
    //-----------------------------------------------------------------------------

    //数値入力　任意の文字を数字の前後に表示可
    const _Window_NumberInput_start = Window_NumberInput.prototype.start;
    Window_NumberInput.prototype.start = function () {
        _Window_NumberInput_start.apply(this, arguments);
        this.select(this.maxCols() - 1);
        this.updateBackground();
    };
    Window_NumberInput.prototype.standardFontSize = function () { return 40 };
    Window_NumberInput.prototype.itemWidth = function () { return 28 };
    Window_NumberInput.prototype.windowWidth = function () {
        this.resetFontSettings();
        var w = this.maxCols() * this.itemWidth() + this.padding * 2 +
            this.textWidth($gameMessage._numInputTextA || '') + this.textWidth($gameMessage._numInputTextB || '');
        return Math.ceil(w);
    };
    Window_NumberInput.prototype.windowHeight = function () {
        return this.fittingHeight(1) + 32;
    };
    Window_NumberInput.prototype.itemRect = function () {
        this.resetFontSettings();
        var rect = Window_Selectable.prototype.itemRect.apply(this, arguments);
        if ($gameMessage._numInputTextA) rect.x += this.textWidth($gameMessage._numInputTextA);
        rect.height += 32;
        return rect;
    };
    Window_NumberInput.prototype.drawItem = function (index) {
        var rect = this.itemRect(index);
        var align = 'center';
        var s = this._number.padZero(this._maxDigits);
        var c = s.slice(index, index + 1);
        this.resetTextColor();
        this.drawText(c, rect.x + 3, rect.y + 16, rect.width, align);
    };
    Window_NumberInput.prototype.refresh = function () {
        Window_Selectable.prototype.refresh.apply(this, arguments);
        this.setFontSize(28);
        var y = this.lineHeight() * 0.5;
        if ($gameMessage._numInputTextA) this.drawText($gameMessage._numInputTextA, 12, y, this.contents.width - 24, 'left');
        if ($gameMessage._numInputTextB) this.drawText($gameMessage._numInputTextB, 12, y, this.contents.width - 24, 'right');
        this.resetFontSettings();
    };
    Window_NumberInput.prototype._refreshCursor = function () {
        var pad = this._padding;
        var x = this._cursorRect.x + pad - this.origin.x, y = this._cursorRect.y + pad - this.origin.y;
        var w = this._cursorRect.width, h = this._cursorRect.height;
        var m = 4, x2 = Math.max(x, pad), y2 = Math.max(y, pad), ox = x - x2 + m, oy = y - y2 + m;
        var w2 = Math.min(w, this._width - pad - x2) + m * 2, h2 = Math.min(h, this._height - pad - y2) + m * 2;
        var bitmap = new Bitmap(w2, h2);
        this._windowCursorSprite.bitmap = bitmap;
        this._windowCursorSprite.setFrame(0, 0, w2, h2);
        this._windowCursorSprite.move(x2 - m, y2 - m);

        if (w > 0 && h > 0 && this._windowskin) {
            bitmap.blt(this._windowskin, 132, 24, 24, 14, ox + (w2 - 24) / 2, oy);
            bitmap.blt(this._windowskin, 132, 58, 24, 14, ox + (w2 - 24) / 2, oy + h2 - 22);
        }
        this._windowCursorSprite._yuraInfo = [3, 10];
    };

    Window_Base.prototype.drawActorHp = function(actor, x, y, width) {
        width = width || 186;
        var color1 = this.textColor(actor.hpRate() < 0.25 ? 2 : actor.hpRate() < 0.5 ? 17 : 24);
        let r = parseInt(color1.substring(1, 3), 16), g = parseInt(color1.substring(3, 5), 16), b = parseInt(color1.substring(5, 7), 16);
        var p = 30; r = Math.floor(r * (1 - p / 100)), g = Math.floor(g * (1 - p / 100)), b = Math.floor(b * (1 - p / 100));
        var color2 = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        this.drawGauge(x, y, width, actor.hpRate(), color2, color1);
        this.changeTextColor(this.systemColor());
        this.drawText(TextManager.hpA, x, y, 44);
        this.drawCurrentAndMax(actor.hp, actor.mhp, x, y, width, this.hpColor(actor), this.normalColor());
    };
    Window_Base.prototype.drawGauge = function(x, y, width, rate, color1, color2) {
        var fillW = Math.floor(width * rate);
        var gaugeY = y + this.lineHeight() - 14;
        this.contents.fillRect(x, gaugeY, width, 12, this.gaugeBackColor());
        this.contents.gradientFillRect(x, gaugeY, fillW, 12, color1, color2);
    };

    //-----------------------------------------------------------------------------
    // ミニステータスだけ表示
    //-----------------------------------------------------------------------------
    
    Scene_Base.prototype.showMiniStatus = function() {
        var maxW = 208, x = this.isMenuRight() ? Graphics.boxWidth - maxW - 32 : 32;
        var y = this.autoMenuY();
        
        this._statusWindow = new Window_MenuStatus(0, 0);
        this._statusWindow.x = x < Graphics.boxWidth / 2 ? x : Graphics.boxWidth - this._statusWindow.width - 32;
        this._statusWindow.y = y + this._statusWindow.fittingHeight($gameParty.members().length >= 4 ? 8 : 11);
        this._statusWindow.reserveFaceImages();
        this._statusWindow.openness = 0, this._statusWindow.open();
        this.addWindow(this._statusWindow);
    };

    Scene_Base.prototype.hideMiniStatus = function() {
        this._windowLayer.removeChild(this._statusWindow);
        this._statusWindow = null;
    };
    
    //-----------------------------------------------------------------------------
    // 場所名の表示
    //-----------------------------------------------------------------------------

    Window_MapName.prototype.initialize = function () {
        var wight = this.windowWidth();
        var height = this.windowHeight();
        Window_Base.prototype.initialize.call(this, 24, 24, wight, height);
        this.openness = 0;
        this._showCount = 0;
        this.refresh();
    };
    Window_MapName.prototype.windowHeight = function () {
        return Math.floor(this.fittingHeight(1) * 1.2);
    };
    Window_MapName.prototype.open = function () {
        Window_Base.prototype.open.apply(this, arguments);
        this._showCount = 150;
    };
    Window_MapName.prototype.close = function () {
        Window_Base.prototype.close.apply(this, arguments);
    };
    const _Window_MapName_updateOpen = Window_MapName.prototype.updateOpen;
    Window_MapName.prototype.updateOpen = function () {
        if ($gameScreen._fadeOutDuration > 0 || $gameScreen._fadeInDuration > 0 || $gameScreen._brightness < 255) return;
        _Window_MapName_updateOpen.apply(this, arguments);
    };
    Window_MapName.prototype.update = function () {
        Window_Base.prototype.update.call(this);
        if (this._showCount > 0 && $gameMap.displayName() && $gameMap.isNameDisplayEnabled()) {
            if ($gameScreen._fadeOutDuration > 0 || $gameScreen._fadeInDuration > 0 || $gameScreen._brightness < 255) return;
            this._showCount--;
        } else {
            this.close();
        }
    };
    Window_MapName.prototype.refresh = function () {
        this.contents.clear();
        if ($gameMap.displayName()) {
            var width = this.contentsWidth();
            this.drawTextKNH($gameMap.displayName(), 0, this.contents.height / 2, width, 'center', 'center');
        } else {
            this.close();
        }
    };

})();

//エラー画面
(function () {
    'use strict';

    // ------------------------------------------------------------
    // ここをコード側で編集
    // ------------------------------------------------------------
    const MAIN_MESSAGE =
        "以下のエラーが発生しました\n" +
        "申し訳ございません\n" +
        "お手数ですが 以下のフォームへ ご報告いただけますと幸いです";

    const STACK_TITLE = "エラーメッセージ";
    const COPY_LABEL = "コピー";
    const COPIED_LABEL = "コピーしました";

    // 右上の大きいテキスト
    const SORRY_TEXT = "Sorry...";
    const SORRY_X = 2;        // 右端からの距離(px)
    const SORRY_Y = 20;       // 上端からの距離(px)
    const SORRY_ROT = 10;     // 回転角度(deg)
    const SORRY_SIZE = 70;    // フォントサイズ(px)

    // 右上のバージョン表記（普通の文字）
    const VERSION_TEXT = version;
    const VERSION_X = 370;         // 左端からの距離(px)
    const VERSION_Y = 0;           // 上端からの距離(px)
    const VERSION_SIZE = 16;       // フォントサイズ(px)

    // ------------------------------------------------------------
    // CSS注入（フォント/白文字/ボタン/コピーUI/Sorry/Version）
    // ------------------------------------------------------------
    function injectErrorCss() {
        var style = document.createElement('style');
        style.type = 'text/css';

        var css = `
      @font-face{
        font-family: "UGOMEKU_ErrorFont";
        src: url("fonts/073 TEGUSE - Kanaka Font_240904.ttf") format("truetype");
        font-weight: normal;
        font-style: normal;
      }

      #ErrorPrinter, #ErrorPrinter * {
        color: #fff !important;
        font-family: "UGOMEKU_ErrorFont", "Noto Sans JP", "Meiryo", sans-serif !important;
      }

      /* リンクをボタン風に（左揃え前提） */
      #ErrorPrinter a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 450px;
        box-sizing: border-box;
        padding: 10px 14px;
        margin-top: 10px;
        border: 1px solid rgba(255,255,255,0.7);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.35);
        text-decoration: none !important;
        cursor: pointer;
        user-select: none;
        -webkit-user-select: none;
      }
      #ErrorPrinter a:hover { background: rgba(255,255,255,0.12); }
      #ErrorPrinter a:active { transform: translateY(1px); }

      /* 見出し行（エラーメッセージ + コピー） */
      .knh-err-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 18px;
        margin-bottom: 6px;
      }
      .knh-err-title {
        font-size: 18px;
        font-weight: bold;
      }
      .knh-copy-btn {
        padding: 4px 10px;
        border: 1px solid rgba(255,255,255,0.7);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.35);
        cursor: pointer;
        font-size: 16px;
        line-height: 1.6;
        user-select: none;
        -webkit-user-select: none;
      }
      .knh-copy-btn:hover { background: rgba(255,255,255,0.12); }
      .knh-copy-btn:active { transform: translateY(1px); }

      .knh-copied {
        font-size: 16px;
        opacity: 0;
        transition: opacity 120ms ease;
        white-space: nowrap;
      }
      .knh-copied.is-show { opacity: 1; }

      /* 右上に大きく「Sorry...」を重ねる（::before） */
      #ErrorPrinter {
        position: relative; /* ::before / ::after の基準 */
      }
      /* 右上に大きく「Sorry...」を重ねる（エラー時だけ） */
        body.knh-error-active #ErrorPrinter { position: relative; }

        body.knh-error-active #ErrorPrinter::before {
        content: __SORRY_TEXT__;
        position: absolute;
        top: __SORRY_Y__px;
        right: __SORRY_X__px;
        font-size: __SORRY_SIZE__px;
        font-weight: 800;
        transform: rotate(__SORRY_ROT__deg);
        transform-origin: top right;
        opacity: 0.35;
        pointer-events: none;
        white-space: nowrap;
        text-shadow: 2px 2px 0 rgba(255, 255, 255, 0.6);
        }

        /* バージョン表記（エラー時だけ） */
        body.knh-error-active #ErrorPrinter::after {
        content: __VER_TEXT__;
        position: absolute;
        top: __VER_Y__px;
        left: __VER_X__px;
        font-size: __VER_SIZE__px;
        font-weight: normal;
        opacity: 0.9;
        pointer-events: none;
        white-space: nowrap;
        text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.35);
        }

    `;

        // 置換（contentはCSS文字列）
        css = css
            .replace(/__SORRY_TEXT__/g, '"' + String(SORRY_TEXT).replace(/"/g, '\\"') + '"')
            .replace(/__SORRY_X__/g, String(SORRY_X))
            .replace(/__SORRY_Y__/g, String(SORRY_Y))
            .replace(/__SORRY_ROT__/g, String(SORRY_ROT))
            .replace(/__SORRY_SIZE__/g, String(SORRY_SIZE))
            .replace(/__VER_TEXT__/g, '"' + String(VERSION_TEXT).replace(/"/g, '\\"') + '"')
            .replace(/__VER_X__/g, String(VERSION_X))
            .replace(/__VER_Y__/g, String(VERSION_Y))
            .replace(/__VER_SIZE__/g, String(VERSION_SIZE));

        style.textContent = css;
        document.head.appendChild(style);
    }
    injectErrorCss();

    // 元プラグインのパラメータ（リンク・詳細出力のON/OFFだけ利用）
    var p = PluginManager.parameters('CustomizeErrorScreen') || {};

    // ------------------------------------------------------------
    // クリップボード（NW.js前提）
    // ------------------------------------------------------------
    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }
        return new Promise(function (resolve, reject) {
            try {
                var ta = document.createElement('textarea');
                ta.value = text;
                ta.setAttribute('readonly', '');
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                ta.style.top = '0';
                document.body.appendChild(ta);
                ta.select();
                var ok = document.execCommand('copy');
                document.body.removeChild(ta);
                ok ? resolve() : reject(new Error('copy failed'));
            } catch (e) {
                reject(e);
            }
        });
    }

    // ------------------------------------------------------------
    // スタック整形：空白行を完全除去して詰める（NW.js用）
    // ------------------------------------------------------------
    function normalizeStack(stackText) {
        var s = String(stackText || '');
        s = s.replace(/\r\n?/g, '\n');
        s = s.replace(/file:.*js\//g, '');

        var lines = s.split('\n')
            .map(function (line) {
                return line.replace(/\s+$/g, '');
            })
            .filter(function (line) {
                return line.trim() !== '';
            });

        return lines.join('\n');
    }

    // ------------------------------------------------------------
    // 上部メッセージ（固定文）
    // ------------------------------------------------------------
    Graphics._makeMainMessage = function () {
        var mainMessage = document.createElement('div');
        var style = mainMessage.style;
        style.textAlign = 'left';
        style.fontSize = '18px';
        style.marginTop = '0px';
        style.whiteSpace = 'pre-line';
        mainMessage.textContent = _tl(MAIN_MESSAGE);
        this._errorPrinter.appendChild(mainMessage);
    };

    // ------------------------------------------------------------
    // 見出し「エラーメッセージ」＋コピー（右側）
    // ------------------------------------------------------------
    Graphics._makeStackHeader = function (stackPlainText) {
        var row = document.createElement('div');
        row.className = 'knh-err-header';

        var title = document.createElement('div');
        title.className = 'knh-err-title';
        title.textContent = _tl(STACK_TITLE);

        var btn = document.createElement('div');
        btn.className = 'knh-copy-btn';
        btn.textContent = _tl(COPY_LABEL);

        var copied = document.createElement('div');
        copied.className = 'knh-copied';
        copied.textContent = _tl(COPIED_LABEL);

        var timer = null;
        btn.addEventListener('click', function () {
            copyToClipboard(stackPlainText || '')
                .then(function () {
                    if (timer) clearTimeout(timer);
                    copied.classList.add('is-show');
                    timer = setTimeout(function () {
                        copied.classList.remove('is-show');
                    }, 1200);
                })
                .catch(function () {
                    if (timer) clearTimeout(timer);
                    copied.textContent = _tl("コピー失敗");
                    copied.classList.add('is-show');
                    timer = setTimeout(function () {
                        copied.classList.remove('is-show');
                        copied.textContent = _tl(COPIED_LABEL);
                    }, 1200);
                });
        });

        row.appendChild(title);
        row.appendChild(btn);
        row.appendChild(copied);
        this._errorPrinter.appendChild(row);
    };

    // ------------------------------------------------------------
    // スタック表示：textContentで安全＆改行制御（空白行なし）
    // ------------------------------------------------------------
    Graphics._makeStackTrace = function (stackPlainText) {
        this._makeStackHeader(stackPlainText);

        var stackTrace = document.createElement('div');
        var style = stackTrace.style;
        style.textAlign = 'left';
        style.fontSize = '18px';
        style.userSelect = 'text';
        style.webkitUserSelect = 'text';
        style.msUserSelect = 'text';
        style.mozUserSelect = 'text';
        style.whiteSpace = 'pre-wrap';

        stackTrace.textContent = stackPlainText || '';
        this._errorPrinter.appendChild(stackTrace);
    };

    // ------------------------------------------------------------
    // エラー画面全体を左揃えに
    // ------------------------------------------------------------
    var _KNH_setErrorPrinterStyle = Graphics._setErrorPrinterStyle;
    Graphics._setErrorPrinterStyle = function () {
        _KNH_setErrorPrinterStyle.call(this);
        if (this._errorPrinter && this._errorPrinter.style) {
            this._errorPrinter.style.textAlign = 'left';
        }
    };

    // ------------------------------------------------------------
    // 本体のTypeError表示を消してから、上から組み直す
    // ------------------------------------------------------------
    Graphics.printErrorDetail = function (e) {
        this.hideFps();
        this._setErrorPrinterStyle();
        if (!this._errorPrinter) return;
        if (document && document.body) {
            document.body.classList.add('knh-error-active');
        }

        this._errorPrinter.innerHTML = '';

        this._makeMainMessage();
        if (p.HyperLink) this._makeHyperLink();

        if (String(p.OutputDetail) === 'true' || String(p.OutputDetail) === 'ON') {
            var raw = String(e && e.stack) || '';
            var normalized = normalizeStack(raw);
            this._makeStackTrace(normalized);
        }
    };

})();
