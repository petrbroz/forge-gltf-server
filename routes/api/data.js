const express = require('express');
const { BIM360Client } = require('forge-server-utils');

let router = express.Router();

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

router.get('/hubs', async function (req, res) {
    try {
        const hubs = await req.bim360.listHubs();
        res.json(hubs.map(hub => ({ name: hub.name, id: hub.id })));
    } catch(err) {
        res.status(400).send(err);
    }
});

router.get('/hubs/:hub_id', async function (req, res) {
    try {
        const details = await req.bim360.getHubDetails(req.params.hub_id);
        res.json(details);
    } catch(err) {
        res.status(400).send(err);
    }
});

router.get('/hubs/:hub_id/projects', async function (req, res) {
    try {
        const projects = await req.bim360.listProjects(req.params.hub_id);
        res.json(projects.map(project => ({ name: project.name, id: project.id })));
    } catch(err) {
        res.status(400).send(err);
    }
});

router.get('/hubs/:hub_id/projects/:project_id', async function (req, res) {
    try {
        const details = await req.bim360.getProjectDetails(req.params.hub_id, req.params.project_id);
        res.json(details);
    } catch(err) {
        res.status(400).send(err);
    }
});

router.get('/hubs/:hub_id/projects/:project_id/items', async function (req, res) {
    try {
        const topFolders = await req.bim360.listTopFolders(req.params.hub_id, req.params.project_id);
        res.json(topFolders.map(folder => ({ name: folder.displayName, id: folder.id, type: 'folders' })));
    } catch(err) {
        res.status(400).send(err);
    }
});

router.get('/hubs/:hub_id/projects/:project_id/items/:item_id', async function (req, res) {
    try {
        const details = await req.bim360.getItemDetails(req.params.project_id, req.params.item_id);
        res.json(details);
    } catch(err) {
        res.status(400).send(err);
    }
});

router.get('/hubs/:hub_id/projects/:project_id/items/:item_id/children', async function (req, res) {
    try {
        const children = await req.bim360.listContents(req.params.project_id, req.params.item_id);
        res.json(children.map(child => ({ name: child.displayName, id: child.id, type: child.type })));
    } catch(err) {
        res.status(400).send(err);
    }
});

router.get('/hubs/:hub_id/projects/:project_id/items/:item_id/versions', async function (req, res) {
    try {
        const versions = await req.bim360.listVersions(req.params.project_id, req.params.item_id);
        res.json(versions.map(version => ({ name: version.displayName, id: version.id, type: version.type })));
    } catch(err) {
        res.status(400).send(err);
    }
});

module.exports = router;
