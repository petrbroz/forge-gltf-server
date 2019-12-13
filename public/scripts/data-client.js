class DataClient {
    constructor(access_token) {
        this.access_token = access_token;
    }

    async _get(endpoint) {
        const options = {
            headers: {
                'Authorization': 'Bearer ' + this.access_token
            }
        };
        const resp = await fetch('/api/data' + endpoint, options);
        if (resp.ok) {
            const json = await resp.json();
            return json;
        } else {
            const err = await resp.text();
            throw new Error(err);
        }
    }

    async getHubs() {
        return this._get(`/hubs`);
    }

    async getHubDetails(hubId) {
        return this._get(`/hubs/${hubId}`);
    }

    async getProjects(hubId) {
        return this._get(`/hubs/${hubId}/projects`);
    }

    async getProjectDetails(hubId, projectId) {
        return this._get(`/hubs/${hubId}/projects/${projectId}`);
    }

    async getTopFolders(hubId, projectId) {
        return this._get(`/hubs/${hubId}/projects/${projectId}/items`);
    }

    async getFolderContents(hubId, projectId, folderId) {
        return this._get(`/hubs/${hubId}/projects/${projectId}/items/${folderId}/children`);
    }

    async getItemVersions(hubId, projectId, itemId) {
        return this._get(`/hubs/${hubId}/projects/${projectId}/items/${itemId}/versions`);
    }
}
