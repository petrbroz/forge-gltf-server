async function initUI() {
    initNavbar();
    if (AUTH) {
        const bim360Client = new forge.BIM360Client({ token: AUTH.access_token });
        initHubsDropdown(bim360Client);
    }
}

async function initNavbar(bim360Client) {
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

async function initHubsDropdown(bim360Client) {
    const $hubs = $('#hubs');
    const hubs = await bim360Client.listHubs();
    for (const hub of hubs) {
        $hubs.append(`
            <option value="${hub.id}">${hub.name}</option>
        `);
    }
    $hubs.off('change').on('change', function () { updateProjectsDropdown(bim360Client); });
    $hubs.trigger('change');
}

async function updateProjectsDropdown(bim360Client) {
    const hubId = $('#hubs').val();
    const $projects = $('#projects');
    $projects.empty();
    const projects = await bim360Client.listProjects(hubId);
    for (const project of projects) {
        $projects.append(`
            <option value="${project.id}">${project.name}</option>
        `);
    }
    $projects.off('change').on('change', function () { updateDocumentTree(bim360Client); });
    $projects.trigger('change');
}

async function updateDocumentTree(bim360Client) {
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
                updatePreview(urn);
            }
        }
    }).jstree({
        core: {
            data: async function (obj, callback) {
                if (obj.id === '#') {
                    const folders = await bim360Client.listTopFolders(hubId, projectId);
                    callback(folders.map(folder => {
                        folder.type = 'folders';
                        return {
                            text: folder.displayName,
                            id: folder.id,
                            children: true,
                            data: folder,
                            icon: `https://icongr.am/octicons/file-directory.svg`
                        };
                    }));
                } else if (obj.data.type === 'folders') {
                    const contents = await bim360Client.listContents(projectId, obj.id);
                    callback(contents.map(entry => {
                        return {
                            text: entry.displayName,
                            id: entry.id,
                            children: true,
                            data: entry,
                            icon: `https://icongr.am/octicons/${(entry.type === 'folders') ? 'file-directory' : 'file'}.svg`
                        };
                    }));
                } else if (obj.data.type === 'items') {
                    const versions = await bim360Client.listVersions(projectId, obj.id);
                    callback(versions.map(version => {
                        return {
                            text: version.displayName,
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

async function updatePreview(urn) {
    $('#preview').text('Loading...');
    const status = await getTranslationStatus(urn);
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
            $('#preview').append(`
                <ul class="nav nav-tabs" id="views-tabs" role="tablist">
                    ${status.views.map((view, i) => `
                        <li class="nav-item">
                            <a class="nav-link ${i === 0 ? 'active' : ''}" id="tab-${view.id}" data-toggle="tab" role="tab" href="#${view.id}">${view.name}</a>
                        </li>
                    `).join('\n')}
                </ul>
                <div class="tab-content" id="views-content">
                    ${status.views.map((view, i) => `
                        <div class="tab-pane fade ${i === 0 ? 'show active' : ''}" id="${view.id}" role="tabpanel" aria-labelledby="tab-${view.id}">
                            <div>
                                <gltf-viewer interactive src="/tmp/${view.urls.raw}"></gltf-viewer>
                            </div>
                            <ul>
                                <li>Raw glTF (temporary link): <a href="/tmp/${view.urls.raw}">/tmp/${view.urls.raw}</a></li>
                                <li>Draco glb (temporary link): <a href="/tmp/${view.urls.glb}">/tmp/${view.urls.glb}</a></li>
                            </ul>
                        <div>
                    `).join('\n')}
                </div>
            `);
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

async function getTranslationStatus(urn) {
    const options = {
        headers: {
            'Authorization': 'Bearer ' + AUTH.access_token
        }
    };
    const resp = await fetch('/api/gltf/' + urn, options);
    if (resp.ok) {
        const json = await resp.json();
        return json;
    } else {
        const err = await resp.text();
        throw new Error(err);
    }
}

initUI();
