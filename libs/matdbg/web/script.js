/*
 * Copyright (C) 2019 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const kMonacoBaseUrl = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.17.1/min/';

const materialList = document.getElementById("material-list");
const materialDetail = document.getElementById("material-detail");
const header = document.querySelector("header");
const footer = document.querySelector("footer");
const shaderSource = document.getElementById("shader-source");
const matDetailTemplate = document.getElementById("material-detail-template");
const matListTemplate = document.getElementById("material-list-template");

const gMaterialDatabase = {};

let gSocket = null;
let gEditor = null;
let gCurrentMaterial = "00000000";
let gCurrentShader = { matid: "00000000", glindex: -1, vkindex: -1, metalindex: -1 };
let gCurrentSocketId = 0;
let gEditorIsLoading = false;

require.config({ paths: { "vs": `${kMonacoBaseUrl}vs` }});

window.MonacoEnvironment = {
    getWorkerUrl: function(workerId, label) {
      return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
        self.MonacoEnvironment = {
          baseUrl: '${kMonacoBaseUrl}'
        };
        importScripts('${kMonacoBaseUrl}vs/base/worker/workerMain.js');`
      )}`;
    }
};

document.querySelector("body").addEventListener("click", (evt) => {
    const anchor = evt.target.closest("a");
    if (!anchor) {
        return;
    }

    // Handle selection of a material.
    if (anchor.classList.contains("material")) {
        selectMaterial(anchor.dataset.matid);
        return;
    }

    // Handle selection of a shader.
    if (anchor.classList.contains("shader")) {
        selectShader(anchor.dataset);
        return;
    }

    // Handle a rebuild.
    if (anchor.classList.contains("rebuild")) {
        let api = 0, index = -1;
        if ("glindex" in gCurrentShader)    { api = 1; index = gCurrentShader.glindex; }
        if ("vkindex" in gCurrentShader)    { api = 2; index = gCurrentShader.vkindex; }
        if ("metalindex" in gCurrentShader) { api = 3; index = gCurrentShader.metalindex; }
        const text = getShaderRecord(gCurrentShader).text;
        gSocket.send(`${gCurrentShader.matid} ${api} ${index} ${text}`);
        return;
    }
});

function fetchMaterial(matid) {
    fetch(`api/material?matid=${matid}`).then(function(response) {
        return response.json();
    }).then(function(matInfo) {
        if (matid in gMaterialDatabase) {
            return;
        }
        matInfo.matid = matid;
        gMaterialDatabase[matid] = matInfo;
        for (const shader of matInfo.opengl) fetchShader({glindex: shader.index}, matInfo);
        for (const shader of matInfo.vulkan) fetchShader({vkindex: shader.index}, matInfo);
        for (const shader of matInfo.metal)  fetchShader({metalindex: shader.index}, matInfo);
        renderMaterialList();
    });
}

function startSocket() {
    const url = new URL(document.URL)
    const ws = new WebSocket(`ws://${url.host}`);

    const reconnect = () => {
        gSocket = null;
        setTimeout(() => startSocket(), 3000);
    };

    // When a new server has come online, ask it what materials it has.
    ws.addEventListener("open", () => {
        footer.innerText = `connection ${gCurrentSocketId}`;
        gCurrentSocketId++;

        fetch("api/matids").then(function(response) {
            return response.json();
        }).then(function(matInfo) {
            for (matid of matInfo) {
                if (!(matid in gMaterialDatabase)) {
                    fetchMaterial(matid);
                }
            }
        });
    });

    ws.addEventListener("close", (e) => {
        footer.innerText = "no connection";
        reconnect();
    });

    ws.addEventListener("message", event => {
        const matid = event.data;
        fetchMaterial(matid);
    });

    gSocket = ws;
}

function fetchMaterials() {
    fetch("api/materials").then(function(response) {
        return response.json();
    }).then(function(matJson) {
        for (const matInfo of matJson) {
            if (matInfo.matid in gMaterialDatabase) {
                continue;
            }
            gMaterialDatabase[matInfo.matid] = matInfo;
            for (const shader of matInfo.opengl) fetchShader({glindex: shader.index}, matInfo);
            for (const shader of matInfo.vulkan) fetchShader({vkindex: shader.index}, matInfo);
            for (const shader of matInfo.metal)  fetchShader({metalindex: shader.index}, matInfo);
        }
        selectMaterial(matJson[0].matid);
    });
}

function fetchShader(selection, matinfo) {
    let query, target;
    if (selection.glindex >= 0) {
        query = `type=glsl&glindex=${selection.glindex}`;
        target = matinfo.opengl[parseInt(selection.glindex)];
    }
    if (selection.vkindex >= 0) {
        query = `type=spirv&vkindex=${selection.vkindex}`;
        target = matinfo.vulkan[parseInt(selection.vkindex)];
    }
    if (selection.metalindex >= 0) {
        query = `type=glsl&metalindex=${selection.metalindex}`;
        target = matinfo.metal[parseInt(selection.metalindex)];
    }
    fetch(`api/shader?matid=${matinfo.matid}&${query}`).then(function(response) {
        return response.text();
    }).then(function(shaderText) {
        target.text = shaderText;
    });
}

function renderMaterialList() {
    const materials = [];
    for (const matid in gMaterialDatabase) {
        const item = gMaterialDatabase[matid];
        item.classes = matid === gCurrentMaterial ? "active" : "";
        materials.push(item);
    }
    materialList.innerHTML = Mustache.render(matListTemplate.innerHTML, { "material": materials } );
}

function updateClassList(array, indexProperty, selectedIndex) {
    for (let item of array) {
        const active = parseInt(item[indexProperty]) === selectedIndex;
        item.classes = active ? "active" : "";
    }
}

function renderMaterialDetail() {
    const mat = gMaterialDatabase[gCurrentMaterial];
    const ok = mat.matid === gCurrentShader.matid;
    updateClassList(mat.opengl, "index", ok ? parseInt(gCurrentShader.glindex) : -1);
    updateClassList(mat.vulkan, "index", ok ? parseInt(gCurrentShader.vkindex) : -1);
    updateClassList(mat.metal, "index", ok ? parseInt(gCurrentShader.metalindex) : -1);
    materialDetail.innerHTML = Mustache.render(matDetailTemplate.innerHTML, mat);
}

function getShaderRecord(selection) {
    const mat = gMaterialDatabase[gCurrentMaterial];
    if (selection.glindex >= 0) return mat.opengl[parseInt(selection.glindex)];
    if (selection.vkindex >= 0) return mat.vulkan[parseInt(selection.vkindex)];
    if (selection.metalindex >= 0) return mat.metal[parseInt(selection.metalindex)];
    return null;
}

function renderShaderStatus() {
    const shader = getShaderRecord(gCurrentShader);
    if (shader.modified) {
        header.innerHTML = "matdbg &nbsp; <a class='rebuild'>[rebuild]</a>";
    } else {
        header.innerHTML = "matdbg";
    }
}

function selectShader(selection) {
    const shader = getShaderRecord(selection);
    if (!shader || !shader.text) {
        console.error("Shader source not yet available.");
        return;
    }
    gCurrentShader = selection;
    gCurrentShader.matid = gCurrentMaterial;
    renderMaterialDetail();
    gEditorIsLoading = true;
    gEditor.setValue(shader.text);
    gEditorIsLoading = false;
    shaderSource.style.visibility = "visible";
    renderShaderStatus();
}

function onEdit(changes) {
    if (gEditorIsLoading) {
        return;
    }
    const shader = getShaderRecord(gCurrentShader);
    if (!shader.modified) {
        shader.modified = true;
        renderShaderStatus();
    }
    shader.text = gEditor.getValue();
    // TODO: add diff decorations by doing:
    //
    //  1. Examine "changes" (IModelContentChange) to get a set of line numbers.
    //  2. shader.decorations = gEditor.deltaDecorations(shader.decorations, ...)
    //
    //     https://microsoft.github.io/monaco-editor/playground.html
    //             #interacting-with-the-editor-line-and-inline-decorations
}

function selectMaterial(matid) {
    gCurrentMaterial = matid;
    renderMaterialList();
    renderMaterialDetail();
}

function init() {
    require(["vs/editor/editor.main"], function () {
        gEditor = monaco.editor.create(shaderSource, {
            value: "",
            language: "cpp",
            scrollBeyondLastLine: false,
            readOnly: false,
            minimap: { enabled: false }
        });
        gEditor.onDidChangeModelContent((e) => { onEdit(e.changes); });
        fetchMaterials();
    });

    Mustache.parse(matDetailTemplate.innerHTML);
    Mustache.parse(matListTemplate.innerHTML);

    startSocket();
}

init();
