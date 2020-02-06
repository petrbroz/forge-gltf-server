const crypto = require('crypto');
const path = require('path');
const express = require('express');
const fse = require('fs-extra');
const { BIM360Client } = require('forge-server-utils');
const svf2gltf = require('../workers/svf-to-gltf.js');
const gltf2usdz = require('../workers/gltf-to-usdz.js');

let router = express.Router();

async function process(urn, folderPath, statusPath, token) {
    try {
        console.log('Converting SVF to glTF...');
        await svf2gltf(urn, folderPath, statusPath, token);
        console.log('Converting glTF to USDZ...');
        let status = fse.readJsonSync(statusPath);
        for (const view of status.views) {
            const workingDir = path.join(__dirname, '..', 'temp', view.hash, view.guid);

            // The gltf-to-usdz tool fails when gltf contains empty list of images or textures...
            const gltfPath = path.join(workingDir, 'gltf', 'output.gltf');
            const manifest = fse.readJsonSync(gltfPath);
            if (manifest.images.length === 0) {
                delete manifest.images;
            }
            if (manifest.textures.length === 0) {
                delete manifest.textures;
            }
            fse.writeJsonSync(gltfPath, manifest, { spaces: 4 });

            fse.ensureDirSync(path.join(workingDir, 'usdz'));
            const { stdout, stderr } = await gltf2usdz(workingDir, 'gltf/output.gltf', 'usdz/output.usdz');
            view.variants.usdz = 'usdz/output.usdz';
            fse.writeJsonSync(statusPath, status);
            console.log('stdout', stdout);
            console.warn('stderr', stderr);
        }
    } catch (err) {
        let status = fse.readJsonSync(statusPath);
        status.status = 'error';
        status.error = err;
        fse.writeJsonSync(statusPath, status, { spaces: 4 });
        console.error(err);
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
            fse.writeJsonSync(statusPath, { created: new Date().toISOString(), status: 'inprogress'}, { spaces: 4 });
            process(urn, folderPath, statusPath, req.access_token);
            res.status(202).sendFile(statusPath);
        } else {
            res.sendFile(statusPath);
        }
    } catch(err) {
        res.status(400).send(err);
    }
});

module.exports = router;
