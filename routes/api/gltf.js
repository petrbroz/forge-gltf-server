const path = require('path');
const express = require('express');
const fse = require('fs-extra');
const { BIM360Client, ModelDerivativeClient, ManifestHelper } = require('forge-server-utils');
const { SvfReader, GltfWriter } = require('forge-convert-utils');

let router = express.Router();

async function translate(itemUrn, versionUrn, folderPath, statusPath, token) {
    try {
        console.log('Processing', itemUrn, versionUrn);
        const urn = itemUrn + '_' + versionUrn;
        const auth = { token };
        const modelDerivativeClient = new ModelDerivativeClient(auth);
        const helper = new ManifestHelper(await modelDerivativeClient.getManifest(urn));
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
            const reader = await SvfReader.FromDerivativeService(urn, derivative.guid, auth);
            const svf = await reader.read(readerOptions);
            await rawWriter.write(svf, path.join(folderPath, derivative.guid, 'raw'));
            await glbWriter.write(svf, path.join(folderPath, derivative.guid, 'glb'));
        }
        let status = fse.readJsonSync(statusPath);
        status.status = 'succeeded';
        status.views = [];
        for (const derivative of derivatives.filter(d => d.mime === 'application/autodesk-svf')) {
            status.views.push({
                name: derivative.name || derivative.guid,
                guid: derivative.guid,
                urls: {
                    raw: path.join(itemUrn, versionUrn, derivative.guid, 'raw', 'output.gltf'),
                    glb: path.join(itemUrn, versionUrn, derivative.guid, 'glb', 'output.glb'),
                }
            });
        }
        fse.writeJsonSync(statusPath, status);
    } catch (err) {
        let status = fse.readJsonSync(statusPath);
        status.status = 'failed';
        status.error = err;
        fse.writeJsonSync(statusPath, status);
    }
}

router.use(function (req, res, next) {
    const { authorization } = req.headers;
    if (authorization) {
        req.access_token = authorization.replace('Bearer ', '');
        req.bim360 = new BIM360Client({ token: req.access_token });
        next();
    } else {
        res.status(400).send('Missing access token.');
    }
});

router.get('/:item_urn/:version_urn', async function (req, res) {
    try {
        const { item_urn, version_urn } = req.params;
        const folderPath = path.join(__dirname, '..', '..', 'tmp', item_urn, version_urn);
        const statusPath = path.join(folderPath, 'status.json');
        fse.ensureDirSync(folderPath);
        if (!fse.pathExistsSync(statusPath)) {
            fse.writeJsonSync(statusPath, {
                created: new Date().toISOString(),
                status: 'pending'
            });
            translate(item_urn, version_urn, folderPath, statusPath, req.access_token);
            res.status(202).sendFile(statusPath);
        } else {
            res.sendFile(statusPath);
        }
    } catch(err) {
        res.status(400).send(err);
    }
});

module.exports = router;
