class GltfClient {
    constructor(access_token) {
        this.access_token = access_token;
    }

    async _get(endpoint) {
        const options = {
            headers: {
                'Authorization': 'Bearer ' + this.access_token
            }
        };
        const resp = await fetch('/api/gltf' + endpoint, options);
        if (resp.ok) {
            const json = await resp.json();
            return json;
        } else {
            const err = await resp.text();
            throw new Error(err);
        }
    }

    async getItemStatus(itemVersionUrn) {
        return this._get(`/${itemVersionUrn}`);
    }
}
