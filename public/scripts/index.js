async function initUI() {
    initNavbar();
    if (AUTH) {
        const dataClient = new DataClient(AUTH.access_token);
        const gltfClient = new GltfClient(AUTH.access_token);
        initHubsDropdown(dataClient, gltfClient);
    }
}

async function initNavbar(dataClient, gltfClient) {
    const $navbar = $('#navbar-collapsible');
    if (AUTH) {
        $navbar.append(`
            <div class="dropdown ml-auto">
                <button class="btn btn-secondary dropdown-toggle" type="button" id="login-dropdown" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                    ${AUTH.user_name}
                </button>
                <div class="dropdown-menu dropdown-menu-right" aria-labelledby="login-dropdown">
                    <a class="dropdown-item" href="/auth/logout">Logout</a>
                </div>
            </div>
        `);
    } else {
        $navbar.append(`
            <a class="btn btn-primary ml-auto" href="/auth/login">Login</a>
        `);
    }
}

async function initHubsDropdown(dataClient, gltfClient) {
    const $hubs = $('#hubs');
    const hubs = await dataClient.getHubs();
    for (const hub of hubs) {
        $hubs.append(`
            <option value="${hub.id}">${hub.name}</option>
        `);
    }
    $hubs.off('change').on('change', function () { updateProjectsDropdown(dataClient, gltfClient); });
    $hubs.trigger('change');
}

async function updateProjectsDropdown(dataClient, gltfClient) {
    const $projects = $('#projects');
    $projects.empty();
    const projects = await dataClient.getProjects($('#hubs').val());
    for (const project of projects) {
        $projects.append(`
            <option value="${project.id}">${project.name}</option>
        `);
    }
    $projects.off('change').on('change', function () { updateDocumentTree(dataClient, gltfClient); });
    $projects.trigger('change');
}

async function updateDocumentTree(dataClient, gltfClient) {
    // Icon URLs: https://icongr.am/octicons
    const hubId = $('#hubs').val();
    const projectId = $('#projects').val();
    const $tree = $('#tree');
    $tree.jstree('destroy');
    $tree.on('changed.jstree', async function (e, data) {
        if (data.selected.length === 1) {
            const urn = btoa(data.selected[0]);
            // If the base64-encoded string contains '/', we know it's an item version
            if (urn.indexOf('/') !== -1) {
                updatePreview(urn, gltfClient);
            }
        }
    }).jstree({
        core: {
            data: async function (obj, callback) {
                if (obj.id === '#') {
                    const folders = await dataClient.getTopFolders(hubId, projectId);
                    callback(folders.map(folder => {
                        return {
                            text: folder.name,
                            id: folder.id,
                            children: true,
                            data: folder,
                            icon: `https://icongr.am/octicons/file-directory.svg`
                        };
                    }));
                } else if (obj.data.type === 'folders') {
                    const contents = await dataClient.getFolderContents(hubId, projectId, obj.id);
                    callback(contents.map(entry => {
                        return {
                            text: entry.name,
                            id: entry.id,
                            children: true,
                            data: entry,
                            icon: `https://icongr.am/octicons/${(entry.type === 'folders') ? 'file-directory' : 'file'}.svg`
                        };
                    }));
                } else if (obj.data.type === 'items') {
                    const versions = await dataClient.getItemVersions(hubId, projectId, obj.id);
                    callback(versions.map(version => {
                        return {
                            text: version.name,
                            id: version.id,
                            children: false,
                            data: version,
                            icon: `https://icongr.am/octicons/clock.svg`
                        };
                    }));
                }
            }
        }
    });
}

async function updatePreview(urn, gltfClient) {
    $('#preview').text('Loading...');
    const status = await gltfClient.getItemStatus(urn);
    $('#preview').empty();
    switch (status.status) {
        case 'pending':
            $('#preview').append(`
                <div class="alert alert-info" role="alert">
                    Translation in progress, please check back later...
                </div>
            `);
            break;
        case 'succeeded':
            $('#preview').append(status.views.map(view => `
                <h4>View ${view.name}</h4>
                <div>
                    <gltf-viewer interactive src="/tmp/${view.urls.raw}"></gltf-viewer>
                </div>
                <ul>
                    <li>Raw glTF (temporary link): <a href="/tmp/${view.urls.raw}">/tmp/${view.urls.raw}</a></li>
                    <li>Draco glb (temporary link): <a href="/tmp/${view.urls.glb}">/tmp/${view.urls.glb}</a></li>
                </ul>
            `));
            break;
        case 'failed':
            $('#preview').append(`
                <div class="alert alert-danger" role="alert">
                    Translation failed: ${status.error}.
                </div>
            `);
            break;
    }
}

initUI();
