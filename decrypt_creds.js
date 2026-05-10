const crypto = require('crypto');
const sqlite3Path = 'C:/Users/chris/AppData/Roaming/npm/node_modules/n8n/node_modules/sqlite3';
const sqlite3 = require(sqlite3Path);
const DB_PATH = 'C:\\Users\\chris\\.n8n\\database.sqlite';
const ENCRYPTION_KEY = 'l/5EPsLmH3oQZLmgrUFojHIVxkGRtu8E';

// CryptoJS uses OpenSSL EVP_BytesToKey with MD5
function decryptCryptoJS(encryptedBase64, password) {
  try {
    const encrypted = Buffer.from(encryptedBase64, 'base64');
    // First 8 bytes: "Salted__", next 8 bytes: salt
    const salt = encrypted.slice(8, 16);
    const ciphertext = encrypted.slice(16);
    
    // Derive key and IV using MD5
    const keyAndIV = evpBytesToKey(password, salt, 32 + 16);
    const key = keyAndIV.slice(0, 32);
    const iv = keyAndIV.slice(32, 48);
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  } catch(e) {
    return null;
  }
}

function evpBytesToKey(password, salt, keyLen) {
  const passBuffer = Buffer.from(password, 'utf8');
  let result = Buffer.alloc(0);
  let prev = Buffer.alloc(0);
  while (result.length < keyLen) {
    prev = crypto.createHash('md5').update(Buffer.concat([prev, passBuffer, salt])).digest();
    result = Buffer.concat([result, prev]);
  }
  return result.slice(0, keyLen);
}

const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY);

db.all(`SELECT id, name, type, data FROM credentials_entity WHERE type LIKE '%gmail%' OR type LIKE '%Google%' OR type LIKE '%Sheets%'`, [], (err, rows) => {
  if (err) { console.error(err); db.close(); return; }
  rows.forEach(r => {
    console.log(`\n=== ${r.name} (${r.id}) type=${r.type} ===`);
    const raw = typeof r.data === 'string' ? r.data : r.data.toString();
    const decrypted = decryptCryptoJS(raw, ENCRYPTION_KEY);
    if (decrypted) {
      try {
        const parsed = JSON.parse(decrypted);
        console.log('Keys:', Object.keys(parsed));
        if (parsed.oauthTokenData) {
          const td = parsed.oauthTokenData;
          console.log('  has access_token:', !!td.access_token);
          console.log('  has refresh_token:', !!td.refresh_token);
          if (td.expiry_date) {
            const exp = new Date(td.expiry_date);
            console.log('  expiry_date:', exp.toISOString(), '| expired:', exp < new Date());
          }
          if (td.scope) console.log('  scope:', td.scope.substring(0, 100));
        } else {
          // Show all keys with truncated values
          for (const [k, v] of Object.entries(parsed)) {
            const val = typeof v === 'string' ? v.substring(0, 80) : JSON.stringify(v).substring(0, 80);
            console.log(`  ${k}: ${val}`);
          }
        }
      } catch(e) {
        console.log('Decrypted (not JSON):', decrypted.substring(0, 200));
      }
    } else {
      console.log('Decryption failed');
    }
  });
  db.close();
});
