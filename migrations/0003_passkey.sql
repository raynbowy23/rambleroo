-- Passkeys (WebAuthn): only the public key and credential metadata are stored; the private key and any biometric stay on the person's device.
CREATE TABLE passkey (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT,
  publicKey TEXT NOT NULL,
  userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  credentialID TEXT NOT NULL,
  counter INTEGER NOT NULL,
  deviceType TEXT NOT NULL,
  backedUp INTEGER NOT NULL,
  transports TEXT,
  createdAt INTEGER,
  aaguid TEXT
);
CREATE INDEX passkey_userId_idx ON passkey(userId);
CREATE INDEX passkey_credentialID_idx ON passkey(credentialID);
