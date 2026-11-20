const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'KNH_ZXC_Battle.js'), 'utf8');
const start = source.indexOf('    Sprite_Bullet.prototype             =');
const end = source.indexOf('\n    var laserChildNum', start);
assert.ok(start >= 0 && end > start);
const sheet = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'img', 'bullets', 'artilleryShell.png'));
const bitmap = { width: sheet.readUInt32BE(16), height: sheet.readUInt32BE(20), isReady: () => true };
assert.equal(bitmap.width % 6, 0);
assert.equal(bitmap.height % 2, 0);
const cellWidth = bitmap.width / 6, cellHeight = bitmap.height / 2;
const chargedSheet = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'img', 'bullets', 'chargedShot.png'));
const chargedBitmap = { width: chargedSheet.readUInt32BE(16), height: chargedSheet.readUInt32BE(20), isReady: () => true };
const missileSheet = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'img', 'bullets', 'missile.png'));
const missileBitmap = { width: missileSheet.readUInt32BE(16), height: missileSheet.readUInt32BE(20), isReady: () => true };
assert.equal(cellWidth, cellHeight, 'the resized asset still consists of six by two square cells');

function Sprite_Base() {}
Sprite_Base.prototype.initialize = function() {
    this.anchor = { x: 0, y: 0 };
    this.scale = { x: 1, y: 1 };
    this.visible = true;
};
Sprite_Base.prototype.update = function() {};
Sprite_Base.prototype.setFrame = function(x, y, width, height) { this.frame = { x, y, width, height }; };
function Sprite_Bullet() { this.initialize.apply(this, arguments); }
const runtime = { Sprite_Base, Sprite_Bullet, ImageManager: { loadBitmap: (folder, name) =>
    name === 'missile' ? missileBitmap : name === 'chargedShot' ? chargedBitmap : bitmap },
    Bitmap: function() { return { isReady: () => true }; }, Math };
vm.runInNewContext(source.slice(start, end), runtime);

// Match the fixed-duration weapon launch against the actual bullet update loop.
for (const [tx, ty, duration] of [[400, 340, 36], [-150, 300, 36], [100.01, 200.01, 2], [1000, 100, 60]]) {
    const distance = Math.hypot(tx - 100, ty - 200);
    const speed = distance / (duration - 1) / 3 * (1 + 1e-9);
    const bullet = new Sprite_Bullet('artilleryShell', 100, 200, tx, ty, 'parabola', speed, -64, 0);
    assert.equal(bullet._frames, 6);
    assert.deepEqual(bullet.frame, { x: 0, y: 0, width: cellWidth, height: cellHeight });
    for (let i = 0; i < duration; i++) {
        bullet.update();
        if (i < duration - 1) assert.equal(bullet._finish, undefined, 'no early impact');
    }
    assert.equal(bullet._finish, 1, 'impact occurs after exactly the requested flight frames');
    assert.equal(bullet.x, tx);
    assert.equal(bullet.y, ty);
    const explosionCells = new Set();
    for (let i = 0; i < 37; i++) {
        bullet.update();
        assert.equal(bullet.frame.y, cellHeight, 'impact uses the lower row');
        explosionCells.add(bullet.frame.x / cellWidth);
    }
    assert.deepEqual([...explosionCells].sort(), [0, 1, 2, 3, 4, 5]);
    assert.equal(bullet._finish, 2);
    assert.equal(bullet.visible, false, 'the complete explosion is then removed');
}

const arc = new Sprite_Bullet('artilleryShell', 100, 200, 400, 340, 'parabola', 3, -64, 0);
arc.update();
arc.update();
assert.ok(arc.y < 200, 'the shell initially rises out of the upward-pointing muzzle');
const charged = new Sprite_Bullet('chargedShot', 100, 200, 400, 260,
    'straight', Math.hypot(300, 60) / 17 / 3 * (1 + 1e-9), 0, 0);
assert.equal(charged._frames, 6);
assert.equal(charged._frameCount, 3);
assert.equal(charged.frame.width, chargedBitmap.width / 6);
const chargeFlightCells = new Set();
for (let i = 0; i < 18; i++) {
    charged.update();
    chargeFlightCells.add(charged.frame.x / (chargedBitmap.width / 6));
    if (i < 17) assert.equal(charged._finish, undefined);
}
assert.equal(charged._finish, 1);
assert.ok(Math.abs(charged.rotation - Math.atan2(60, 300)) < 1e-9);
assert.deepEqual([...chargeFlightCells].sort(), [0, 1, 2, 3, 4, 5]);
const chargeImpactCells = new Set();
for (let i = 0; i < 19; i++) {
    charged.update();
    assert.equal(charged.frame.y, chargedBitmap.height / 2);
    chargeImpactCells.add(charged.frame.x / (chargedBitmap.width / 6));
}
assert.deepEqual([...chargeImpactCells].sort(), [0, 1, 2, 3, 4, 5]);
assert.equal(charged.visible, false);
const missile = new Sprite_Bullet('missile', 100, 200, 400, 260, 'straight', 2, 0, 0);
assert.equal(missile._frames, 6);
assert.equal(missile._frameCount, 6);
assert.deepEqual(missile.frame, { x: 0, y: 0, width: 72, height: 72 });
console.log('Battle bullet tests passed');
