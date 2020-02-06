const crypto = require('crypto');
const path = require('path');
const express = require('express');
const fse = require('fs-extra');
const { BIM360Client, ModelDerivativeClient, ManifestHelper, urnify } = require('forge-server-utils');
const { SvfReader, GltfWriter } = require('forge-convert-utils');

let router = express.Router();

async function translate(urn, folderPath, statusPath, token) {
    try {
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
            await rawWriter.write(svf, path.join(folderPath, derivative.guid, 'raw'));
            await glbWriter.write(svf, path.join(folderPath, derivative.guid, 'glb'));
        }
        let status = fse.readJsonSync(statusPath);
        status.status = 'success';
        status.views = [];
        for (const derivative of derivatives.filter(d => d.mime === 'application/autodesk-svf')) {
            status.views.push({
                name: derivative.name || derivative.guid,
                guid: derivative.guid,
                urls: {
                    raw: path.join('/temp', path.basename(folderPath), derivative.guid, 'raw', 'output.gltf'),
                    glb: path.join('/temp', path.basename(folderPath), derivative.guid, 'glb', 'output.glb'),
                }
            });
        }
        fse.writeJsonSync(statusPath, status);
    } catch (err) {
        let status = fse.readJsonSync(statusPath);
        status.status = 'error';
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
        res.status(401).end();
    }
});

router.get('/:urn', async function (req, res) {
    try {
        const { urn } = req.params;
        const hash = crypto.createHash('md5').update(urn).update('secret').digest('hex');
        const folderPath = path.join(__dirname, '..', 'temp', hash);
        const statusPath = path.join(folderPath, 'status.json');
        fse.ensureDirSync(folderPath);
        if (!fse.pathExistsSync(statusPath)) {
            fse.writeJsonSync(statusPath, {
                created: new Date().toISOString(),
                status: 'inprogress'
            });
            translate(urn, folderPath, statusPath, req.access_token);
            res.status(202).sendFile(statusPath);
        } else {
            res.sendFile(statusPath);
        }
    } catch(err) {
        res.status(400).send(err);
    }
});

module.exports = router;
