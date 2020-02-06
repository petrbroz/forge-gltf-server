$(function () {
    initUI();
});

async function initUI() {
    initNavbar();
    if (AUTH) {
        const bim360Client = new forge.BIM360Client({ token: AUTH.access_token });
        updateHubsDropdown(bim360Client);
    }
}

async function initNavbar() {
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

async function updateHubsDropdown(bim360Client) {
    const $hubs = $('#hubs');
    const hubs = await bim360Client.listHubs();
    for (const hub of hubs) {
        $hubs.append(`<option value="${hub.id}">${hub.name}</option>`);
    }
    $hubs.off('change').on('change', () => updateProjectsDropdown(bim360Client));
    $hubs.trigger('change');
}

async function updateProjectsDropdown(bim360Client) {
    const $projects = $('#projects');
    $projects.empty();
    const projects = await bim360Client.listProjects($('#hubs').val());
    for (const project of projects) {
        $projects.append(`<option value="${project.id}">${project.name}</option>`);
    }
    $projects.off('change').on('change', () => updateDocumentTree(bim360Client));
    $projects.trigger('change');
}

async function updateDocumentTree(bim360Client) {
    // Icon URLs: https://icongr.am/octicons
    const $tree = $('#tree');
    $tree.jstree('destroy');
    $tree.jstree({
        core: {
            data: async function (obj, callback) {
                const hubId = $('#hubs').val();
                const projectId = $('#projects').val();
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
                            text: version.lastModifiedTime,
                            id: version.id,
                            children: false,
                            data: version,
                            icon: `https://icongr.am/octicons/clock.svg`
                        };
                    }));
                }
            }
        }
    }).on('changed.jstree', async function (ev, data) {
        const obj = data.node && data.node.data;
        if (obj && obj.type === 'versions') {
            updatePreview(obj.id);
        }
    });
}

async function updatePreview(version) {
    $('#preview').text('Loading...');
    const status = await getTranslationStatus(version);
    $('#preview').empty();
    switch (status.status) {
        case 'pending':
            $('#preview').append(`
                <div class="alert alert-info" role="alert">
                    Translation in progress, please check back later...
                </div>
            `);
            break;
        case 'success':
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
                                <gltf-viewer interactive src="${view.urls.raw}"></gltf-viewer>
                            </div>
                            <ul>
                                <li>
                                    <a href="${view.urls.raw}">Raw glTF (temporary link)</a>
                                    <div class="qr" data-url="${window.location.href.replace(/\/$/, '') + view.urls.raw}"></div>
                                </li>
                                <li>
                                    <a href="${view.urls.glb}">Draco glb (temporary link)</a>
                                    <div class="qr" data-url="${window.location.href.replace(/\/$/, '') + view.urls.glb}"></div>
                                </li>
                            </ul>
                        <div>
                    `).join('\n')}
                </div>
            `);
            $('.qr').each(function () {
                const $this = $(this);
                $this.qrcode($this.data('url'));
            });
            break;
        case 'failure':
            $('#preview').append(`
                <div class="alert alert-danger" role="alert">
                    Translation failed: ${JSON.stringify(status.error)}.
                </div>
            `);
            break;
    }
}

async function getTranslationStatus(version) {
    const options = {
        headers: {
            'Authorization': 'Bearer ' + AUTH.access_token
        }
    };
    const resp = await fetch('/gltf/' + encodeURIComponent(version), options);
    if (resp.ok) {
        const json = await resp.json();
        return json;
    } else {
        const err = await resp.text();
        throw new Error(err);
    }
}
