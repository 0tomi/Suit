const { app } = require('electron');
app.name = 'SuitAPP';

app.whenReady().then(() => {
    try {
        const { initDatabase, _unsafe, getConfig } = require('./electron/database.cjs');
        initDatabase();
        const pDb = _unsafe.getActiveProfileDb();
        console.log("activeProfileDb is", !!pDb);
        if (pDb) {
            const row = pDb.prepare('SELECT value FROM config WHERE key = ?').get('auth_token');
            console.log('auth_token row:', row);
            console.log('getConfig auth_token:', getConfig('auth_token'));
        }
    } catch (e) {
        console.error(e);
    }
    app.exit(0);
});
