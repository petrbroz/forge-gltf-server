const { FORGE_CLIENT_ID, FORGE_CLIENT_SECRET, HOST_URL, SERVER_SESSION_SECRET } = process.env;

if (!FORGE_CLIENT_ID || !FORGE_CLIENT_SECRET || !HOST_URL || !SERVER_SESSION_SECRET) {
    console.error('Some of the following env. variables are missing:');
    console.error('FORGE_CLIENT_ID, FORGE_CLIENT_SECRET, HOST_URL, SERVER_SESSION_SECRET');
    return;
}

module.exports = {
    client_id: FORGE_CLIENT_ID,
    client_secret: FORGE_CLIENT_SECRET,
    host_url: HOST_URL,
    session: {
        name: 'ForgeGltfSession',
        secret: SERVER_SESSION_SECRET,
        age: 7 * 24 * 60 * 60 * 1000
    },
    scopes: ['viewables:read', 'bucket:create', 'bucket:read', 'data:read', 'data:create', 'data:write'],
    redirect_uri: `${HOST_URL}/auth/callback`,
    port: parseInt(process.env.PORT) || 3000
};
