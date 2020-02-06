const path = require('path');
const fse = require('fs-extra');
const { ModelDerivativeClient, ManifestHelper, urnify } = require('forge-server-utils');
const { SvfReader, GltfWriter } = require('forge-convert-utils');

module.exports = async function (urn, folderPath, statusPath, token) {
    console.log('Processing', urn);
    const auth = { token };
    const modelDerivativeClient = new ModelDerivativeClient(auth);
    const encodedUrn = urnify(urn).replace('/', '_');
    const helper = new ManifestHelper(await modelDerivativeClient.getManifest(encodedUrn));
    const derivatives = helper.search({ type: 'resource', role: 'graphics' });
    const readerOptions = {
        log: console.log
    };
    const rawWriter = new GltfWriter({
        skipUnusedUvs: true,
        ignoreLineGeometry: true,
        ignorePointGeometry: true,
        center: true,
        log: console.log
    });
    const glbWriter = new GltfWriter({
        deduplicate: true,
        compress: true,
        binary: true,
        skipUnusedUvs: true,
        ignoreLineGeometry: true,
        ignorePointGeometry: true,
        center: true,
        log: console.log
    });
    for (const derivative of derivatives.filter(d => d.mime === 'application/autodesk-svf')) {
        const reader = await SvfReader.FromDerivativeService(encodedUrn, derivative.guid, auth);
        const svf = await reader.read(readerOptions);
        await rawWriter.write(svf, path.join(folderPath, derivative.guid, 'gltf'));
        await glbWriter.write(svf, path.join(folderPath, derivative.guid, 'glb'));
    }
    let status = fse.readJsonSync(statusPath);
    status.status = 'success';
    status.views = [];
    for (const derivative of derivatives.filter(d => d.mime === 'application/autodesk-svf')) {
        status.views.push({
            name: derivative.name || derivative.guid,
            hash: path.basename(folderPath),
            guid: derivative.guid,
            variants: {
                gltf: path.join('gltf', 'output.gltf'),
                glb: path.join('glb', 'output.glb'),
            }
        });
    }
    fse.writeJsonSync(statusPath, status, { spaces: 4 });
}
