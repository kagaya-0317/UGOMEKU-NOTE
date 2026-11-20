// Add the gate-only filter without touching existing event or dialogue bytes.
const fs=require('node:fs'),assert=require('node:assert/strict');
for(const file of ['js/plugins/KNH_ZXC_CastleUpper.js','tools/castle_upper_maps/gate_item_placement.txt']){
 const before=fs.readFileSync(file),text=before.toString('utf8'),nl=text.includes('\r\n')?'\r\n':'\n';
 const at='        this._castleGateSelection = gate;';
 assert.ok(text.includes(at));assert.ok(!text.includes('var gateItemIncludes'),'Filter already installed');
 const added=[
 '    var gateItemIncludes = Window_EventItem.prototype.includes;',
 '    Window_EventItem.prototype.includes = function(item) {',
 '        return gateItemIncludes.apply(this, arguments) &&',
 '            !(this._castleGateSelection && item.id === this._castleGateExcludedItemId);',
 '    };',
 ''
 ].join(nl);
 const marker='    var gateItemPlacement = Window_EventItem.prototype.updatePlacement;';
 const updated=text.replace(at,at+nl+'        this._castleGateExcludedItemId = gate ? Number($gameMap._interpreter._castleGateFirstKey) || 0 : 0;').replace(marker,added+marker);
 assert.ok(fs.readFileSync(file).equals(before),'Concurrent file change: '+file);fs.writeFileSync(file,updated);console.log('Patched '+file);
}
